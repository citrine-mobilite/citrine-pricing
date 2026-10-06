import React, { useMemo } from 'react';
import Swal from 'sweetalert2';
import { PricingCampaign } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from './DataTable';
import { ArrowRight, RotateCw, Trash2, Clock, MessageSquare, Play, UserCircle } from 'lucide-react';
import { computeCampaignDuration } from '../utils/durationUtils';

interface CampaignsViewProps {
  campaigns: PricingCampaign[];
  onSelectCampaign: (id: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  onSelectCampaign,
  onNavigate,
  onRefresh
}) => {
  const { user } = useAuth();
  const isAdminOrResponsable = user?.role === 'admin' || user?.role === 'responsable';

  const handleEditComment = async (c: PricingCampaign) => {
    const { value: text } = await Swal.fire({
      title: `Commentaire sur la campagne`,
      text: `${c.cityName} — ${new Date(c.startedAt).toLocaleString('fr-FR')}`,
      input: 'textarea',
      inputValue: c.comment || c.comments || '',
      inputPlaceholder: 'Ex: Heure de pointe du matin, forte pluie, jour férié, test intra-arrondissement...',
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
        onRefresh();
        Swal.fire({
          icon: 'success',
          title: 'Note enregistrée',
          timer: 1300,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Impossible d’enregistrer le commentaire.', 'error');
      }
    }
  };

  const handleDelete = async (id: string) => {
    const res = await Swal.fire({
      title: 'Supprimer ce relevé ?',
      text: 'Tous les trajets et métriques associés seront définitivement effacés.',
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
        sampleLimit: c.sampleLimit,
        triggeredByUserId: user?.id,
        triggeredByUserName: user?.name || 'Citrine Opérateur',
        triggeredByUserRole: user?.role || 'employe'
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
      key: 'triggeredByUserName',
      label: 'Lancé par',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-[#1F4F4A]/10 text-[#1F4F4A] flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
            {(c.triggeredByUserName || 'Ad').substring(0, 2)}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-900 leading-tight">
              {c.triggeredByUserName || 'Admin Citrine'}
            </span>
            <span className="text-[10px] text-slate-400 capitalize">
              {c.triggeredByUserRole === 'admin'
                ? 'Super Admin'
                : c.triggeredByUserRole === 'responsable'
                ? 'Responsable'
                : c.triggerType === 'scheduled'
                ? 'Automatique'
                : 'Opérateur'}
            </span>
          </div>
        </div>
      )
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
      key: 'duration',
      label: 'Durée',
      sortable: false,
      render: (c) => (
        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#1F4F4A]" />
          <span>{computeCampaignDuration(c)}</span>
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
      key: 'comment',
      label: 'Commentaire / Contexte',
      sortable: false,
      render: (c) => (
        <div className="max-w-[200px]">
          {c.comment || c.comments ? (
            <button
              onClick={() => handleEditComment(c)}
              className="text-left group flex items-start gap-1 p-1 hover:bg-slate-100 rounded text-slate-700 transition cursor-pointer"
              title="Cliquer pour modifier"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#1F4F4A] shrink-0 mt-0.5" />
              <span className="text-[11px] font-medium text-slate-800 line-clamp-2 italic">
                "{c.comment || c.comments}"
              </span>
            </button>
          ) : (
            <button
              onClick={() => handleEditComment(c)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-[#1F4F4A] hover:bg-slate-100 px-2 py-0.5 rounded transition cursor-pointer"
              title="Ajouter une note"
            >
              <MessageSquare className="w-3 h-3" />
              <span>+ Note</span>
            </button>
          )}
        </div>
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
              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
              title="Relancer cette campagne"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              onSelectCampaign(c.id);
              onNavigate('pricing');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#1F4F4A] text-white rounded-lg hover:bg-[#183F3B] transition cursor-pointer shadow-xs"
          >
            <span>Voir</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          {isAdminOrResponsable && (
            <button
              onClick={() => handleDelete(c.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              title="Supprimer la campagne"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ], [onSelectCampaign, onNavigate, isAdminOrResponsable, user]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Campagnes de Pricing</span>
            <span className="text-xs font-normal text-slate-400">({campaigns.length} au total)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Historique et état d'exécution de toutes les campagnes de collecte tarifaire.
          </p>
        </div>
        <button
          onClick={() => onNavigate('pricing')}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition cursor-pointer shadow-2xs self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Lancer un relevé</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={campaigns}
        searchPlaceholder="Rechercher par ville, auteur ou note..."
        searchKeys={['cityName', 'comment', 'triggeredByUserName']}
        exportFileName="campagnes_pricing_citrine"
      />
    </div>
  );
};
