import React, { useMemo, useState } from 'react';
import { TripResult } from '../../types';
import {
  X,
  Copy,
  Check,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { cleanNeighborhoodName, getYangoPrice, getHeroPrice } from './pricingUtils';

interface PricingRecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  trips: TripResult[];
  cityName: string;
}

type VehicleClassKey = 'eco' | 'confort';

interface VehicleClassConfig {
  key: VehicleClassKey;
  label: string;
  heroKey: 'eco' | 'confort';
  yangoKey: 'econom' | 'business';
  badge: string;
}

const VEHICLE_CLASSES: VehicleClassConfig[] = [
  {
    key: 'eco',
    label: 'Standard / Éco',
    heroKey: 'eco',
    yangoKey: 'econom',
    badge: 'Standard'
  },
  {
    key: 'confort',
    label: 'Confort',
    heroKey: 'confort',
    yangoKey: 'business',
    badge: 'Confort'
  }
];

interface ActionableOpportunity {
  tripId: string;
  origin: string;
  destination: string;
  distanceKm: number;
  currentHero: number;
  currentYango: number;
  delta: number; // h - y (> 0 means Hero is more expensive)
  type: 'quick_win' | 'margin_gain';
  suggestedHeroPrice: number;
  strategicGain: string;
}

export const PricingRecommendationModal: React.FC<PricingRecommendationModalProps> = ({
  isOpen,
  onClose,
  trips,
  cityName
}) => {
  const [selectedClass, setSelectedClass] = useState<VehicleClassKey>('eco');
  const [activeFilter, setActiveFilter] = useState<'all' | 'quick_wins' | 'margin'>('quick_wins');
  const [copied, setCopied] = useState(false);

  const activeClassConfig = useMemo(() => {
    return VEHICLE_CLASSES.find((c) => c.key === selectedClass) || VEHICLE_CLASSES[0];
  }, [selectedClass]);

  const analysis = useMemo(() => {
    let totalComparable = 0;
    let heroCheaperCount = 0;
    let yangoCheaperCount = 0;
    let equalCount = 0;

    const quickWins: ActionableOpportunity[] = [];
    const marginGains: ActionableOpportunity[] = [];

    for (const t of trips) {
      const h = getHeroPrice(t, activeClassConfig.heroKey);
      const y = getYangoPrice(t, activeClassConfig.yangoKey);

      if (!h || !y) continue;
      totalComparable++;

      const orig = cleanNeighborhoodName(t.origin || t.startNeighborhoodName);
      const dest = cleanNeighborhoodName(t.destination || t.endNeighborhoodName);
      const delta = h - y;

      if (h < y) {
        heroCheaperCount++;
        // Opportunité de marge : Hero est déjà moins cher de >= 350 FCFA
        if (y - h >= 350) {
          const targetPrice = Math.round((h + 150) / 50) * 50;
          const increaseAmount = targetPrice - h;
          marginGains.push({
            tripId: t.id,
            origin: orig,
            destination: dest,
            distanceKm: t.distanceKm,
            currentHero: h,
            currentYango: y,
            delta: y - h,
            type: 'margin_gain',
            suggestedHeroPrice: targetPrice,
            strategicGain: `+${increaseAmount} F de hausse de marge (${h} F + ${increaseAmount} F = ${targetPrice} F, restant ${y - targetPrice} F sous Yango)`
          });
        }
      } else if (y < h) {
        yangoCheaperCount++;
        // Quick Win : Yango est moins cher (h > y)
        if (delta <= 300 && delta > 0) {
          const targetPrice = Math.max(100, Math.round((y - 50) / 50) * 50);
          const reductionAmount = h - targetPrice;

          quickWins.push({
            tripId: t.id,
            origin: orig,
            destination: dest,
            distanceKm: t.distanceKm,
            currentHero: h,
            currentYango: y,
            delta,
            type: 'quick_win',
            suggestedHeroPrice: targetPrice,
            strategicGain: `Retirer -${reductionAmount} F (${h} F - ${reductionAmount} F = ${targetPrice} F, soit 50 F sous Yango)`
          });
        }
      } else {
        equalCount++;
      }
    }

    const currentDominationPct = totalComparable > 0 ? Math.round((heroCheaperCount / totalComparable) * 100) : 0;
    const potentialHeroWins = heroCheaperCount + quickWins.length;
    const potentialDominationPct = totalComparable > 0 ? Math.round((potentialHeroWins / totalComparable) * 100) : 0;

    quickWins.sort((a, b) => a.delta - b.delta);
    marginGains.sort((a, b) => b.delta - a.delta);

    return {
      totalComparable,
      heroCheaperCount,
      yangoCheaperCount,
      equalCount,
      currentDominationPct,
      potentialDominationPct,
      quickWins,
      marginGains
    };
  }, [trips, activeClassConfig]);

  if (!isOpen) return null;

  const displayedList =
    activeFilter === 'quick_wins'
      ? analysis.quickWins
      : activeFilter === 'margin'
      ? analysis.marginGains
      : [...analysis.quickWins, ...analysis.marginGains];

  const handleCopy = () => {
    const lines = [
      `PLAN D'OPTIMISATION TARIFAIRE HERO CAB — ${cityName.toUpperCase()}`,
      `Classe : ${activeClassConfig.label}`,
      `Date : ${new Date().toLocaleDateString('fr-FR')}`,
      `Trajets comparés : ${analysis.totalComparable}`,
      `Domination actuelle : ${analysis.currentDominationPct}% (${analysis.heroCheaperCount} victoires)`,
      `Domination projetée : ${analysis.potentialDominationPct}% (+${analysis.potentialDominationPct - analysis.currentDominationPct}%)`,
      '',
      `Top Ajustements Tactiques (${analysis.quickWins.length} trajets) :`,
      ...analysis.quickWins.slice(0, 10).map((t, i) =>
        `${i + 1}. ${t.origin} ➔ ${t.destination} : Hero ${t.currentHero}F | Yango ${t.currentYango}F ➔ Nouveau tarif suggéré : ${t.suggestedHeroPrice}F`
      )
    ];

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header - Clean, modern, restrained */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                Recommandations Tarifaires Hero Cab
              </h2>
              <span className="text-xs font-medium text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500">{cityName}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Optimisation de grille concurrentielle calculée par classe de véhicule
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vehicle Class Segmented Bar */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
            {VEHICLE_CLASSES.map((vc) => {
              const isSelected = selectedClass === vc.key;
              return (
                <button
                  key={vc.key}
                  onClick={() => setSelectedClass(vc.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {vc.label}
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-500 font-mono">
            {analysis.totalComparable} trajets comparés
          </span>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100 bg-white">
          <div className="p-4 sm:px-6">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Domination Actuelle
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {analysis.currentDominationPct}%
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ({analysis.heroCheaperCount}/{analysis.totalComparable})
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Part des trajets où Hero Cab est le moins cher</p>
          </div>

          <div className="p-4 sm:px-6">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Domination Projetée
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {analysis.potentialDominationPct}%
              </span>
              {analysis.potentialDominationPct > analysis.currentDominationPct && (
                <span className="text-xs font-semibold text-emerald-600">
                  +{analysis.potentialDominationPct - analysis.currentDominationPct}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Après ajustement des victoires rapides</p>
          </div>

          <div className="p-4 sm:px-6">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Opportunités Détectées
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {analysis.quickWins.length + analysis.marginGains.length}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ({analysis.quickWins.length} gains + {analysis.marginGains.length} marges)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Actions à fort impact sans risque</p>
          </div>
        </div>

        {/* Sub-filter Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveFilter('quick_wins')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                activeFilter === 'quick_wins'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Victoires Rapides ({analysis.quickWins.length})
            </button>
            <button
              onClick={() => setActiveFilter('margin')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                activeFilter === 'margin'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Hausses de Marge ({analysis.marginGains.length})
            </button>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tous ({analysis.quickWins.length + analysis.marginGains.length})
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Copié</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copier la liste</span>
              </>
            )}
          </button>
        </div>

        {/* Table / List */}
        <div className="flex-1 overflow-y-auto">
          {displayedList.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-1">
              <p className="font-medium text-slate-600">Aucune opportunité dans cette sélection</p>
              <p className="text-slate-400 text-[11px]">
                {analysis.totalComparable === 0
                  ? `Aucun trajet n'a de tarif valide pour la classe ${activeClassConfig.label} sur cette campagne.`
                  : 'Tous les trajets de cette classe sont déjà parfaitement positionnés.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs border-b border-slate-100 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 sm:px-6">Trajet</th>
                  <th className="py-2.5 px-3 text-right">Hero Actuel</th>
                  <th className="py-2.5 px-3 text-right">Yango</th>
                  <th className="py-2.5 px-3 text-right">Écart</th>
                  <th className="py-2.5 px-4 text-right">Prix Suggéré</th>
                  <th className="py-2.5 px-4 hidden md:table-cell">Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {displayedList.map((item) => (
                  <tr key={item.tripId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 sm:px-6 font-sans">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900">
                        <span className="truncate max-w-[130px] sm:max-w-[200px]">{item.origin}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                        <span className="truncate max-w-[130px] sm:max-w-[200px]">{item.destination}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {item.distanceKm} km
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right text-slate-700">
                      {item.currentHero.toLocaleString('fr-FR')} F
                    </td>

                    <td className="py-3 px-3 text-right text-slate-700">
                      {item.currentYango.toLocaleString('fr-FR')} F
                    </td>

                    <td className="py-3 px-3 text-right">
                      {item.type === 'quick_win' ? (
                        <span className="text-rose-600 font-medium">+{item.delta} F</span>
                      ) : (
                        <span className="text-emerald-600 font-medium">-{item.delta} F</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-sans">
                      <span className="inline-block px-2 py-0.5 font-mono font-semibold text-slate-900 bg-slate-100 rounded text-xs">
                        {item.suggestedHeroPrice.toLocaleString('fr-FR')} F
                      </span>
                    </td>

                    <td className="py-3 px-4 font-sans text-[11px] text-slate-500 hidden md:table-cell">
                      {item.strategicGain}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            {displayedList.length} opportunité{displayedList.length > 1 ? 's' : ''} sur {activeClassConfig.label}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
