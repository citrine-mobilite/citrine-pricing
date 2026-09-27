import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
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
  Sparkles,
  Download,
  Search,
  X
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
  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'consolidation' | 'audit'>('campaigns');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [modeFilter, setModeFilter] = useState<string>('');
  
  // Consolidation State
  const [rangePreset, setRangePreset] = useState<'today' | 'yesterday' | '7days' | '30days' | 'year' | 'custom' | 'all'>('7days');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

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

  // Dynamic filter for consolidation tab
  const consolidatedCampaignList = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    return campaigns.filter((c) => {
      if (c.status !== 'completed') return false;
      if (cityFilter && c.cityId !== cityFilter) return false;
      
      const startedDate = new Date(c.startedAt);
      const startedDayTime = new Date(startedDate.getFullYear(), startedDate.getMonth(), startedDate.getDate()).getTime();
      const diffDays = (todayStart - startedDayTime) / (1000 * 60 * 60 * 24);
      
      if (rangePreset === 'today') {
        return startedDayTime === todayStart;
      }
      if (rangePreset === 'yesterday') {
        const yesterdayTime = todayStart - (24 * 60 * 60 * 1000);
        return startedDayTime === yesterdayTime;
      }
      if (rangePreset === '7days') {
        return diffDays >= 0 && diffDays <= 7;
      }
      if (rangePreset === '30days') {
        return diffDays >= 0 && diffDays <= 30;
      }
      if (rangePreset === 'year') {
        return startedDate.getFullYear() === now.getFullYear();
      }
      if (rangePreset === 'custom') {
        if (!customDate) return true;
        const selectedDate = new Date(customDate);
        const selectedDayTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
        return startedDayTime === selectedDayTime;
      }
      return true; // 'all'
    });
  }, [campaigns, rangePreset, customDate, cityFilter]);

  // Pre-check all campaigns when list changes
  useEffect(() => {
    setSelectedCampaignIds(consolidatedCampaignList.map(c => c.id));
  }, [consolidatedCampaignList]);

  // Pricing Helpers
  const getYangoPrice = (t: any, className: 'econom' | 'business' | 'comfortplus' | 'moto') => {
    if (className === 'econom') return t.priceEconom || t.classes?.econom?.price || (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'econom')?.price || null;
    if (className === 'business') return t.priceConfort || t.classes?.business?.price || (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'confort')?.price || null;
    if (className === 'comfortplus') return t.priceConfortPlus || t.classes?.comfortplus?.price || (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'comfortplus' || c.className?.toLowerCase() === 'confort+')?.price || null;
    if (className === 'moto') return t.priceMoto || t.classes?.moto?.price || (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'moto')?.price || null;
    return null;
  };

  const getHeroPrice = (t: any, className: 'eco' | 'confort' | 'suv' | 'perkm') => {
    const hQ = t.heroQuote as any;
    if (className === 'eco') {
      let p = t.priceHeroStandard || hQ?.priceStandard || hQ?.priceEco || hQ?.price || null;
      if (!p && hQ?.classes) {
        p = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'standard' || c.className?.toLowerCase() === 'eco')?.price || null;
      }
      return p;
    }
    if (className === 'confort') {
      let p = t.priceHeroConfort || hQ?.priceConfort || null;
      if (!p && hQ?.classes) {
        p = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'confort' || c.className?.toLowerCase() === 'comfort')?.price || null;
      }
      return p;
    }
    if (className === 'suv') {
      let p = hQ?.priceSuv || null;
      if (!p && hQ?.classes) {
        p = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'suv')?.price || null;
      }
      return p;
    }
    if (className === 'perkm') {
      let p = hQ?.priceVip || null;
      if (!p && hQ?.classes) {
        p = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'perkm' || c.className?.toLowerCase() === 'vip')?.price || null;
      }
      return p;
    }
    return null;
  };

  const getTripMasterPrice = (t: any, className: 'eco' | 'confort' | 'moto') => {
    const tmQ = t.tripMasterQuote as any;
    if (className === 'eco') return t.priceTripMaster || tmQ?.priceEco || null;
    if (className === 'confort') return t.priceTripMasterConfort || tmQ?.priceConfort || null;
    if (className === 'moto') return t.priceTripMasterMoto || tmQ?.priceMoto || null;
    return null;
  };

  const handleBulkExport = async (format: 'excel' | 'pdf') => {
    if (selectedCampaignIds.length === 0) {
      Swal.fire('Attention', 'Veuillez sélectionner au moins une campagne à exporter.', 'warning');
      return;
    }

    setIsExporting(true);
    try {
      const consolidatedData = [];

      for (const campaignId of selectedCampaignIds) {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) continue;

        const rawTrips = await api.getCampaignResults(campaignId);

        const formattedTrips = rawTrips.map(t => ({
          ...t,
          yango_eco: getYangoPrice(t, 'econom'),
          yango_confort: getYangoPrice(t, 'business'),
          yango_confort_plus: getYangoPrice(t, 'comfortplus'),
          yango_moto: getYangoPrice(t, 'moto'),
          hero_eco: getHeroPrice(t, 'eco'),
          hero_confort: getHeroPrice(t, 'confort'),
          hero_suv: getHeroPrice(t, 'suv'),
          hero_per_km: getHeroPrice(t, 'perkm'),
          tripmaster_eco: getTripMasterPrice(t, 'eco'),
          tripmaster_confort: getTripMasterPrice(t, 'confort'),
          tripmaster_moto: getTripMasterPrice(t, 'moto'),
        }));

        consolidatedData.push({
          campaignName: campaign.isTestSample ? `${campaign.cityName} (Test Rapide)` : `${campaign.cityName} (Campagne Globale)`,
          cityName: campaign.cityName,
          dateStr: new Date(campaign.startedAt).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          trips: formattedTrips
        });
      }

      const fileName = `consolidation_pricing_${rangePreset}_${new Date().toISOString().slice(0, 10)}`;

      if (format === 'excel') {
        const { exportConsolidatedExcel } = await import('../utils/exportUtils');
        exportConsolidatedExcel(consolidatedData, fileName);
      } else {
        const { exportConsolidatedPdf } = await import('../utils/exportUtils');
        exportConsolidatedPdf(
          consolidatedData,
          `Consolidation Multi-Campagnes — ${rangePreset === 'today' ? "Aujourd'hui" : rangePreset === '7days' ? "7 Derniers Jours" : rangePreset === '30days' ? "30 Derniers Jours" : "Tout l'Historique"}`,
          fileName
        );
      }
    } catch (e) {
      console.error('Erreur de consolidation:', e);
      Swal.fire('Erreur', 'Une erreur est survenue lors de la consolidation des rapports.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAudit = async (id: string) => {
    try {
      await api.deleteHistoryItem(id);
      setAuditLogs(prev => prev.filter(a => a.id !== id));
      Swal.fire('Succès', 'Événement supprimé avec succès.', 'success');
    } catch (e) {
      console.error('Erreur suppression log audit:', e);
      Swal.fire('Erreur', 'Impossible de supprimer cet événement.', 'error');
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
      
      {/* SubTab Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div />

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
            onClick={() => setActiveSubTab('consolidation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'consolidation'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Consolidation & Exports</span>
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

      {activeSubTab === 'consolidation' && (
        <div className="space-y-6">
          {/* Main settings card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Preset Range */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Période d'Analyse</label>
                <select
                  value={rangePreset}
                  onChange={(e: any) => setRangePreset(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-600 focus:bg-white transition-all"
                >
                  <option value="today">Aujourd'hui</option>
                  <option value="yesterday">Hier</option>
                  <option value="7days">Cette Semaine (7 derniers jours)</option>
                  <option value="30days">Ce Mois-ci (30 derniers jours)</option>
                  <option value="year">Cette Année</option>
                  <option value="custom">Date Spécifique...</option>
                  <option value="all">Tout l'Historique</option>
                </select>

                {rangePreset === 'custom' && (
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-600 focus:bg-white transition-all animate-fade-in"
                  />
                )}
              </div>

              {/* City filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Filtrer par Ville</label>
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-600 focus:bg-white"
                >
                  <option value="">Toutes les villes (Cameroun)</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status & Trigger actions */}
              <div className="flex flex-col justify-end">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleBulkExport('excel')}
                    disabled={isExporting || selectedCampaignIds.length === 0}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#153935] rounded-lg shadow-sm transition disabled:opacity-40 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Rapport Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => handleBulkExport('pdf')}
                    disabled={isExporting || selectedCampaignIds.length === 0}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition disabled:opacity-40 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Rapport PDF Groupé</span>
                  </button>
                </div>
              </div>
            </div>

            {rangePreset === 'all' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 flex items-start gap-2 mt-1">
                <span className="font-bold">💡 Note de volume :</span>
                <span>
                  L'option <strong>"Tout l'Historique"</strong> consolide l'intégralité absolue des campagnes. Si vous accumulez des millions de trajets dans le futur, l'extraction globale peut prendre plus de temps et de mémoire. Nous vous conseillons de privilégier des filtres ciblés.
                </span>
              </div>
            )}

            {isExporting && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2.5 animate-pulse mt-2">
                <RotateCw className="w-4 h-4 animate-spin text-amber-600" />
                <span>
                  <strong>Consolidation en cours...</strong> Récupération et structuration des trajets pour <strong>{selectedCampaignIds.length}</strong> campagnes sélectionnées. Veuillez patienter, cela peut prendre quelques secondes.
                </span>
              </div>
            )}
          </div>

          {/* List of campaigns with checkboxes */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Campagnes Disponibles ({consolidatedCampaignList.length})</span>
                <span className="text-[10px] text-slate-500">({selectedCampaignIds.length} sélectionnées)</span>
              </div>

              {consolidatedCampaignList.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCampaignIds(consolidatedCampaignList.map(c => c.id))}
                    className="text-[11px] text-[#3D8B85] hover:text-[#1F4F4A] font-semibold cursor-pointer"
                  >
                    Tout sélectionner
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setSelectedCampaignIds([])}
                    className="text-[11px] text-[#3D8B85] hover:text-[#1F4F4A] font-semibold cursor-pointer"
                  >
                    Tout décocher
                  </button>
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
              {consolidatedCampaignList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Aucune campagne terminée trouvée pour cette période. Essayez d'élargir la période d'analyse.
                </div>
              ) : (
                consolidatedCampaignList.map((c) => {
                  const isChecked = selectedCampaignIds.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedCampaignIds(prev => prev.filter(id => id !== c.id));
                        } else {
                          setSelectedCampaignIds(prev => [...prev, c.id]);
                        }
                      }}
                      className={`p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition cursor-pointer select-none ${
                        isChecked ? 'bg-amber-50/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-slate-400 hover:text-slate-600 transition">
                          {isChecked ? (
                            <span className="text-emerald-600"><CheckCircle2 className="w-5 h-5" /></span>
                          ) : (
                            <div className="w-5 h-5 rounded border border-slate-300 bg-white" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 text-xs">
                            {c.isTestSample ? `${c.cityName} (Test Rapide)` : `${c.cityName} (Campagne Globale)`}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            {new Date(c.startedAt).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-tight">Trajets collectés</span>
                          <span className="text-xs font-semibold text-slate-800">{c.completedPairs} / {c.totalPairs}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-tight">Prix Moyen</span>
                          <span className="text-xs font-bold text-slate-900">{c.avgPrice ? `${c.avgPrice.toLocaleString('fr-FR')} F` : '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
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

