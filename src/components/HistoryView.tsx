import React, { useState, useEffect } from 'react';
import { City, PricingCampaign, HistoryRecord } from '../types';
import { DataTable, Column } from './DataTable';
import { api } from '../services/api';
import {
  History,
  Building2,
  CheckCircle2,
  RotateCw,
  ArrowRight,
  Filter,
  Clock,
  ShieldCheck,
  Activity,
  Layers,
  FileText,
  Trash2,
  Sparkles
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
  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'audit'>('campaigns');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [modeFilter, setModeFilter] = useState<string>('');
  
  // Firestore Audit records
  const [auditLogs, setAuditLogs] = useState<HistoryRecord[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('');

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await api.getHistory();
      setAuditLogs(logs);
    } catch (e) {
      console.error('Erreur chargement audit logs:', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeSubTab]);

  const handleDeleteAudit = async (id: string) => {
    try {
      await api.deleteHistoryItem(id);
      setAuditLogs(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error('Erreur suppression log audit:', e);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (cityFilter && c.cityId !== cityFilter) return false;
    if (modeFilter && c.triggerType !== modeFilter) return false;
    return true;
  });

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditTypeFilter && log.eventType !== auditTypeFilter) return false;
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
      key: 'status',
      label: 'Statut',
      sortable: true,
      align: 'center',
      render: (c) => (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Conforme (BD)
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

  const auditColumns: Column<HistoryRecord>[] = [
    {
      key: 'timestamp',
      label: 'Date & Heure',
      sortable: true,
      render: (l) => (
        <span className="font-mono text-slate-700 text-[11px]">
          {new Date(l.timestamp).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </span>
      ),
      exportValue: (l) => l.timestamp
    },
    {
      key: 'eventType',
      label: 'Catégorie',
      sortable: true,
      render: (l) => {
        const badgeColors: Record<string, string> = {
          system: 'bg-purple-50 text-purple-700 border-purple-200',
          settings: 'bg-blue-50 text-blue-700 border-blue-200',
          campaign: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          users: 'bg-amber-50 text-amber-700 border-amber-200',
          cities: 'bg-teal-50 text-teal-700 border-teal-200',
          neighborhoods: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
        const color = badgeColors[l.eventType] || 'bg-slate-100 text-slate-700 border-slate-200';
        return (
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${color} uppercase`}>
            {l.eventType}
          </span>
        );
      }
    },
    {
      key: 'title',
      label: 'Événement / Action',
      sortable: true,
      render: (l) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{l.title}</div>
          {l.description && (
            <div className="text-[11px] text-slate-500 mt-0.5 font-sans leading-tight">
              {l.description}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'performedBy',
      label: 'Auteur / Source',
      render: (l) => (
        <span className="text-xs text-slate-600 font-mono">
          {l.performedBy || l.performedByName || 'Système Firestore'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'État',
      render: (l) => (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          {l.status || 'OK'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (l) => (
        <button
          onClick={() => handleDeleteAudit(l.id)}
          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
          title="Supprimer ce log"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title and Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" />
            Historique & Traçabilité Firestore
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Historique immuable des campagnes tarifaires et journal d'audit synchronisé avec la base Firestore
          </p>
        </div>

        {/* SubTab Toggle */}
        <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300/60">
          <button
            onClick={() => setActiveSubTab('campaigns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'campaigns'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Campagnes de Prix ({campaigns.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'audit'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Journal d'Audit Système</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'campaigns' && (
        <>
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

            <div className="flex items-center gap-3">
              <button
                onClick={onRefresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Actualiser</span>
              </button>
              <div className="text-xs text-slate-500">
                <strong className="font-semibold text-slate-900">{filteredCampaigns.length}</strong>{' '}
                campagnes en base
              </div>
            </div>
          </div>

          {/* Modern Compact DataTable */}
          <DataTable
            columns={columns}
            data={filteredCampaigns}
            searchPlaceholder="Rechercher dans l'historique des campagnes..."
            searchKeys={['cityName', 'triggerType', 'status']}
            exportFileName="historique_pricing_citrine"
            exportTitle="Historique des Relevés Tarifaires VTC - Citrine Pricing"
            exportSubtitle="Données collectées via Yango Routestats (Cameroun)"
            pageSizeOptions={[10, 25, 50, 100]}
            defaultPageSize={10}
            emptyMessage="Aucune campagne enregistrée dans la base de données."
          />
        </>
      )}

      {activeSubTab === 'audit' && (
        <>
          {/* Audit Filter Row */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-400" />
              
              <select
                value={auditTypeFilter}
                onChange={(e) => setAuditTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-600"
              >
                <option value="">Toutes les catégories</option>
                <option value="system">Système & Initialisation</option>
                <option value="settings">Paramètres (Yango / Hero)</option>
                <option value="campaign">Campagnes de Prix</option>
                <option value="cities">Villes</option>
                <option value="neighborhoods">Quartiers</option>
                <option value="users">Utilisateurs</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadAuditLogs}
                disabled={loadingAudit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                <span>Actualiser Firestore</span>
              </button>
              <div className="text-xs text-slate-500">
                <strong className="font-semibold text-slate-900">{filteredAuditLogs.length}</strong>{' '}
                événements audités
              </div>
            </div>
          </div>

          <DataTable
            columns={auditColumns}
            data={filteredAuditLogs}
            searchPlaceholder="Rechercher dans le journal d'audit..."
            searchKeys={['title', 'description', 'action', 'eventType', 'performedBy']}
            exportFileName="journal_audit_citrine"
            exportTitle="Journal d'Audit Système Firestore - Citrine Pricing"
            exportSubtitle="Traçabilité complète des opérations et modifications de configuration"
            pageSizeOptions={[10, 25, 50, 100]}
            defaultPageSize={10}
            emptyMessage="Aucun événement d'audit dans la collection Firestore."
          />
        </>
      )}

    </div>
  );
};

