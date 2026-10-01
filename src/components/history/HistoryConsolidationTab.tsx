import React from 'react';
import { PricingCampaign, City } from '../../types';
import { Layers, Download, FileSpreadsheet, FileText, CheckCircle2, Clock, RotateCw } from 'lucide-react';
import { api } from '../../services/api';
import { exportConsolidatedExcel, exportConsolidatedPdf, ConsolidatedCampaignData, formatCampaignFileName } from '../../utils/exportUtils';
import Swal from 'sweetalert2';

interface HistoryConsolidationTabProps {
  campaigns: PricingCampaign[];
  cities: City[];
  cityFilter: string;
  onCityFilterChange: (id: string) => void;
  rangePreset: 'today' | 'yesterday' | '7days' | '30days' | 'year' | 'custom' | 'all';
  onRangePresetChange: (preset: any) => void;
  customDate: string;
  onCustomDateChange: (date: string) => void;
  selectedCampaignIds: string[];
  onToggleCampaignSelection: (id: string) => void;
  onToggleAllCampaigns: (checked: boolean) => void;
}

export const HistoryConsolidationTab: React.FC<HistoryConsolidationTabProps> = ({
  campaigns,
  cities,
  cityFilter,
  onCityFilterChange,
  rangePreset,
  onRangePresetChange,
  customDate,
  onCustomDateChange,
  selectedCampaignIds,
  onToggleCampaignSelection,
  onToggleAllCampaigns
}) => {
  const [isExporting, setIsExporting] = React.useState(false);

  const consolidatedList = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return campaigns.filter((c) => {
      if (c.status !== 'completed') return false;
      if (cityFilter && c.cityId !== cityFilter) return false;

      const startedDate = new Date(c.startedAt);
      const startedDayTime = new Date(startedDate.getFullYear(), startedDate.getMonth(), startedDate.getDate()).getTime();
      const diffDays = (todayStart - startedDayTime) / (1000 * 60 * 60 * 24);

      if (rangePreset === 'today') return startedDayTime === todayStart;
      if (rangePreset === 'yesterday') return startedDayTime === todayStart - 24 * 60 * 60 * 1000;
      if (rangePreset === '7days') return diffDays >= 0 && diffDays <= 7;
      if (rangePreset === '30days') return diffDays >= 0 && diffDays <= 30;
      if (rangePreset === 'year') return startedDate.getFullYear() === now.getFullYear();
      if (rangePreset === 'custom') {
        if (!customDate) return true;
        const selectedDate = new Date(customDate);
        return startedDayTime === new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
      }
      return true;
    });
  }, [campaigns, rangePreset, customDate, cityFilter]);

  // Group consolidated campaigns by calendar day
  const consolidatedByDay = React.useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: PricingCampaign[] }>();
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    for (const c of consolidatedList) {
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
        map.set(key, { key, label, items: [] });
      }
      map.get(key)!.items.push(c);
    }

    return Array.from(map.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .map(group => ({
        ...group,
        items: group.items.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      }));
  }, [consolidatedList]);

  const handleBulkExport = async (format: 'excel' | 'pdf') => {
    if (selectedCampaignIds.length === 0) {
      Swal.fire('Attention', 'Veuillez sélectionner au moins une campagne à exporter.', 'warning');
      return;
    }

    setIsExporting(true);
    try {
      const campaignsDataList: ConsolidatedCampaignData[] = [];
      let totalTripsCount = 0;

      // Charger le contenu complet (tous les trajets) de chaque pricing sélectionné
      for (const campaignId of selectedCampaignIds) {
        const camp = campaigns.find((c) => c.id === campaignId);
        if (!camp) continue;

        const trips = await api.getCampaignResults(campaignId);
        if (trips && trips.length > 0) {
          totalTripsCount += trips.length;
          campaignsDataList.push({
            campaignName: camp.isTestSample ? `Test Rapide (${camp.totalPairs} trajets)` : `Campagne Globale (${camp.totalPairs} trajets)`,
            cityName: camp.cityName || 'Ville',
            dateStr: new Date(camp.startedAt).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            trips
          });
        }
      }

      if (campaignsDataList.length === 0 || totalTripsCount === 0) {
        Swal.fire('Information', 'Aucun trajet trouvé dans les campagnes sélectionnées.', 'info');
        return;
      }

      const firstCamp = campaignsDataList[0];
      const exportName = campaignsDataList.length === 1
        ? formatCampaignFileName(firstCamp?.cityName, firstCamp?.dateStr)
        : `consolidation_${selectedCampaignIds.length}_${formatCampaignFileName(firstCamp?.cityName, firstCamp?.dateStr)}`;

      if (format === 'excel') {
        exportConsolidatedExcel(
          campaignsDataList,
          exportName
        );
      } else {
        exportConsolidatedPdf(
          campaignsDataList,
          `Rapport Consolidé Multi-Pricings (${selectedCampaignIds.length} relevés)`,
          exportName
        );
      }

      Swal.fire({
        title: 'Export réussi !',
        text: `${selectedCampaignIds.length} pricing(s) exporté(s) (${totalTripsCount} trajets au total).`,
        icon: 'success',
        timer: 2200,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire('Erreur', err?.message || 'Erreur lors de l’exportation.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-slate-500 font-medium">Période :</span>
          {(['7days', '30days', 'today', 'yesterday', 'year', 'all', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onRangePresetChange(p)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition cursor-pointer ${
                rangePreset === p
                  ? 'bg-[#1F4F4A] text-white border-[#1F4F4A]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p === '7days' ? '7 derniers jours' : p === '30days' ? '30 derniers jours' : p === 'today' ? 'Aujourd’hui' : p === 'yesterday' ? 'Hier' : p === 'year' ? 'Cette année' : p === 'custom' ? 'Date précise' : 'Tout'}
            </button>
          ))}

          {rangePreset === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => onCustomDateChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2 py-1 text-slate-800"
            />
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBulkExport('excel')}
            disabled={isExporting || selectedCampaignIds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Consolidé ({selectedCampaignIds.length})</span>
          </button>

          <button
            onClick={() => handleBulkExport('pdf')}
            disabled={isExporting || selectedCampaignIds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF Consolidé</span>
          </button>
        </div>
      </div>

      {/* Campaigns Selector Grid */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="select-all-camps"
              checked={selectedCampaignIds.length === consolidatedList.length && consolidatedList.length > 0}
              onChange={(e) => onToggleAllCampaigns(e.target.checked)}
              className="rounded border-slate-300 text-[#1F4F4A] focus:ring-[#3D8B85]"
            />
            <label htmlFor="select-all-camps" className="font-semibold text-slate-800 cursor-pointer">
              Tout sélectionner ({consolidatedList.length} campagnes trouvées)
            </label>
          </div>
          <span className="text-slate-400 text-[11px] font-medium">
            {selectedCampaignIds.length} sélectionnée(s) pour l'export consolidé
          </span>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {consolidatedByDay.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center justify-between pt-1 pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 capitalize flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#1F4F4A]" />
                  <span>{group.label}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {group.items.length} pricing{group.items.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {group.items.map((c) => {
                  const isSelected = selectedCampaignIds.includes(c.id);
                  const timeStr = new Date(c.startedAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div
                      key={c.id}
                      onClick={() => onToggleCampaignSelection(c.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-[#1F4F4A] bg-[#1F4F4A]/5 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-slate-300 text-[#1F4F4A]"
                      />
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <strong className="text-slate-900 font-bold truncate">{c.cityName}</strong>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-200/60 px-1.5 py-0.2 rounded">
                            {timeStr}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {c.completedPairs || 0} trajets traités
                        </p>
                        <div className="flex items-center gap-2 mt-1 font-mono text-[10px]">
                          <span className="text-slate-700 font-medium">Y: {c.avgPrice ? `${c.avgPrice.toLocaleString('fr-FR')} F` : '—'}</span>
                          <span className="text-teal-700 font-semibold">H: {c.heroStats?.avgPrice ? `${c.heroStats.avgPrice.toLocaleString('fr-FR')} F` : '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
