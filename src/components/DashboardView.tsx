import React, { useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { City, PricingCampaign } from '../types';
import { api } from '../services/api';
import { ArrowRight, Activity, Trash2 } from 'lucide-react';
import { DataTable, Column } from './DataTable';
import { DashboardMetricCards } from './dashboard/DashboardMetricCards';
import { DashboardCityCardsGrid } from './dashboard/DashboardCityCardsGrid';
import { CityLaunchChoiceModal } from './cities/CityLaunchChoiceModal';

interface DashboardViewProps {
  cities: City[];
  campaigns: PricingCampaign[];
  onNavigate: (tab: string) => void;
  onSelectCampaign: (campaignId: string) => void;
  onLaunchCity: (cityId: string) => void;
  onRefresh?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  cities,
  campaigns,
  onNavigate,
  onSelectCampaign,
  onLaunchCity,
  onRefresh
}) => {
  const [selectedCityForLaunch, setSelectedCityForLaunch] = useState<City | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const activeCities = cities.filter((c) => c.active);
  const activeCampaigns = campaigns.filter((c) => c.status === 'in_progress');

  const handleDeleteCampaign = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const res = await Swal.fire({
      title: 'Supprimer cette campagne ?',
      text: 'Toutes les données associées à cette campagne seront définitivement supprimées.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });
    if (res.isConfirmed) {
      try {
        await api.deleteCampaign(id);
        onRefresh?.();
        Swal.fire({
          icon: 'success',
          title: 'Campagne supprimée',
          text: 'La campagne a été supprimée avec succès.',
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Impossible de supprimer la campagne.', 'error');
      }
    }
  };
  const totalTrips = campaigns.reduce((acc, curr) => acc + (curr.completedPairs || 0), 0);
  const totalErrors = campaigns.reduce((acc, curr) => acc + (curr.failedPairs || 0), 0);
  const successRate = totalTrips + totalErrors > 0
    ? ((totalTrips / (totalTrips + totalErrors)) * 100).toFixed(1)
    : '100';

  const handleLaunchChoice = async (cityId: string, mode: 'navigate' | 'sample_25' | 'full') => {
    const targetCity = cities.find(c => c.id === cityId);
    if (!targetCity || !targetCity.active) {
      Swal.fire({ icon: 'warning', title: 'Ville inactive', text: 'Impossible de lancer un pricing sur une ville inactive.' });
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
      Swal.fire({ icon: 'error', title: 'Erreur au lancement', text: err.message || 'Erreur lors du lancement.' });
    } finally {
      setIsLaunching(false);
    }
  };

  const columns: Column<PricingCampaign>[] = useMemo(() => [
    {
      key: 'cityName',
      label: 'Ville',
      sortable: true,
      render: (c) => <strong className="font-semibold text-slate-900">{c.cityName}</strong>
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
      )
    },
    {
      key: 'completedPairs',
      label: 'Trajets',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-mono text-xs font-medium text-slate-700">
          {(c.completedPairs || 0).toLocaleString('fr-FR')} / {(c.totalPairs || 0).toLocaleString('fr-FR')}
        </span>
      )
    },
    {
      key: 'avgPrice',
      label: 'Prix Moyen Yango',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-mono text-xs font-bold text-slate-900">
          {c.avgPrice ? `${c.avgPrice.toLocaleString('fr-FR')} FCFA` : '—'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      render: (c) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            c.status === 'completed'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
              : c.status === 'in_progress'
              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
          }`}
        >
          {c.status === 'completed' ? 'Succès' : c.status === 'in_progress' ? 'En cours' : 'Arrêtée'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={() => {
              onSelectCampaign(c.id);
              onNavigate('pricing');
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4F4A] hover:underline cursor-pointer"
          >
            <span>Détails</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => handleDeleteCampaign(c.id, e)}
            title="Supprimer cette campagne"
            className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ], [onSelectCampaign, onNavigate, onRefresh]);

  return (
    <div className="space-y-6">
      <DashboardMetricCards
        activeCitiesCount={activeCities.length}
        totalCitiesCount={cities.length}
        activeCampaignsCount={activeCampaigns.length}
      />

      <DashboardCityCardsGrid
        cities={cities}
        onSelectCityForLaunch={setSelectedCityForLaunch}
        onNavigateToNeighborhoods={(cityId) => {
          onNavigate('neighborhoods');
        }}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#1F4F4A]" />
            <span>Relevés Récents</span>
          </h2>
        </div>

        <DataTable
          columns={columns}
          data={campaigns.slice(0, 10)}
          searchPlaceholder="Rechercher une campagne..."
          searchKeys={['cityName']}
          exportFileName="activite_recente_pricing"
        />
      </div>

      <CityLaunchChoiceModal
        city={selectedCityForLaunch}
        onClose={() => setSelectedCityForLaunch(null)}
        onChoice={handleLaunchChoice}
        isStartingCampaign={isLaunching}
      />
    </div>
  );
};
