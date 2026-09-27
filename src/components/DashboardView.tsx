import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { City, PricingCampaign } from '../types';
import { api } from '../services/api';
import {
  Building2,
  Clock,
  Activity,
  Compass,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Play,
  RotateCw,
  Zap,
  X
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
  const [selectedCityForLaunch, setSelectedCityForLaunch] = useState<City | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const activeCities = cities.filter((c) => c.active);
  const activeCampaigns = campaigns.filter((c) => c.status === 'in_progress');
  const lastCampaign = campaigns[0] || null;

  const handleLaunchChoice = async (cityId: string, mode: 'navigate' | 'sample_25' | 'full') => {
    const targetCity = cities.find(c => c.id === cityId);
    if (!targetCity || !targetCity.active) {
      Swal.fire({
        icon: 'warning',
        title: 'Ville inactive',
        text: 'Impossible de lancer un pricing sur une ville inactive.',
        confirmButtonColor: '#1F4F4A'
      });
      setSelectedCityForLaunch(null);
      return;
    }

    if (mode === 'navigate') {
      setSelectedCityForLaunch(null);
      onLaunchCity(cityId);
      return;
    }

    setIsLaunching(true);
    try {
      await api.startCampaign({
        cityId,
        triggerType: 'manual',
        selectedClasses: ['econom'],
        sampleLimit: mode === 'sample_25' ? 25 : 'all'
      });
      setSelectedCityForLaunch(null);
      onLaunchCity(cityId);
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur au lancement',
        text: err.message || 'Erreur lors du lancement de la tarification.',
        confirmButtonColor: '#DC2626'
      });
    } finally {
      setIsLaunching(false);
    }
  };

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

      {/* 4 Sober, Clean KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
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

      {/* Direct City Pricing Section */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#1F4F4A]" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Lancement direct du pricing par ville
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            {activeCities.length} ville{activeCities.length > 1 ? 's' : ''} disponible{activeCities.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeCities.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition"
            >
              <div>
                <div className="text-sm font-bold text-slate-900">{c.name}</div>
                <div className="text-[11px] text-slate-500">Cameroun • {c.currency}</div>
              </div>
              <button
                onClick={() => setSelectedCityForLaunch(c)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#183F3B] rounded-lg shadow-xs transition cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Lancer</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* City Launch Modal in Dashboard */}
      {selectedCityForLaunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Lancer le pricing : {selectedCityForLaunch.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choisissez le mode de tarification souhaité
                </p>
              </div>
              <button
                onClick={() => setSelectedCityForLaunch(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 pt-2">
              {/* Option 1: Test Rapide 25 */}
              <button
                onClick={() => handleLaunchChoice(selectedCityForLaunch.id, 'sample_25')}
                disabled={isLaunching}
                className="w-full text-left p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 fill-amber-500 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      ⚡ Test Rapide (25 trajets)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Échantillon instantané pour vérifier les tarifs en direct
                    </div>
                  </div>
                </div>
                <Play className="w-3.5 h-3.5 text-amber-700 group-hover:translate-x-0.5 transition" />
              </button>

              {/* Option 2: Campagne Complète */}
              <button
                onClick={() => handleLaunchChoice(selectedCityForLaunch.id, 'full')}
                disabled={isLaunching}
                className="w-full text-left p-3.5 rounded-xl border border-[#3D8B85]/30 bg-[#F0FAFA] hover:bg-[#E2F5F3] transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#3D8B85]/20 text-[#1F4F4A] flex items-center justify-center shrink-0">
                    <Play className="w-4 h-4 fill-current text-[#1F4F4A]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      🚀 Campagne Complète (tous les trajets)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Relevé exhaustif de toutes les permutations en parallèle
                    </div>
                  </div>
                </div>
                <Play className="w-3.5 h-3.5 text-[#1F4F4A] group-hover:translate-x-0.5 transition" />
              </button>

              {/* Option 3: Ouvrir la page Pricing */}
              <button
                onClick={() => handleLaunchChoice(selectedCityForLaunch.id, 'navigate')}
                disabled={isLaunching}
                className="w-full text-center py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Ouvrir la page Pricing pour configurer d'abord
              </button>
            </div>
          </div>
        </div>
      )}

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
