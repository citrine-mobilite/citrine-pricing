import React, { useState } from 'react';
import { City, Neighborhood } from '../types';
import {
  PlayCircle,
  Building2,
  MapPin,
  Calculator,
  ShieldCheck,
  Clock,
  Sparkles,
  Zap,
  ArrowRight,
  Sliders,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface PricingLauncherViewProps {
  cities: City[];
  neighborhoods: Neighborhood[];
  selectedCityId: string;
  onSelectCityId: (cityId: string) => void;
  onCampaignStarted: (campaignId: string) => void;
}

export const PricingLauncherView: React.FC<PricingLauncherViewProps> = ({
  cities,
  neighborhoods,
  selectedCityId,
  onSelectCityId,
  onCampaignStarted
}) => {
  const { user } = useAuth();
  const currentCity = cities.find(c => c.id === selectedCityId) || cities[0];

  const cityNeighborhoods = neighborhoods.filter(n => n.cityId === currentCity?.id);
  const activeNeighborhoods = cityNeighborhoods.filter(n => n.active);
  const activeCount = activeNeighborhoods.length;
  const totalPairs = activeCount > 1 ? activeCount * (activeCount - 1) : 0;

  const [selectedClasses, setSelectedClasses] = useState<string[]>(['econom']);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single Route Test Tool State
  const [singleStartId, setSingleStartId] = useState<string>(activeNeighborhoods[0]?.id || '');
  const [singleEndId, setSingleEndId] = useState<string>(activeNeighborhoods[1]?.id || '');
  const [singleTestResult, setSingleTestResult] = useState<any>(null);
  const [isTestingSingle, setIsTestingSingle] = useState(false);

  // Generate pair preview (first 6)
  const previewPairs: { origin: Neighborhood; dest: Neighborhood }[] = [];
  if (activeCount >= 2) {
    for (let i = 0; i < activeNeighborhoods.length && previewPairs.length < 6; i++) {
      for (let j = 0; j < activeNeighborhoods.length && previewPairs.length < 6; j++) {
        if (i !== j) {
          previewPairs.push({
            origin: activeNeighborhoods[i],
            dest: activeNeighborhoods[j]
          });
        }
      }
    }
  }

  const toggleClass = (tariffId: string) => {
    if (selectedClasses.includes(tariffId)) {
      if (selectedClasses.length > 1) {
        setSelectedClasses(selectedClasses.filter(c => c !== tariffId));
      }
    } else {
      setSelectedClasses([...selectedClasses, tariffId]);
    }
  };

  const handleStartCampaign = async () => {
    if (!currentCity) return;
    if (activeCount < 2) {
      setError('Au moins 2 quartiers actifs sont nécessaires pour générer les permutations Départ ➔ Arrivée.');
      return;
    }

    setIsLaunching(true);
    setError(null);

    try {
      const res = await api.startCampaign({
        cityId: currentCity.id,
        triggeredByUserId: user?.id,
        triggeredByUserName: user?.name,
        triggerType: 'manual',
        selectedClasses
      });

      onCampaignStarted(res.campaign.id);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du lancement de la campagne.');
      setIsLaunching(false);
    }
  };

  const handleRunSingleTest = async () => {
    const origin = activeNeighborhoods.find(n => n.id === singleStartId);
    const dest = activeNeighborhoods.find(n => n.id === singleEndId);
    if (!origin || !dest) return;

    setIsTestingSingle(true);
    setSingleTestResult(null);

    try {
      const res = await api.testSingleRoute({
        startLat: origin.lat,
        startLng: origin.lng,
        endLat: dest.lat,
        endLng: dest.lng,
        tariffClass: selectedClasses[0] || 'econom',
        cityCurrency: currentCity.currency
      });
      setSingleTestResult(res);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’appel Yango.');
    } finally {
      setIsTestingSingle(false);
    }
  };

  const estimatedDurationSec = Math.max(3, Math.round((totalPairs * 140) / 1000));

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-rose-500" />
          Lancement d’une Campagne de Pricing
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Sélectionnez la ville cible. Le backend génère automatiquement toutes les paires Départ ➔ Arrivée et interroge l'endpoint Yango <code className="text-rose-400 font-mono">/3.0/routestats</code>.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Setup */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* City Selector Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              1. Choix de la ville d'opération
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {cities.map((city) => {
                const isSelected = city.id === currentCity?.id;
                const cityNbs = neighborhoods.filter(n => n.cityId === city.id && n.active);

                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => {
                      onSelectCityId(city.id);
                      setSingleStartId(cityNbs[0]?.id || '');
                      setSingleEndId(cityNbs[1]?.id || '');
                    }}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-600/10 border-rose-500 text-white shadow-sm ring-1 ring-rose-500'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-white">{city.name}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          city.active ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="text-xs text-slate-400">{city.country}</div>
                    <div className="mt-3 pt-2 border-t border-slate-700/50 flex justify-between text-[11px]">
                      <span className="text-slate-400">Quartiers actifs :</span>
                      <span className="font-semibold text-rose-300">{cityNbs.length}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Combinatorial Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                2. Générateur de Combinaisons (N × N-1)
              </label>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                {totalPairs} requêtes API à exécuter
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Pour <strong className="text-white">{currentCity?.name}</strong>, le système extrait uniquement les <strong>{activeCount} quartiers actifs</strong>. Chaque quartier devient à la fois un point de départ et une destination.
            </p>

            {/* Active Neighborhoods Pills */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {activeNeighborhoods.map((nb) => (
                <span
                  key={nb.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-300"
                >
                  <MapPin className="w-3 h-3 text-rose-400" />
                  <span>{nb.name}</span>
                </span>
              ))}
            </div>

            {/* Preview Pairs Table */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-800 p-3">
              <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Aperçu des premières paires de trajets générées :
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {previewPairs.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-slate-300"
                  >
                    <span className="font-medium text-white truncate max-w-[42%]">{p.origin.name}</span>
                    <span className="text-rose-400 font-bold px-1">➔</span>
                    <span className="font-medium text-white truncate max-w-[42%] text-right">{p.dest.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tariff Class Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              3. Classes tarifaires Yango ciblées
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => toggleClass('econom')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                  selectedClasses.includes('econom')
                    ? 'bg-rose-500/10 border-rose-500 text-white'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border ${
                    selectedClasses.includes('econom')
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'border-slate-600'
                  }`}
                >
                  {selectedClasses.includes('econom') && <CheckCircle className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Économique / Standard (econom)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Tarif d’entrée de gamme le plus représentatif du marché VTC
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleClass('comfort')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                  selectedClasses.includes('comfort')
                    ? 'bg-rose-500/10 border-rose-500 text-white'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border ${
                    selectedClasses.includes('comfort')
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'border-slate-600'
                  }`}
                >
                  {selectedClasses.includes('comfort') && <CheckCircle className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Confort / Berline (comfort)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Véhicules récents avec climatisation garantie
                  </div>
                </div>
              </button>
            </div>
          </div>

        </div>

        {/* Right Col: Summary Card & Instant Route Tester */}
        <div className="space-y-6">
          
          {/* Pre-flight Execution Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl sticky top-20">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-rose-500" />
              Récapitulatif de Lancement
            </h2>

            <div className="space-y-3 text-xs divide-y divide-slate-800">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Ville sélectionnée :</span>
                <span className="font-semibold text-white">{currentCity?.name}</span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Quartiers actifs :</span>
                <span className="font-semibold text-white">{activeCount}</span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Permutations Départ ➔ Arrivée :</span>
                <span className="font-bold text-amber-300 font-mono">{totalPairs}</span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Durée estimée :</span>
                <span className="font-mono text-slate-300">~{estimatedDurationSec} secondes</span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Déclenché par :</span>
                <span className="text-slate-200">{user?.name || 'Administrateur'}</span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Mode d'exécution :</span>
                <span className="text-emerald-400 font-medium">Cloud Functions Batch</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleStartCampaign}
                disabled={isLaunching || activeCount < 2}
                className="w-full bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLaunching ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Lancement en cours...</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5" />
                    <span>Exécuter le Pricing Yango</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 text-[11px] text-slate-400 text-center">
              L'exécution sera visible en direct avec une barre de progression et des logs en temps réel.
            </div>
          </div>

          {/* Quick Single Route Tester Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Test Rapide : 1 Trajet Unitaire
              </h3>
              <span className="text-[10px] text-slate-400">Debug Yango API</span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-400">Départ :</label>
                <select
                  value={singleStartId}
                  onChange={(e) => setSingleStartId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                >
                  {activeNeighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Destination :</label>
                <select
                  value={singleEndId}
                  onChange={(e) => setSingleEndId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                >
                  {activeNeighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleRunSingleTest}
                disabled={isTestingSingle || !singleStartId || !singleEndId || singleStartId === singleEndId}
                className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium py-2 rounded-lg transition disabled:opacity-40"
              >
                {isTestingSingle ? 'Interrogation Yango...' : 'Tester ce trajet unitaire'}
              </button>

              {singleTestResult && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-white">
                    <span>Prix retourné :</span>
                    <span className="text-rose-400">{singleTestResult.priceFormatted}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Distance :</span>
                    <span>{singleTestResult.distanceKm} km</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Durée estimée :</span>
                    <span>{singleTestResult.durationMinutes} min</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Source :</span>
                    <span className="font-mono text-emerald-400">{singleTestResult.source}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
