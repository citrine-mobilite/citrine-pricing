import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { PricingCampaign } from '../types';
import { api } from '../services/api';
import { DataTable, Column } from './DataTable';
import { ArrowRight, Trash2, RotateCw } from 'lucide-react';
import { CampaignsHeader } from './campaigns/CampaignsHeader';
import { CampaignsActiveBanner } from './campaigns/CampaignsActiveBanner';

interface CampaignsViewProps {
  campaigns: PricingCampaign[];
  onSelectCampaign: (campaignId: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  onSelectCampaign,
  onNavigate,
  onRefresh
}) => {
  const activeCampaign = campaigns.find((c) => c.status === 'in_progress');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await api.cancelCampaign(id);
      onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setCancellingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await Swal.fire({
      title: 'Supprimer cette campagne ?',
      text: 'Les données associées seront supprimées.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Supprimer'
    });
    if (res.isConfirmed) {
      try {
        await api.deleteCampaign(id);
        onRefresh();
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Erreur.', 'error');
      }
    }
  };

  const handleRestart = async (c: PricingCampaign) => {
    try {
      const res = await api.startCampaign({
        cityId: c.cityId,
        triggerType: 'manual',
        sampleLimit: c.sampleLimit
      });
      if (res?.campaign) {
        onSelectCampaign(res.campaign.id);
        onNavigate('pricing');
      }
    } catch (err: any) {
      Swal.fire('Erreur', err?.message || 'Erreur lors du relancement', 'error');
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
      label: 'Date & Heure',
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
        <span className="font-mono text-xs">
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
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
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
        <div className="flex items-center justify-end gap-2">
          {c.status !== 'in_progress' && c.status !== 'completed' && (
            <button
              onClick={() => handleRestart(c)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition"
              title="Relancer cette campagne"
            >
              <RotateCw className="w-3 h-3" />
              <span>Relancer</span>
            </button>
          )}
          <button
            onClick={() => {
              onSelectCampaign(c.id);
              onNavigate('pricing');
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4F4A] hover:underline"
          >
            <span>Voir</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleDelete(c.id)}
            className="p-1 text-slate-400 hover:text-red-600 rounded transition"
            title="Supprimer la campagne"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ], [onSelectCampaign, onNavigate]);

  return (
    <div className="space-y-4">
      <CampaignsHeader
        totalCount={campaigns.length}
        activeCount={campaigns.filter(c => c.status === 'in_progress').length}
        onRefresh={onRefresh}
      />

      {activeCampaign && (
        <CampaignsActiveBanner
          campaign={activeCampaign}
          cancellingId={cancellingId}
          onCancel={handleCancel}
        />
      )}

      <DataTable
        columns={columns}
        data={campaigns}
        searchPlaceholder="Rechercher par ville ou date..."
        searchKeys={['cityName']}
        exportFileName="campagnes_pricing"
      />
    </div>
  );
};
