import React, { useState, useMemo } from 'react';
import { PricingCampaign, City } from '../../types';
import { DataTable, Column } from '../DataTable';
import { ArrowRight, Calendar, LayoutGrid, Table, RotateCw, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface HistoryCampaignsTabProps {
  campaigns: PricingCampaign[];
  cities: City[];
  cityFilter: string;
  onCityFilterChange: (cityId: string) => void;
  onSelectCampaign: (campaignId: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const HistoryCampaignsTab: React.FC<HistoryCampaignsTabProps> = ({
  campaigns,
  cities,
  cityFilter,
  onCityFilterChange,
  onSelectCampaign,
  onNavigate,
  onRefresh
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (cityFilter && c.cityId !== cityFilter) return false;
      return true;
    });
  }, [campaigns, cityFilter]);

  // Group campaigns strictly by calendar day (e.g., Today = 1 card, Yesterday = 7 cards on 1 row)
  const campaignsByDay = useMemo(() => {
    const map = new Map<string, { key: string; label: string; date: Date; items: PricingCampaign[] }>();
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    for (const c of filteredCampaigns) {
      const d = new Date(c.startedAt);
      if (isNaN(d.getTime())) continue;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      let label = '';
      if (key === todayKey) {
        label = `Aujourd'hui (${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })})`;
      } else if (key === yesterdayKey) {
        label = `Hier (${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })})`;
      } else {
        const capitalizedWeekday = d.toLocaleDateString('fr-FR', { weekday: 'long' });
        const rest = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        label = `${capitalizedWeekday.charAt(0).toUpperCase() + capitalizedWeekday.slice(1)} ${rest}`;
      }

      if (!map.has(key)) {
        map.set(key, { key, label, date: d, items: [] });
      }
      map.get(key)!.items.push(c);
    }

    return Array.from(map.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .map(group => ({
        ...group,
        items: group.items.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      }));
  }, [filteredCampaigns]);

  const columns: Column<PricingCampaign>[] = useMemo(() => [
    {
      key: 'startedAt',
      label: 'Date & Heure',
      sortable: true,
      render: (c) => (
        <span className="font-semibold text-slate-900">
          {new Date(c.startedAt).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      )
    },
    {
      key: 'cityName',
      label: 'Ville',
      sortable: true,
      render: (c) => <span className="font-medium text-slate-800">{c.cityName}</span>
    },
    {
      key: 'completedPairs',
      label: 'Trajets traités',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-mono text-xs text-slate-700">
          {(c.completedPairs || 0).toLocaleString('fr-FR')} / {(c.totalPairs || 0).toLocaleString('fr-FR')}
        </span>
      )
    },
    {
      key: 'avgPrice',
      label: 'Moyenne Yango',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-mono text-xs font-bold text-slate-900">
          {c.avgPrice ? `${c.avgPrice.toLocaleString('fr-FR')} FCFA` : '—'}
        </span>
      )
    },
    {
      key: 'heroAvgPrice',
      label: 'Moyenne Hero Cab',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-mono text-xs font-bold text-teal-700">
          {c.heroStats?.avgPrice ? `${c.heroStats.avgPrice.toLocaleString('fr-FR')} FCFA` : '—'}
        </span>
      )
    },
    {
      key: 'durationSeconds',
      label: 'Durée',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-mono text-xs text-slate-500">
          {c.durationSeconds ? `${c.durationSeconds}s` : '—'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      render: (c) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
            c.status === 'completed'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
              : c.status === 'in_progress'
              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
          }`}
        >
          {c.status === 'completed' ? 'Terminée' : c.status === 'in_progress' ? 'En cours' : 'Arrêtée'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (c) => (
        <button
          onClick={() => {
            onSelectCampaign(c.id);
            onNavigate('pricing');
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1F4F4A] hover:bg-[#1F4F4A]/10 rounded-lg transition cursor-pointer"
        >
          <span>Voir tableau</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )
    }
  ], [onSelectCampaign, onNavigate]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="city-filter-select" className="text-xs text-slate-500 font-medium">Ville :</label>
            <select
              id="city-filter-select"
              value={cityFilter}
              onChange={(e) => onCityFilterChange(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#3D8B85]"
            >
              <option value="">Toutes les villes</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-300">|</span>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                viewMode === 'cards'
                  ? 'bg-white text-[#1F4F4A] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cartes par Jour</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                viewMode === 'table'
                  ? 'bg-white text-[#1F4F4A] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tableau Synthétique</span>
            </button>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Cards View Grouped By Day */}
      {viewMode === 'cards' ? (
        <div className="space-y-6">
          {campaignsByDay.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              Aucune campagne enregistrée dans l'historique.
            </div>
          ) : (
            campaignsByDay.map((group) => (
              <div key={group.key} className="space-y-2.5">
                {/* Day Header Row */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#1F4F4A]" />
                    <h3 className="text-xs font-bold text-slate-900 capitalize">
                      {group.label}
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {group.items.length} pricing{group.items.length > 1 ? 's' : ''} effectué{group.items.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Day Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.items.map((c) => {
                    const timeStr = new Date(c.startedAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div
                        key={c.id}
                        className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-sm hover:shadow-md hover:border-[#1F4F4A]/40 transition flex flex-col justify-between gap-3"
                      >
                        {/* Top info */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              <strong className="text-xs font-bold text-slate-900 truncate">
                                {c.cityName}
                              </strong>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {timeStr}
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : c.status === 'in_progress'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {c.status === 'completed' ? 'Succès' : c.status === 'in_progress' ? 'En cours' : 'Arrêtée'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 font-medium mb-2">
                            {c.isTestSample ? `Test Rapide (${c.totalPairs} trajets)` : `Campagne Globale (${c.totalPairs} trajets)`}
                          </div>

                          {/* Stats Grid */}
                          <div className="bg-slate-50 rounded-lg p-2 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">Trajets traités :</span>
                              <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                {c.completedPairs || 0} / {c.totalPairs || 0}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">Moyenne Yango :</span>
                              <span className="font-mono font-bold text-slate-900 text-[11px]">
                                {c.avgPrice ? `${c.avgPrice.toLocaleString('fr-FR')} F` : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">Moyenne Hero Cab :</span>
                              <span className="font-mono font-bold text-teal-700 text-[11px]">
                                {c.heroStats?.avgPrice ? `${c.heroStats.avgPrice.toLocaleString('fr-FR')} F` : '—'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action button */}
                        <button
                          onClick={() => {
                            onSelectCampaign(c.id);
                            onNavigate('pricing');
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1F4F4A] bg-[#1F4F4A]/10 hover:bg-[#1F4F4A] hover:text-white rounded-lg transition cursor-pointer"
                        >
                          <span>Voir les résultats</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredCampaigns}
          searchPlaceholder="Rechercher par date ou ville..."
          searchKeys={['cityName']}
          exportFileName="historique_campagnes_vtc"
        />
      )}
    </div>
  );
};
