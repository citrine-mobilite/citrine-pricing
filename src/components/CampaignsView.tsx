import React, { useState, useEffect } from 'react';
import { PricingCampaign } from '../types';
import { api } from '../services/api';
import { DataTable, Column } from './DataTable';
import {
  Activity,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowRight,
  Clock,
  Building2,
  StopCircle,
  Trash2
} from 'lucide-react';

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
  const [liveData, setLiveData] = useState<PricingCampaign | null>(activeCampaign || null);

  // Poll live campaign if in progress
  useEffect(() => {
    if (!activeCampaign) {
      setLiveData(null);
      return;
    }

    let isSubscribed = true;

    const interval = setInterval(async () => {
      try {
        const fresh = await api.getCampaign(activeCampaign.id);
        if (!isSubscribed) return;

        if (!fresh) {
          // Campaign no longer exists on server (e.g. server reset or deleted)
          clearInterval(interval);
          setLiveData(null);
          onRefresh();
          return;
        }

        setLiveData(fresh);
        if (fresh.status !== 'in_progress') {
          clearInterval(interval);
          onRefresh();
        }
      } catch {
        if (isSubscribed) {
          clearInterval(interval);
          setLiveData(null);
          onRefresh();
        }
      }
    }, 1200);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeCampaign?.id, onRefresh]);

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await api.cancelCampaign(id);
      onRefresh();
    } catch (err: any) {
      console.error('Erreur lors de l’interruption:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCampaign(id);
      onRefresh();
    } catch (err: any) {
      console.error('Erreur lors de la suppression:', err);
    }
  };

  // DataTable columns
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
      ),
      exportValue: (c) => new Date(c.startedAt).toISOString()
    },
    {
      key: 'durationSeconds',
      label: 'Durée',
      sortable: true,
      render: (c) => {
        const dur = c.durationSeconds || (c.status === 'in_progress' ? Math.max(1, Math.round((Date.now() - new Date(c.startedAt).getTime()) / 1000)) : 0);
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
        <div className="flex flex-col items-end">
          <span className="font-semibold text-slate-800">
            {c.completedPairs} / {c.totalPairs}
          </span>
          {c.isTestSample ? (
            <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200 mt-0.5">
              Test ({c.totalPairs}/{c.totalPossiblePairs || '26k'})
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 mt-0.5">
              Campagne globale
            </span>
          )}
        </div>
      ),
      exportValue: (c) => `${c.completedPairs}/${c.totalPairs}${c.isTestSample ? ' (Test)' : ''}`
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
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            {c.status === 'cancelled' ? 'Annulée' : 'Erreur'}
          </span>
        );
      },
      exportValue: (c) => c.status
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-2">
          {c.status === 'in_progress' ? (
            <button
              onClick={() => handleCancel(c.id)}
              disabled={cancellingId === c.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-2xs transition cursor-pointer"
            >
              <StopCircle className={`w-3.5 h-3.5 ${cancellingId === c.id ? 'animate-spin' : ''}`} />
              <span>{cancellingId === c.id ? 'Arrêt...' : 'Arrêter'}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onSelectCampaign(c.id);
                onNavigate('pricing');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition"
            >
              <span>Résultats</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => handleDelete(c.id)}
            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
            title="Supprimer la campagne"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
      exportValue: () => ''
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Campagnes de Pricing
        </h1>
        <button
          onClick={() => onNavigate('pricing')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Lancer un pricing</span>
        </button>
      </div>

      {/* Live Active Tracker Banner if in progress */}
      {liveData && liveData.status === 'in_progress' && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-amber-700 animate-spin" />
              <span className="text-xs font-bold text-slate-900">
                Campagne en cours d'exécution : {liveData.cityName}
              </span>
            </div>
            <button
              onClick={() => handleCancel(liveData.id)}
              className="text-xs font-medium text-rose-700 hover:underline cursor-pointer"
            >
              Interrompre la campagne
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-600">
              <span>
                {liveData.completedPairs} sur {liveData.totalPairs} trajets tarifés
              </span>
              <span className="font-semibold text-slate-900">
                {Math.round(((liveData.completedPairs || 0) / (liveData.totalPairs || 1)) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-amber-200/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.round(
                    ((liveData.completedPairs || 0) / (liveData.totalPairs || 1)) * 100
                  )}%`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modern Compact DataTable */}
      <DataTable
        columns={columns}
        data={campaigns}
        searchPlaceholder="Rechercher par ville, mode, statut..."
        searchKeys={['cityName', 'triggerType', 'status']}
        exportFileName="campagnes_pricing_citrine"
        exportTitle="Liste des Campagnes de Pricing - Citrine Pricing"
        exportSubtitle="Plateforme VTC Cameroun"
        pageSizeOptions={[25, 50, 100, 250]}
        defaultPageSize={25}
        emptyMessage="Aucune campagne enregistrée."
      />

    </div>
  );
};
