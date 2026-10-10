import React from 'react';
import { HistoryRecord } from '../../types';
import { ShieldCheck, RotateCw, Trash2, Activity } from 'lucide-react';
import { api } from '../../services/api';
import Swal from 'sweetalert2';

interface HistoryAuditTabProps {
  auditLogs: HistoryRecord[];
  loadingAudit: boolean;
  onReload: () => void;
  auditTypeFilter: string;
  onAuditTypeFilterChange: (val: string) => void;
}

export const HistoryAuditTab: React.FC<HistoryAuditTabProps> = ({
  auditLogs,
  loadingAudit,
  onReload,
  auditTypeFilter,
  onAuditTypeFilterChange
}) => {
  const filteredLogs = React.useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditTypeFilter && log.eventType !== auditTypeFilter) return false;
      return true;
    });
  }, [auditLogs, auditTypeFilter]);

  const handleDeleteLog = async (id: string) => {
    const res = await Swal.fire({
      title: 'Supprimer cette entrée ?',
      text: "L'événement sera retiré de l'historique d'audit.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Supprimer'
    });
    if (res.isConfirmed) {
      try {
        await api.deleteHistoryItem(id);
        onReload();
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Erreur lors de la suppression.', 'error');
      }
    }
  };

  const handleClearAllHistory = async () => {
    if (auditLogs.length === 0) {
      Swal.fire('Information', 'Le journal d’audit est déjà vide.', 'info');
      return;
    }
    const res = await Swal.fire({
      title: 'Vider tout l’historique d’audit ?',
      text: 'Tous les événements enregistrés seront définitivement supprimés.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Oui, tout vider',
      cancelButtonText: 'Annuler'
    });
    if (res.isConfirmed) {
      try {
        await api.clearAllHistory();
        onReload();
        Swal.fire({
          icon: 'success',
          title: 'Historique vidé',
          text: 'Le journal d’audit a été vidé avec succès.',
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Erreur lors de la suppression.', 'error');
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="audit-type-select" className="text-xs text-slate-500 font-medium">Filtrer par module :</label>
          <select
            id="audit-type-select"
            value={auditTypeFilter}
            onChange={(e) => onAuditTypeFilterChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#3D8B85]"
          >
            <option value="">Tous les modules</option>
            <option value="campaign">Campagnes & Tarification</option>
            <option value="neighborhoods">Quartiers & GPS</option>
            <option value="cities">Villes & Arrondissements</option>
            <option value="settings">Configuration & Clés</option>
            <option value="users">Utilisateurs</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAllHistory}
            disabled={loadingAudit || auditLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vider l'historique</span>
          </button>

          <button
            onClick={onReload}
            disabled={loadingAudit}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
            <span>Actualiser journal</span>
          </button>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
        {loadingAudit ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <span className="w-4 h-4 border-2 border-[#1F4F4A] border-t-transparent rounded-full animate-spin inline-block mr-2" />
            Chargement du journal d'audit...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Aucun événement d'audit enregistré.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900 font-semibold">{log.title}</strong>
                    <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[10px] font-mono capitalize">
                      {log.eventType}
                    </span>
                  </div>
                  {log.description && (
                    <p className="text-slate-600 text-[11px] mt-0.5">{log.description}</p>
                  )}
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {new Date(log.timestamp).toLocaleString('fr-FR')} • Opérateur :{' '}
                    {log.performedByName || log.performedBy || 'Système'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleDeleteLog(String(log.id))}
                title="Supprimer cet événement"
                className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
