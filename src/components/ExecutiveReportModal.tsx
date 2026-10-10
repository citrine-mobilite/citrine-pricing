import React, { useMemo } from 'react';
import { PricingCampaign, TripResult } from '../types';
import {
  FileText,
  Printer,
  X,
  Building2,
  TrendingDown,
  Award,
  Sparkles
} from 'lucide-react';
import { cleanNeighborhoodName, getYangoPrice, getHeroPrice } from './pricing/pricingUtils';
import { HeroLogo } from './HeroLogo';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: PricingCampaign;
  trips: TripResult[];
}

export const ExecutiveReportModal: React.FC<ExecutiveReportModalProps> = ({
  isOpen,
  onClose,
  campaign,
  trips
}) => {
  // Executive KPI calculations
  const stats = useMemo(() => {
    let heroWins = 0;
    let yangoWins = 0;
    let equals = 0;
    let totalComparable = 0;

    let sumHeroEco = 0;
    let sumYangoEco = 0;
    let sumDist = 0;

    // Neighborhood advantages map: neighborhoodName -> { savingsSum: number, count: number }
    const neighborhoodMap = new Map<string, { totalSavings: number; count: number }>();
    const tripDiscounts: Array<{
      origin: string;
      destination: string;
      dist: number;
      heroPrice: number;
      yangoPrice: number;
      savings: number;
    }> = [];

    for (const t of trips) {
      const h = getHeroPrice(t, 'eco');
      const y = getYangoPrice(t, 'econom');

      if (!h || !y) continue;
      totalComparable++;
      sumHeroEco += h;
      sumYangoEco += y;
      sumDist += t.distanceKm || 0;

      const orig = cleanNeighborhoodName(t.origin || t.startNeighborhoodName);
      const dest = cleanNeighborhoodName(t.destination || t.endNeighborhoodName);
      const savings = y - h; // > 0 means Hero is cheaper

      if (h < y) {
        heroWins++;
        tripDiscounts.push({
          origin: orig,
          destination: dest,
          dist: t.distanceKm,
          heroPrice: h,
          yangoPrice: y,
          savings
        });
      } else if (y < h) {
        yangoWins++;
      } else {
        equals++;
      }

      // Group by origin neighborhood
      const curr = neighborhoodMap.get(orig) || { totalSavings: 0, count: 0 };
      curr.totalSavings += savings;
      curr.count += 1;
      neighborhoodMap.set(orig, curr);
    }

    const heroWinPct = totalComparable > 0 ? Math.round((heroWins / totalComparable) * 100) : 0;
    const yangoWinPct = totalComparable > 0 ? Math.round((yangoWins / totalComparable) * 100) : 0;

    const avgHeroPrice = totalComparable > 0 ? Math.round(sumHeroEco / totalComparable) : 0;
    const avgYangoPrice = totalComparable > 0 ? Math.round(sumYangoEco / totalComparable) : 0;
    const avgDist = totalComparable > 0 ? Number((sumDist / totalComparable).toFixed(1)) : 0;

    const avgHeroPerKm = avgDist > 0 ? Math.round(avgHeroPrice / avgDist) : 0;
    const avgYangoPerKm = avgDist > 0 ? Math.round(avgYangoPrice / avgDist) : 0;

    // Top 5 Neighborhoods where Hero is most competitive (highest avg savings per trip)
    const topNeighborhoods = Array.from(neighborhoodMap.entries())
      .map(([name, data]) => ({
        name,
        avgSavings: Math.round(data.totalSavings / data.count),
        tripsCount: data.count
      }))
      .filter((n) => n.tripsCount >= 3)
      .sort((a, b) => b.avgSavings - a.avgSavings)
      .slice(0, 5);

    // Top 5 individual routes with largest price advantage for Hero Cab
    const topTrips = tripDiscounts
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 5);

    return {
      totalComparable,
      heroWins,
      yangoWins,
      equals,
      heroWinPct,
      yangoWinPct,
      avgHeroPrice,
      avgYangoPrice,
      avgDist,
      avgHeroPerKm,
      avgYangoPerKm,
      topNeighborhoods,
      topTrips
    };
  }, [trips]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      
      {/* Container - Designed to fit cleanly on 1 page A4 when printed */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[96vh] flex flex-col overflow-hidden my-auto print:max-w-none print:max-h-none print:w-full print:border-none print:shadow-none print:rounded-none">
        
        {/* Modal Controls Bar (Hidden during printing) */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#D4A82F]" />
            <span className="text-xs font-bold tracking-tight">Fiche Synthèse Exécutive (Format A4 / 1 page)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#2B6D66] text-white rounded-lg transition cursor-pointer active:scale-95 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-[#D4A82F]" />
              <span>Imprimer / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Executive Sheet Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800 print:p-0 print:overflow-visible">
          
          {/* Executive Header */}
          <div className="flex items-start justify-between pb-5 border-b-2 border-slate-900">
            <div>
              <div className="flex items-center gap-2">
                <HeroLogo size="sm" showSubtitle={false} />
                <span className="text-xs font-bold tracking-widest uppercase text-slate-400">| RAPPORT DIRECTION</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                Synthèse Stratégique & Pricing VTC
              </h1>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-[#1F4F4A]" />
                  {campaign.cityName} (Cameroun)
                </span>
                <span>•</span>
                <span>{new Date(campaign.startedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span>•</span>
                <span>Relevé de {stats.totalComparable} trajets réels</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score de Victoire</div>
              <div className="text-2xl sm:text-3xl font-black text-[#1F4F4A]">
                {stats.heroWinPct}%
              </div>
              <div className="text-[10px] font-bold text-emerald-700 uppercase">Hero Cab Leader</div>
            </div>
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Victoires Hero Cab</div>
              <div className="text-lg font-black text-[#1F4F4A] mt-1">{stats.heroWinPct}%</div>
              <div className="text-[11px] text-slate-500">{stats.heroWins} trajets moins chers</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Victoires Yango</div>
              <div className="text-lg font-black text-rose-700 mt-1">{stats.yangoWinPct}%</div>
              <div className="text-[11px] text-slate-500">{stats.yangoWins} trajets moins chers</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Prix Moyen Trajet</div>
              <div className="text-lg font-black text-slate-900 mt-1">
                {stats.avgHeroPrice.toLocaleString('fr-FR')} F
              </div>
              <div className="text-[11px] text-slate-500">vs Yango {stats.avgYangoPrice.toLocaleString('fr-FR')} F</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Coût au Kilomètre</div>
              <div className="text-lg font-black text-slate-900 mt-1">
                {stats.avgHeroPerKm} F/km
              </div>
              <div className="text-[11px] text-slate-500">vs Yango {stats.avgYangoPerKm} F/km</div>
            </div>
          </div>

          {/* Two Columns: Top Quartiers + Top Trajets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Top 5 Quartiers où Hero Cab est le plus compétitif */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Award className="w-4 h-4 text-[#D4A82F]" />
                <h3 className="text-xs font-bold uppercase text-slate-900 tracking-wider">
                  Top 5 Quartiers de Domination Hero Cab
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                {stats.topNeighborhoods.length === 0 ? (
                  <p className="text-slate-400 text-xs">Aucune donnée suffisante.</p>
                ) : (
                  stats.topNeighborhoods.map((n, idx) => (
                    <div key={n.name} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1F4F4A] text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 truncate">{n.name}</span>
                      </div>
                      <span className="font-extrabold text-emerald-700 shrink-0">
                        ~{n.avgSavings.toLocaleString('fr-FR')} F moins cher
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top 5 Trajets avec les plus grands écarts tarifaires */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <TrendingDown className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase text-slate-900 tracking-wider">
                  Plus Gros Écarts Tarifaires en Faveur de Hero
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                {stats.topTrips.length === 0 ? (
                  <p className="text-slate-400 text-xs">Aucune donnée suffisante.</p>
                ) : (
                  stats.topTrips.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate text-[11px]">
                          {t.origin} ➔ {t.destination}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Hero: {t.heroPrice} F | Yango: {t.yangoPrice} F
                        </div>
                      </div>
                      <span className="font-black text-emerald-700 text-xs shrink-0 ml-2">
                        -{t.savings.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Strategic Note for Executive Board */}
          <div className="p-3.5 rounded-xl bg-[#1F4F4A]/5 border border-[#1F4F4A]/15 text-xs text-slate-700 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#1F4F4A] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Conclusion Stratégique Direction :</strong> Sur l'ensemble du réseau urbain de {campaign.cityName}, Hero Cab démontre un positionnement très compétitif avec <strong>{stats.heroWinPct}% de victoires tarifaires directes</strong> sur Yango. L'écart moyen au kilomètre reste favorable de <strong>{Math.max(0, stats.avgYangoPerKm - stats.avgHeroPerKm)} FCFA/km</strong> en faveur de Hero Cab.
            </p>
          </div>

          {/* Footer Timestamp */}
          <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Citrine Pricing • Plateforme Interne de Décision VTC</span>
            <span>Document Confidentiel — Usage Interne</span>
          </div>

        </div>

      </div>
    </div>
  );
};
