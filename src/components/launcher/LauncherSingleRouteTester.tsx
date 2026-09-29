import React, { useState } from 'react';
import { Neighborhood } from '../../types';
import { Sparkles, ArrowRight, RotateCw, Layers, Copy, Check } from 'lucide-react';
import { HeroLogo } from '../HeroLogo';

interface LauncherSingleRouteTesterProps {
  activeNeighborhoods: Neighborhood[];
  singleStartId: string;
  onSingleStartChange: (id: string) => void;
  singleEndId: string;
  onSingleEndChange: (id: string) => void;
  isTestingSingle: boolean;
  onRunSingleTest: () => void;
  singleTestResult: any;
}

export const LauncherSingleRouteTester: React.FC<LauncherSingleRouteTesterProps> = ({
  activeNeighborhoods,
  singleStartId,
  onSingleStartChange,
  singleEndId,
  onSingleEndChange,
  isTestingSingle,
  onRunSingleTest,
  singleTestResult
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyProviderData = (key: 'yango' | 'hero' | 'tripmaster') => {
    let payload = '';
    if (key === 'yango') {
      const data = singleTestResult?.yango?.rawJson || singleTestResult?.yango || singleTestResult?.rawResponse;
      payload = typeof data === 'string' ? data : JSON.stringify(data || singleTestResult, null, 2);
    } else if (key === 'hero') {
      const data = singleTestResult?.heroCab?.rawText || singleTestResult?.heroCab?.rawResponse || singleTestResult?.heroCab || singleTestResult?.hero;
      payload = typeof data === 'string' ? data : JSON.stringify(data || {}, null, 2);
    } else if (key === 'tripmaster') {
      const data = singleTestResult?.tripMaster?.rawText || singleTestResult?.tripMaster?.rawResponse || singleTestResult?.tripMaster;
      payload = typeof data === 'string' ? data : JSON.stringify(data || {}, null, 2);
    }

    navigator.clipboard.writeText(payload);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };
  // Extract Yango prices
  const yEco = singleTestResult?.yango?.classes?.econom?.price || singleTestResult?.priceEconom || singleTestResult?.price;
  const yConf = singleTestResult?.yango?.classes?.business?.price || singleTestResult?.yango?.classes?.comfort?.price || singleTestResult?.priceConfort;
  const yConfPlus = singleTestResult?.yango?.classes?.comfortplus?.price || singleTestResult?.priceConfortPlus;
  const yMoto = singleTestResult?.yango?.classes?.moto?.price || singleTestResult?.priceMoto;

  // Extract Hero Cab prices
  const hStd = singleTestResult?.hero?.priceStandard || singleTestResult?.priceHeroStandard || singleTestResult?.priceHero;
  const hConf = singleTestResult?.hero?.priceConfort || singleTestResult?.priceHeroConfort;
  const hSuv = singleTestResult?.hero?.priceSuv || singleTestResult?.priceHeroSuv;
  const hPerKm = singleTestResult?.hero?.pricePerKm || singleTestResult?.priceHeroPerKm;

  // Extract Trip Master prices
  const tmEco = singleTestResult?.tripMaster?.priceEco || singleTestResult?.priceTripMaster;
  const tmConf = singleTestResult?.tripMaster?.priceConfort || singleTestResult?.priceTripMasterConfort;
  const tmMoto = singleTestResult?.tripMaster?.priceMoto || singleTestResult?.priceTripMasterMoto;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#1F4F4A]" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Test Rapide d'un Trajet Unitaire (3 Agrégateurs Live)
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <div className="sm:col-span-4">
          <label htmlFor="launcher-single-origin" className="block text-[11px] font-semibold text-slate-600 mb-1">
            Départ
          </label>
          <select
            id="launcher-single-origin"
            value={singleStartId}
            onChange={(e) => onSingleStartChange(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#3D8B85]"
          >
            {activeNeighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>

        <div className="hidden sm:flex sm:col-span-1 justify-center pb-2 text-slate-400">
          <ArrowRight className="w-4 h-4" />
        </div>

        <div className="sm:col-span-4">
          <label htmlFor="launcher-single-dest" className="block text-[11px] font-semibold text-slate-600 mb-1">
            Destination
          </label>
          <select
            id="launcher-single-dest"
            value={singleEndId}
            onChange={(e) => onSingleEndChange(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#3D8B85]"
          >
            {activeNeighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <button
            onClick={onRunSingleTest}
            disabled={isTestingSingle || singleStartId === singleEndId}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            {isTestingSingle ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Calcul...</span>
              </>
            ) : (
              <span>Tester Trajet</span>
            )}
          </button>
        </div>
      </div>

      {singleTestResult && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
          <div className="text-xs text-slate-600 pb-2 border-b border-slate-100 flex items-center justify-between">
            <span>Distance & Durée estimées :</span>
            <strong className="text-slate-900 font-mono font-bold">
              {singleTestResult.distanceKm} km (~{singleTestResult.durationMinutes} min)
            </strong>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Yango */}
            <div className="p-3 bg-red-50/40 border border-red-200/80 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-red-200/60">
                <strong className="text-red-900 font-bold uppercase text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> Yango
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
                  <span className="text-[10px] text-red-600 font-medium">4 Classes</span>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Éco :</span>
                  <strong className="font-mono font-bold text-slate-900">
                    {yEco ? `${yEco.toLocaleString('fr-FR')} F` : '—'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Confort :</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {yConf ? `${yConf.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Confort+ :</span>
                  <span className="font-mono text-slate-700">
                    {yConfPlus ? `${yConfPlus.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Moto :</span>
                  <span className="font-mono text-slate-700">
                    {yMoto ? `${yMoto.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hero Cab */}
            <div className="p-3 bg-teal-50/40 border border-teal-200/80 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-teal-200/60">
                <strong className="text-teal-900 font-bold uppercase text-[11px] flex items-center gap-1">
                  <HeroLogo className="w-3 h-3 text-teal-700" /> Hero Cab
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
                  <span className="text-[10px] text-teal-700 font-medium">4 Classes</span>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Standard :</span>
                  <strong className="font-mono font-bold text-teal-800">
                    {hStd ? `${hStd.toLocaleString('fr-FR')} F` : '—'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Confort :</span>
                  <span className="font-mono text-teal-700 font-semibold">
                    {hConf ? `${hConf.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SUV :</span>
                  <span className="font-mono text-slate-700">
                    {hSuv ? `${hSuv.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Per Km :</span>
                  <span className="font-mono text-slate-700">
                    {hPerKm ? `${hPerKm.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trip Master */}
            <div className="p-3 bg-purple-50/40 border border-purple-200/80 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-purple-200/60">
                <strong className="text-purple-900 font-bold uppercase text-[11px] flex items-center gap-1">
                  <Layers className="w-3 h-3 text-purple-700" /> Trip Master
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
                  <span className="text-[10px] text-purple-700 font-medium">3 Classes</span>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Éco :</span>
                  <strong className="font-mono font-bold text-purple-900">
                    {tmEco ? `${tmEco.toLocaleString('fr-FR')} F` : '—'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Confort :</span>
                  <span className="font-mono text-purple-800 font-semibold">
                    {tmConf ? `${tmConf.toLocaleString('fr-FR')} F` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
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
