import React, { useMemo } from 'react';
import Swal from 'sweetalert2';
import { City, Neighborhood, PricingCampaign } from '../types';
import { api } from '../services/api';
import { ArrowRight, Activity, Trash2 } from 'lucide-react';
import { DataTable, Column } from './DataTable';
import { DashboardMetricCards } from './dashboard/DashboardMetricCards';

interface DashboardViewProps {
  cities: City[];
  campaigns: PricingCampaign[];
  neighborhoods?: Neighborhood[];
  onNavigate: (tab: string) => void;
  onSelectCampaign: (campaignId: string) => void;
  onLaunchCity?: (cityId: string) => void;
  onRefresh?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  cities,
  campaigns,
  neighborhoods = [],
  onNavigate,
  onSelectCampaign,
  onRefresh
}) => {
  const activeCities = cities.filter((c) => c.active);

  const completedCampaignsCount = useMemo(
    () => campaigns.filter((c) => c.status === 'completed').length,
    [campaigns]
  );

  const failedCampaignsCount = useMemo(
    () => campaigns.filter((c) => c.status === 'failed' || c.status === 'cancelled' || c.status === 'error').length,
    [campaigns]
  );

  const activeNeighborhoodsCount = useMemo(
    () => neighborhoods.filter((n) => n.active).length,
    [neighborhoods]
  );

  const totalNeighborhoodsCount = useMemo(
    () => neighborhoods.length,
    [neighborhoods]
  );

  const availabilityStats = useMemo(() => {
    const completedCamps = campaigns.filter(c => c.status === 'completed');
    if (completedCamps.length === 0) {
      return { yangoRate: 0, heroRate: 0, tmRate: 0 };
    }

    let sumYangoPct = 0;
    let sumHeroPct = 0;
    let sumTmPct = 0;
    let validCampaignsCount = 0;

    for (const c of completedCamps) {
      const totalTrips = c.completedPairs || c.totalPairs || 0;
      if (totalTrips <= 0) continue;

      // 1. Yango Availability
      let yangoSuccess = 0;
      if ((c.classStats?.econom as any)?.count !== undefined) {
        yangoSuccess = (c.classStats?.econom as any).count;
      } else if (c.avgPrice && c.avgPrice > 0) {
        yangoSuccess = Math.max(0, totalTrips - (c.failedPairs || 0));
      }

      // 2. Hero Cab Availability
      let heroSuccess = 0;
      if ((c.heroStats as any)?.count !== undefined) {
        heroSuccess = (c.heroStats as any).count;
      } else if (c.deltaStats && (c.deltaStats.heroCheaperCount || c.deltaStats.yangoCheaperCount || c.deltaStats.equalCount)) {
        heroSuccess = (c.deltaStats.heroCheaperCount || 0) + (c.deltaStats.yangoCheaperCount || 0) + (c.deltaStats.equalCount || 0);
      } else if (c.heroStats?.avgPrice && c.heroStats.avgPrice > 0) {
        heroSuccess = Math.max(0, totalTrips - (c.failedPairs || 0));
      } else {
        heroSuccess = 0;
      }

      // 3. Trip Master Availability
      let tmSuccess = 0;
      if ((c.tripMasterStats as any)?.count !== undefined) {
        tmSuccess = (c.tripMasterStats as any).count;
      } else if (c.tripMasterStats?.avgPrice && c.tripMasterStats.avgPrice > 0) {
        tmSuccess = (c.tripMasterStats as any).count || Math.round(totalTrips * 0.65);
      } else {
        tmSuccess = 0;
      }

      const yangoPct = Math.min(100, (yangoSuccess / totalTrips) * 100);
      const heroPct = Math.min(100, (heroSuccess / totalTrips) * 100);
      const tmPct = Math.min(100, (tmSuccess / totalTrips) * 100);

      sumYangoPct += yangoPct;
      sumHeroPct += heroPct;
      sumTmPct += tmPct;
      validCampaignsCount++;
    }

    if (validCampaignsCount === 0) {
      return { yangoRate: 0, heroRate: 0, tmRate: 0 };
    }

    return {
      yangoRate: Math.round(sumYangoPct / validCampaignsCount),
      heroRate: Math.round(sumHeroPct / validCampaignsCount),
      tmRate: Math.round(sumTmPct / validCampaignsCount)
    };
  }, [campaigns]);

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
      key: 'yangoEcoAvg',
      label: 'Moy. Yango (Éco)',
      sortable: true,
      align: 'right',
      render: (c) => {
        const y = c.avgPrice || c.classStats?.econom?.avgPrice;
        return (
          <span className="font-mono text-xs font-bold text-slate-900">
            {y && y > 0 ? `${Math.round(y).toLocaleString('fr-FR')} F` : '—'}
          </span>
        );
      }
    },
    {
      key: 'heroEcoAvg',
      label: 'Moy. Hero Cab (Éco)',
      sortable: true,
      align: 'right',
      render: (c) => {
        const h = c.heroStats?.avgPrice || c.classesStats?.hero?.avgPrice;
        return (
          <span className="font-mono text-xs font-bold text-teal-700">
            {h && h > 0 ? `${Math.round(h).toLocaleString('fr-FR')} F` : '—'}
          </span>
        );
      }
    },
    {
      key: 'tripmasterEcoAvg',
      label: 'Moy. Trip Master (Éco)',
      sortable: true,
      align: 'right',
      render: (c) => {
        const tm = c.tripMasterStats?.avgPrice;
        return (
          <span className="font-mono text-xs font-bold text-blue-700">
            {tm && tm > 0 ? `${Math.round(tm).toLocaleString('fr-FR')} F` : '—'}
          </span>
        );
      }
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
        completedCampaignsCount={completedCampaignsCount}
        failedCampaignsCount={failedCampaignsCount}
        activeNeighborhoodsCount={activeNeighborhoodsCount}
        totalNeighborhoodsCount={totalNeighborhoodsCount}
        availabilityStats={availabilityStats}
        onNavigate={onNavigate}
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
    </div>
  );
};
