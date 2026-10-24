import React from 'react';
import { PricingStatsSummary } from './pricingUtils';
import { Layers, Award, Sparkles, Filter, RotateCcw } from 'lucide-react';
import { HeroLogo } from '../HeroLogo';

interface PricingMetricsCardsProps {
  stats: PricingStatsSummary;
  currencySymbol: string;
  isFiltered?: boolean;
  totalUnfilteredTrips?: number;
  onResetFilters?: () => void;
}

export const PricingMetricsCards: React.FC<PricingMetricsCardsProps> = ({
  stats,
  currencySymbol,
  isFiltered = false,
  totalUnfilteredTrips = 0,
  onResetFilters
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Filter className={`w-3.5 h-3.5 ${isFiltered ? 'text-amber-600' : 'text-[#1F4F4A]'}`} />
          <span className="text-xs font-bold text-slate-700">
            {isFiltered
              ? `Statistiques Filtrées (${stats.totalTrips.toLocaleString('fr-FR')} / ${totalUnfilteredTrips.toLocaleString('fr-FR')} trajets)`
              : `Statistiques du Relevé (${stats.totalTrips.toLocaleString('fr-FR')} trajets)`}
          </span>
          {isFiltered && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Filtre actif
            </span>
          )}
        </div>
        {isFiltered && onResetFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Afficher le global ({totalUnfilteredTrips})</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Card 1 : Yango Benchmark */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Yango
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            {stats.yango.eco.count} trajets
          </span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Moyenne Éco :</span>
            <span className="font-mono font-bold text-slate-900">
              {stats.yango.eco.avg > 0 ? `${stats.yango.eco.avg.toLocaleString('fr-FR')} ${currencySymbol}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] text-slate-400">Confort :</span>
            <span className="font-mono text-[11px]">
              {stats.yango.confort.avg > 0 ? `${stats.yango.confort.avg.toLocaleString('fr-FR')} ${currencySymbol}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] text-slate-400">Confort+ / Moto :</span>
            <span className="font-mono text-[11px]">
              {stats.yango.confortPlus.avg > 0 ? `${stats.yango.confortPlus.avg.toLocaleString('fr-FR')}` : '—'} /{' '}
              {stats.yango.moto.avg > 0 ? `${stats.yango.moto.avg.toLocaleString('fr-FR')} ${currencySymbol}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Card 2 : Hero Cab Benchmark */}
      <div className="bg-white rounded-xl border border-teal-200/80 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] bg-gradient-to-b from-teal-50/20 to-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <HeroLogo className="w-4 h-4 text-teal-700" />
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
              Hero Cab
            </span>
          </div>
          <span className="text-[10px] font-medium text-teal-600">
            {stats.hero.eco.count} trajets
          </span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Moyenne Standard :</span>
            <span className="font-mono font-bold text-teal-700">
              {stats.hero.eco.avg > 0 ? `${stats.hero.eco.avg.toLocaleString('fr-FR')} ${currencySymbol}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] text-slate-400">Confort / SUV :</span>
            <span className="font-mono text-[11px]">
              {stats.hero.confort.avg > 0 ? `${stats.hero.confort.avg.toLocaleString('fr-FR')}` : '—'} /{' '}
              {stats.hero.suv.avg > 0 ? `${stats.hero.suv.avg.toLocaleString('fr-FR')} ${currencySymbol}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] text-slate-400">Tarif Km :</span>
            <span className="font-mono text-[11px]">
              {stats.hero.perKm.avg > 0 ? `${stats.hero.perKm.avg.toLocaleString('fr-FR')} ${currencySymbol}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Card 3 : Trip Master Benchmark */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Trip Master
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            {stats.tripMaster.eco.count} trajets
          </span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Moyenne Éco :</span>
            <span className="font-mono font-bold text-purple-700">
              {stats.tripMaster.eco.avg > 0 ? `${stats.tripMaster.eco.avg.toLocaleString('fr-FR')} ${currencySymbol}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] text-slate-400">Confort :</span>
            <span className="font-mono text-[11px]">
              {stats.tripMaster.confort.avg > 0 ? `${stats.tripMaster.confort.avg.toLocaleString('fr-FR')} ${currencySymbol}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] text-slate-400">Moto :</span>
            <span className="font-mono text-[11px]">
              {stats.tripMaster.moto.avg > 0 ? `${stats.tripMaster.moto.avg.toLocaleString('fr-FR')} ${currencySymbol}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Card 4 : Compétitivité & Victoires */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Compétitivité
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            Sur {stats.totalTrips} trajets
          </span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-teal-600" /> Hero Cab - cher :
            </span>
            <span className="font-bold text-teal-700 font-mono">
              {stats.heroWins} ({stats.totalTrips > 0 ? Math.round((stats.heroWins / stats.totalTrips) * 100) : 0}%)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Yango - cher :</span>
            <span className="font-bold text-slate-700 font-mono">
              {stats.yangoWins} ({stats.totalTrips > 0 ? Math.round((stats.yangoWins / stats.totalTrips) * 100) : 0}%)
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
