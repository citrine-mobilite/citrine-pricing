import React, { useMemo } from 'react';
import Swal from 'sweetalert2';
import { City, Neighborhood, PricingCampaign } from '../types';
import { api } from '../services/api';
import { ArrowRight, Activity, Trash2, MessageSquare, Zap, MapPin } from 'lucide-react';
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

      let yangoSuccess = 0;
      if ((c.classStats?.econom as any)?.count !== undefined) {
        yangoSuccess = (c.classStats?.econom as any).count;
      } else if (c.avgPrice && c.avgPrice > 0) {
        yangoSuccess = Math.max(0, totalTrips - (c.failedPairs || 0));
      }

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

  const handleEditComment = async (c: PricingCampaign, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const { value: text } = await Swal.fire({
      title: `Commentaire sur la campagne`,
      text: `${c.cityName} — ${new Date(c.startedAt).toLocaleString('fr-FR')}`,
      input: 'textarea',
      inputValue: c.comment || c.comments || '',
      inputPlaceholder: 'Ex: Heure de pointe du matin, forte pluie, jour férié...',
      showCancelButton: true,
      confirmButtonColor: '#1F4F4A',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Enregistrer la note',
      cancelButtonText: 'Annuler',
      inputAttributes: {
        'aria-label': 'Commentaire de campagne',
        'rows': '4'
      }
    });

    if (text !== undefined) {
      try {
        await api.updateCampaignComment(c.id, text);
        c.comment = text;
        c.comments = text;
        onRefresh?.();
        Swal.fire({
          icon: 'success',
          title: 'Note enregistrée',
          timer: 1400,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Impossible d’enregistrer le commentaire.', 'error');
      }
    }
  };

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
      label: 'Ville & Périmètre',
      sortable: true,
      render: (c) => (
        <div className="space-y-0.5">
          <strong className="font-semibold text-slate-900 block">{c.cityName}</strong>
          {c.arrondissement ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
              <MapPin className="w-2.5 h-2.5" />
              <span>{c.arrondissement}</span>
            </span>
          ) : c.isTestSample ? (
            <span className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
              Test (&le; 50 tr.)
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium">Toute la ville</span>
          )}
        </div>
      )
    },
    {
      key: 'triggeredByUserName',
      label: 'Lancé par',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-[#1F4F4A]/10 text-[#1F4F4A] flex items-center justify-center font-bold text-[9px] uppercase shrink-0">
            {(c.triggeredByUserName || 'Ad').substring(0, 2)}
          </div>
          <span className="text-xs font-medium text-slate-800 truncate max-w-[120px]" title={c.triggeredByUserName || 'Admin Citrine'}>
            {c.triggeredByUserName || 'Admin Citrine'}
          </span>
        </div>
      )
    },
    {
      key: 'startedAt',
      label: 'Horodatage',
      sortable: true,
      render: (c) => (
        <div className="space-y-1">
          <span className="text-slate-600 font-mono text-[11px] block">
            {new Date(c.startedAt).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {c.hasJamsCount && c.hasJamsCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-950 bg-amber-200 px-1.5 py-0.5 rounded border border-amber-300">
              <Zap className="w-2.5 h-2.5 text-amber-700" />
              <span>{c.hasJamsCount} embouteillage(s)</span>
            </span>
          ) : null}
          {c.yangoShortageCount && c.yangoShortageCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-950 bg-purple-200 px-1.5 py-0.5 rounded border border-purple-300">
              <span>{c.yangoShortageCount} pénurie(s)</span>
            </span>
          ) : null}
        </div>
      )
    },
    {
      key: 'comment',
      label: 'Note / Contexte',
      sortable: false,
      render: (c) => (
        <div className="max-w-[200px]">
          {c.comment || c.comments ? (
            <button
              onClick={(e) => handleEditComment(c, e)}
              className="text-left group flex items-start gap-1 p-1 hover:bg-slate-100 rounded text-slate-700 transition cursor-pointer"
              title="Cliquer pour modifier le commentaire"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#1F4F4A] shrink-0 mt-0.5" />
              <span className="text-[11px] font-medium text-slate-800 line-clamp-2 italic">
                "{c.comment || c.comments}"
              </span>
            </button>
          ) : (
            <button
              onClick={(e) => handleEditComment(c, e)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-[#1F4F4A] hover:bg-slate-100 px-2 py-1 rounded transition cursor-pointer"
              title="Ajouter un commentaire sur cette campagne"
            >
              <MessageSquare className="w-3 h-3" />
              <span>+ Note</span>
            </button>
          )}
        </div>
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
          searchPlaceholder="Rechercher par ville ou statut..."
          searchKeys={['cityName']}
          exportFileName="activite_recente_pricing"
        />
      </div>
    </div>
  );
};
