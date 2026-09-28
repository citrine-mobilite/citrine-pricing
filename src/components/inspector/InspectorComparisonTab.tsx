import React from 'react';
import { TripResult } from '../../types';
import { HeroLogo } from '../HeroLogo';
import { Layers, Award, Sparkles } from 'lucide-react';

interface InspectorComparisonTabProps {
  trip: TripResult;
  pYangoEco: number | null | undefined;
  pYangoConf: number | null | undefined;
  pYangoConfPlus?: number | null | undefined;
  pYangoMoto?: number | null | undefined;
  pHeroEco: number | null | undefined;
  pHeroConf: number | null | undefined;
  pHeroSuv?: number | null | undefined;
  pTripMasterEco: number | null | undefined;
  pTripMasterConf: number | null | undefined;
  pTripMasterMoto: number | null | undefined;
}

export const InspectorComparisonTab: React.FC<InspectorComparisonTabProps> = ({
  trip,
  pYangoEco,
  pYangoConf,
  pYangoConfPlus,
  pYangoMoto,
  pHeroEco,
  pHeroConf,
  pHeroSuv,
  pTripMasterEco,
  pTripMasterConf,
  pTripMasterMoto
}) => {
  return (
    <div className="space-y-4">
      {/* 3 Columns for 3 Providers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Yango */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
              <strong className="text-xs font-bold text-slate-800 uppercase">Yango</strong>
            </div>
            <span className="text-[10px] text-slate-400">Routestats API</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tarif Éco :</span>
              <strong className="font-mono font-bold text-slate-900">
                {pYangoEco ? `${pYangoEco.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tarif Confort :</span>
              <strong className="font-mono text-slate-700">
                {pYangoConf ? `${pYangoConf.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tarif Confort+ :</span>
              <strong className="font-mono text-slate-700">
                {pYangoConfPlus ? `${pYangoConfPlus.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tarif Moto :</span>
              <strong className="font-mono text-slate-700">
                {pYangoMoto ? `${pYangoMoto.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
          </div>
        </div>

        {/* Hero Cab */}
        <div className="bg-teal-50/40 border border-teal-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-teal-200">
            <div className="flex items-center gap-1.5">
              <HeroLogo className="w-3.5 h-3.5 text-teal-700" />
              <strong className="text-xs font-bold text-teal-900 uppercase">Hero Cab</strong>
            </div>
            <span className="text-[10px] text-teal-600">Dispatcher API</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Standard :</span>
              <strong className="font-mono font-bold text-teal-800">
                {pHeroEco ? `${pHeroEco.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Confort :</span>
              <strong className="font-mono text-teal-700">
                {pHeroConf ? `${pHeroConf.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">SUV :</span>
              <strong className="font-mono text-teal-700">
                {pHeroSuv ? `${pHeroSuv.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
          </div>
        </div>

        {/* Trip Master */}
        <div className="bg-purple-50/40 border border-purple-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-purple-200">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-700" />
              <strong className="text-xs font-bold text-purple-900 uppercase">Trip Master</strong>
            </div>
            <span className="text-[10px] text-purple-600">Simulateur API</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Éco :</span>
              <strong className="font-mono font-bold text-purple-800">
                {pTripMasterEco ? `${pTripMasterEco.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Confort :</span>
              <strong className="font-mono text-purple-700">
                {pTripMasterConf ? `${pTripMasterConf.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Moto :</span>
              <strong className="font-mono text-purple-700">
                {pTripMasterMoto ? `${pTripMasterMoto.toLocaleString('fr-FR')} FCFA` : '—'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Delta & Winning Provider */}
      {trip.cheaperProvider && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-slate-800">Offre la plus compétitive :</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                trip.cheaperProvider === 'hero'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {trip.cheaperProvider === 'hero' ? 'Hero Cab' : 'Yango'}
            </span>
          </div>

          {trip.deltaPriceYangoVsHero !== undefined && (
            <span className="font-mono text-slate-600">
              Écart de prix : <strong>{Math.abs(trip.deltaPriceYangoVsHero)} FCFA</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
