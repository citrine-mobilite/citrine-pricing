import React from 'react';
import { City, PricingCampaign } from '../types';
import {
  Building2,
  Clock,
  Activity,
  Compass,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Play,
  RotateCw
} from 'lucide-react';
import { DataTable, Column } from './DataTable';

interface DashboardViewProps {
  cities: City[];
  campaigns: PricingCampaign[];
  onNavigate: (tab: string) => void;
  onSelectCampaign: (campaignId: string) => void;
  onLaunchCity: (cityId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  cities,
  campaigns,
  onNavigate,
  onSelectCampaign,
  onLaunchCity
}) => {
  const activeCities = cities.filter((c) => c.active);
  const activeCampaigns = campaigns.filter((c) => c.status === 'in_progress');
  const lastCampaign = campaigns[0] || null;

  const totalTrips = campaigns.reduce(
    (acc, curr) => acc + (curr.completedPairs || 0),
    0
  );

  const totalErrors = campaigns.reduce(
    (acc, curr) => acc + (curr.failedPairs || 0),
    0
  );

  // DataTable columns for recent activity
  const columns: Column<PricingCampaign>[] = [
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
      key: 'startedAt',
      label: 'Horodatage',
      sortable: true,
      render: (c) => (
        <span className="text-slate-600 font-mono text-[11px]">
          {new Date(c.startedAt).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      ),
      exportValue: (c) => new Date(c.startedAt).toISOString()
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
      key: 'status',
      label: 'Statut',
      sortable: true,
      align: 'center',
      render: (c) => {
        if (c.status === 'completed') {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Terminée
            </span>
          );
        }
        if (c.status === 'in_progress') {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
              <RotateCw className="w-3 h-3 animate-spin text-amber-600" />
              En cours
            </span>
          );
        }
        return (
          <span className="text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
            Erreur
          </span>
        );
      },
      exportValue: (c) => c.status
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (c) => (
        <button
          onClick={() => onSelectCampaign(c.id)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
        >
          <span>Détails</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      ),
      exportValue: () => ''
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Page Title - Clean without commentary */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Vue d'ensemble
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('pricing')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Nouveau pricing</span>
          </button>
        </div>
      </div>

      {/* 5 Sober, Clean KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Active Cities */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Villes actives
            </span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">
              {activeCities.length}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              / {cities.length}
            </span>
          </div>
        </div>

        {/* Last Pricing */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Dernier pricing
            </span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-bold text-slate-900 truncate">
              {lastCampaign ? lastCampaign.cityName : 'Aucun'}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {lastCampaign
                ? new Date(lastCampaign.startedAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '-'}
            </div>
          </div>
        </div>

        {/* In progress campaigns */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              En cours
            </span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {activeCampaigns.length}
            </span>
            <span className="text-xs text-slate-400">
              {activeCampaigns.length > 0 ? 'Traitement Yango' : 'Au repos'}
            </span>
          </div>
        </div>

        {/* Trajets analysés */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Trajets analysés
            </span>
            <Compass className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">
              {totalTrips.toLocaleString('fr-FR')}
            </span>
            <span className="text-xs text-slate-400">paires</span>
          </div>
        </div>

        {/* Erreurs éventuelles */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Erreurs Yango
            </span>
            <AlertCircle
              className={`w-4 h-4 ${
                totalErrors > 0 ? 'text-rose-500' : 'text-slate-400'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold ${
                totalErrors > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {totalErrors}
            </span>
            <span className="text-xs text-slate-400">
              {totalErrors === 0 ? '100% succès' : 'échecs API'}
            </span>
          </div>
        </div>

      </div>

      {/* Activité récente DataTable */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">
            Activité récente
          </h2>
          <button
            onClick={() => onNavigate('campaigns')}
            className="text-xs font-medium text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
          >
            Toutes les campagnes →
          </button>
        </div>

        <DataTable
          columns={columns}
          data={campaigns}
          searchPlaceholder="Filtrer l'activité par ville, statut..."
          searchKeys={['cityName', 'status', 'triggerType']}
          exportFileName="activite_pricing_citrine"
          exportTitle="Historique Récent des Campagnes - Citrine Pricing"
          exportSubtitle="Plateforme VTC Cameroun"
          pageSizeOptions={[25, 50, 100, 250]}
          defaultPageSize={25}
          emptyMessage="Aucune campagne enregistrée pour le moment."
        />
      </div>

    </div>
  );
};
