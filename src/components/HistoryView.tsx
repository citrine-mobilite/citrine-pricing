import React, { useState } from 'react';
import { City, PricingCampaign } from '../types';
import { DataTable, Column } from './DataTable';
import {
  History,
  Building2,
  CheckCircle2,
  RotateCw,
  ArrowRight,
  Filter,
  Clock
} from 'lucide-react';

interface HistoryViewProps {
  campaigns: PricingCampaign[];
  cities: City[];
  onSelectCampaign: (campaignId: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  campaigns,
  cities,
  onSelectCampaign,
  onNavigate,
  onRefresh
}) => {
  const [cityFilter, setCityFilter] = useState<string>('');
  const [modeFilter, setModeFilter] = useState<string>('');

  const filteredCampaigns = campaigns.filter((c) => {
    if (cityFilter && c.cityId !== cityFilter) return false;
    if (modeFilter && c.triggerType !== modeFilter) return false;
    return true;
  });

  const columns: Column<PricingCampaign>[] = [
    {
      key: 'startedAt',
      label: 'Date & Heure',
      sortable: true,
      render: (c) => (
        <span className="font-mono text-slate-700 text-[11px]">
          {new Date(c.startedAt).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      ),
      exportValue: (c) => new Date(c.startedAt).toISOString()
    },
    {
      key: 'cityName',
      label: 'Ville',
      sortable: true,
      render: (c) => (
        <span className="font-semibold text-slate-900">{c.cityName}</span>
      )
    },
    {
      key: 'triggerType',
      label: 'Déclencheur',
      sortable: true,
      render: (c) => (
        <div className="flex flex-col">
          <span
            className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[11px] font-medium ${
              c.triggerType === 'scheduled'
                ? 'bg-slate-100 text-slate-700'
                : 'bg-[#F0FAFA] text-[#1F4F4A] border border-[#3D8B85]/20'
            }`}
          >
            {c.triggerType === 'scheduled' ? 'Automatique' : 'Manuel'}
          </span>
          {c.triggerType === 'manual' && c.triggeredByUserName && (
            <span className="text-[10px] text-slate-500 mt-0.5">
              par {c.triggeredByUserName}
            </span>
          )}
        </div>
      ),
      exportValue: (c) =>
        c.triggerType === 'scheduled'
          ? 'Automatique'
          : `Manuel (${c.triggeredByUserName || 'Opérateur'})`
    },
    {
      key: 'durationSeconds',
      label: 'Durée',
      sortable: true,
      render: (c) => {
        const dur = c.durationSeconds || 0;
        const formatDur = (s: number) => {
          if (!s || s <= 0) return '< 1s';
          if (s < 60) return `${s}s`;
          const m = Math.floor(s / 60);
          const rem = s % 60;
          return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
        };
        return (
          <span className="inline-flex items-center gap-1 text-slate-700 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{formatDur(dur)}</span>
          </span>
        );
      },
      exportValue: (c) => `${c.durationSeconds || 0}s`
    },
    {
      key: 'completedPairs',
      label: 'Trajets',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-medium text-slate-800">
          {c.completedPairs} / {c.totalPairs}
        </span>
      ),
      exportValue: (c) => `${c.completedPairs}/${c.totalPairs}`
    },
    {
      key: 'selectedClasses',
      label: 'Classes Relevées',
      render: () => (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            🚗 Éco
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
            ✨ Confort
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
            💎 Confort+
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
            🏍️ Moto
          </span>
        </div>
      ),
      exportValue: () => 'Éco, Confort, Confort+, Moto'
    },
    {
      key: 'avgPrice',
      label: 'Prix Moyen',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-semibold text-slate-900">
          {c.avgPrice ? `${c.avgPrice.toLocaleString('fr-FR')} FCFA` : '-'}
        </span>
      ),
      exportValue: (c) => (c.avgPrice ? `${c.avgPrice} FCFA` : '')
    },
    {
      key: 'minPrice',
      label: 'Min / Max',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="text-slate-600 text-[11px] font-mono">
          {c.minPrice ? `${c.minPrice.toLocaleString('fr-FR')} - ${c.maxPrice?.toLocaleString('fr-FR')}` : '-'}
        </span>
      ),
      exportValue: (c) => (c.minPrice ? `${c.minPrice} - ${c.maxPrice}` : '')
    },
    {
      key: 'durationSeconds',
      label: 'Durée',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="text-slate-500 font-mono text-[11px]">
          {c.durationSeconds ? `${c.durationSeconds}s` : '-'}
        </span>
      ),
      exportValue: (c) => (c.durationSeconds ? `${c.durationSeconds}s` : '')
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      align: 'center',
      render: (c) => (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Conforme
        </span>
      ),
      exportValue: (c) => c.status
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (c) => (
        <button
          onClick={() => {
            onSelectCampaign(c.id);
            onNavigate('pricing');
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
        >
          <span>Consulter</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      ),
      exportValue: () => ''
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Historique des Pricings
        </h1>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-600"
          >
            <option value="">Toutes les villes (Cameroun)</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-600"
          >
            <option value="">Tous les modes</option>
            <option value="scheduled">Automatique (Programmé)</option>
            <option value="manual">Manuel</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          <strong className="font-semibold text-slate-900">{filteredCampaigns.length}</strong>{' '}
          campagnes archivées
        </div>
      </div>

      {/* Modern Compact DataTable */}
      <DataTable
        columns={columns}
        data={filteredCampaigns}
        searchPlaceholder="Rechercher dans l'historique..."
        searchKeys={['cityName', 'triggerType', 'status']}
        exportFileName="historique_pricing_citrine"
        exportTitle="Historique des Relevés Tarifaires VTC - Citrine Pricing"
        exportSubtitle="Données collectées via Yango Routestats (Cameroun)"
        pageSizeOptions={[25, 50, 100, 250]}
        defaultPageSize={25}
        emptyMessage="Aucun historique correspondant aux filtres."
      />

    </div>
  );
};
