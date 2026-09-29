import React, { useState } from 'react';
import { Neighborhood } from '../../types';
import { SlidersHorizontal, ArrowRight, RotateCw, Code, Layers, Copy, Check } from 'lucide-react';
import { HeroLogo } from '../HeroLogo';

interface PricingQuickTesterProps {
  cityActiveNeighborhoods: Neighborhood[];
  quickOriginId: string;
  onQuickOriginChange: (id: string) => void;
  quickDestId: string;
  onQuickDestChange: (id: string) => void;
  isQuickTesting: boolean;
  onRunQuickTest: () => void;
  quickTestResult: any;
  onInspectResult: () => void;
}

export const PricingQuickTester: React.FC<PricingQuickTesterProps> = ({
  cityActiveNeighborhoods,
  quickOriginId,
  onQuickOriginChange,
  quickDestId,
  onQuickDestChange,
  isQuickTesting,
  onRunQuickTest,
  quickTestResult,
  onInspectResult
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyProviderData = (key: 'yango' | 'hero' | 'tripmaster') => {
    let payload = '';
    if (key === 'yango') {
      const data = quickTestResult?.yango?.rawJson || quickTestResult?.yango || quickTestResult?.rawResponse;
      payload = typeof data === 'string' ? data : JSON.stringify(data || quickTestResult, null, 2);
    } else if (key === 'hero') {
      const data = quickTestResult?.heroCab?.rawText || quickTestResult?.heroCab?.rawResponse || quickTestResult?.heroCab || quickTestResult?.hero;
      payload = typeof data === 'string' ? data : JSON.stringify(data || {}, null, 2);
    } else if (key === 'tripmaster') {
      const data = quickTestResult?.tripMaster?.rawText || quickTestResult?.tripMaster?.rawResponse || quickTestResult?.tripMaster;
      payload = typeof data === 'string' ? data : JSON.stringify(data || {}, null, 2);
    }

    navigator.clipboard.writeText(payload);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };
  // Extract Yango prices
  const yEco = quickTestResult?.yango?.classes?.econom?.price || quickTestResult?.priceEconom || quickTestResult?.price;
  const yConf = quickTestResult?.yango?.classes?.business?.price || quickTestResult?.yango?.classes?.comfort?.price || quickTestResult?.priceConfort;
  const yConfPlus = quickTestResult?.yango?.classes?.comfortplus?.price || quickTestResult?.priceConfortPlus;
  const yMoto = quickTestResult?.yango?.classes?.moto?.price || quickTestResult?.priceMoto;

  // Extract Hero Cab prices
  const hStd = quickTestResult?.hero?.priceStandard || quickTestResult?.priceHeroStandard || quickTestResult?.priceHero;
  const hConf = quickTestResult?.hero?.priceConfort || quickTestResult?.priceHeroConfort;
  const hSuv = quickTestResult?.hero?.priceSuv || quickTestResult?.priceHeroSuv;
  const hPerKm = quickTestResult?.hero?.pricePerKm || quickTestResult?.priceHeroPerKm;

  // Extract Trip Master prices
  const tmEco = quickTestResult?.tripMaster?.priceEco || quickTestResult?.priceTripMaster;
  const tmConf = quickTestResult?.tripMaster?.priceConfort || quickTestResult?.priceTripMasterConfort;
  const tmMoto = quickTestResult?.tripMaster?.priceMoto || quickTestResult?.priceTripMasterMoto;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#1F4F4A]" />
          <span>Simulateur Direct : Tester un trajet spécifique en temps réel</span>
        </h3>
        <span className="text-[11px] text-slate-500">
          Interrogation simultanée en direct : Yango, Hero Cab & Trip Master
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        {/* Origin */}
        <div className="sm:col-span-4">
          <label htmlFor="quick-origin-select" className="block text-[11px] font-semibold text-slate-600 mb-1">
            Départ (Quartier)
          </label>
          <select
            id="quick-origin-select"
            value={quickOriginId}
            onChange={(e) => onQuickOriginChange(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#3D8B85]"
          >
            {cityActiveNeighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        {/* Arrow separator */}
        <div className="hidden sm:flex sm:col-span-1 justify-center pb-2 text-slate-400">
          <ArrowRight className="w-4 h-4" />
        </div>

        {/* Destination */}
        <div className="sm:col-span-4">
          <label htmlFor="quick-dest-select" className="block text-[11px] font-semibold text-slate-600 mb-1">
            Destination (Quartier)
          </label>
          <select
            id="quick-dest-select"
            value={quickDestId}
            onChange={(e) => onQuickDestChange(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#3D8B85]"
          >
            {cityActiveNeighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        <div className="sm:col-span-3">
          <button
            onClick={onRunQuickTest}
            disabled={isQuickTesting || quickOriginId === quickDestId}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isQuickTesting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Interrogation...</span>
              </>
            ) : (
              <span>Calculer le Prix</span>
            )}
          </button>
        </div>
      </div>

      {/* Quick Test Result Summary Card */}
      {quickTestResult && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Distance & Durée :</span>
              <strong className="text-slate-900 font-mono">
                {quickTestResult.distanceKm} km (~{quickTestResult.durationMinutes} min)
              </strong>
            </div>

            <button
              onClick={onInspectResult}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
            >
              <Code className="w-3.5 h-3.5 text-slate-500" />
              <span>Inspecter JSON complet</span>
            </button>
          </div>

          {/* 3 Provider Cards with All Available Classes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Yango */}
            <div className="p-3 bg-red-50/40 border border-red-200/80 rounded-lg space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-red-200/60">
                <strong className="text-red-900 font-bold uppercase text-[11px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> Yango (4 Classes)
                </strong>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyProviderData('yango')}
                    title="Copier la réponse brute Yango"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition cursor-pointer"
                  >
                    {copiedKey === 'yango' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'yango' ? 'Copié !' : 'Copier'}</span>
                  </button>
                  <span className="text-[10px] text-red-600 font-medium bg-red-100/60 px-1.5 py-0.5 rounded">Live</span>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Éco :</span>
                  <strong className="font-mono font-bold text-slate-900">
                    {yEco ? `${yEco.toLocaleString('fr-FR')} F` : '—'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Confort :</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {yConf ? `${yConf.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Confort+ :</span>
                  <span className="font-mono text-slate-700">
                    {yConfPlus ? `${yConfPlus.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Moto :</span>
                  <span className="font-mono text-slate-700">
                    {yMoto ? `${yMoto.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hero Cab */}
            <div className="p-3 bg-teal-50/40 border border-teal-200/80 rounded-lg space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-teal-200/60">
                <strong className="text-teal-900 font-bold uppercase text-[11px] flex items-center gap-1.5">
                  <HeroLogo className="w-3 h-3 text-teal-700" /> Hero Cab (4 Classes)
                </strong>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyProviderData('hero')}
                    title="Copier la réponse brute Hero Cab"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-teal-800 bg-teal-100 hover:bg-teal-200 rounded transition cursor-pointer"
                  >
                    {copiedKey === 'hero' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'hero' ? 'Copié !' : 'Copier'}</span>
                  </button>
                  <span className="text-[10px] text-teal-700 font-medium bg-teal-100/60 px-1.5 py-0.5 rounded">Live</span>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Standard :</span>
                  <strong className="font-mono font-bold text-teal-800">
                    {hStd ? `${hStd.toLocaleString('fr-FR')} F` : '—'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Confort :</span>
                  <span className="font-mono text-teal-700 font-semibold">
                    {hConf ? `${hConf.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">SUV :</span>
                  <span className="font-mono text-slate-700">
                    {hSuv ? `${hSuv.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Per Km :</span>
                  <span className="font-mono text-slate-700">
                    {hPerKm ? `${hPerKm.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trip Master */}
            <div className="p-3 bg-purple-50/40 border border-purple-200/80 rounded-lg space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-purple-200/60">
                <strong className="text-purple-900 font-bold uppercase text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-purple-700" /> Trip Master (3 Classes)
                </strong>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyProviderData('tripmaster')}
                    title="Copier la réponse brute Trip Master"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-purple-800 bg-purple-100 hover:bg-purple-200 rounded transition cursor-pointer"
                  >
                    {copiedKey === 'tripmaster' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'tripmaster' ? 'Copié !' : 'Copier'}</span>
                  </button>
                  <span className="text-[10px] text-purple-700 font-medium bg-purple-100/60 px-1.5 py-0.5 rounded">Live</span>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Éco :</span>
                  <strong className="font-mono font-bold text-purple-900">
                    {tmEco ? `${tmEco.toLocaleString('fr-FR')} F` : '—'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Confort :</span>
                  <span className="font-mono text-purple-800 font-semibold">
                    {tmConf ? `${tmConf.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Moto :</span>
                  <span className="font-mono text-slate-700">
                    {tmMoto ? `${tmMoto.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
