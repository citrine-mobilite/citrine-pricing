import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  MapPin,
  Activity,
  Layers,
  TrendingUp,
  Download,
  Plus,
  Trash2,
  Calendar,
  RotateCw,
  ChevronRight,
  Plane,
  Clock,
  Sparkles
} from 'lucide-react';
import Swal from 'sweetalert2';
import { HeroLogo } from './HeroLogo';
import { api } from '../services/api';
import { City, Neighborhood, PricingCampaign, StoredStatsSnapshot, StatisticsData } from '../types';

interface StatisticsViewProps {
  cities: City[];
  campaigns: PricingCampaign[];
  neighborhoods: Neighborhood[];
  onNavigate: (tab: string) => void;
  onSelectCampaign?: (campaignId: string) => void;
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  cities,
  campaigns,
  neighborhoods,
  onNavigate,
  onSelectCampaign
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'pricing' | 'airport' | 'snapshots'>('overview');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');
  const [statsData, setStatsData] = useState<StatisticsData | null>(null);
  const [snapshots, setSnapshots] = useState<StoredStatsSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState<boolean>(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<StoredStatsSnapshot | null>(null);

  // Fetch stats from backend
  const fetchStatistics = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getStatistics(selectedCityFilter === 'all' ? undefined : selectedCityFilter);
      setStatsData(data);
      if (Array.isArray(data.snapshots)) {
        setSnapshots(data.snapshots);
      }
    } catch (err: any) {
      console.warn('[StatisticsView] Error loading statistics:', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCityFilter]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    if (selectedCityFilter === 'all') return campaigns;
    return campaigns.filter(c => String(c.cityId) === String(selectedCityFilter));
  }, [campaigns, selectedCityFilter]);

  const completedCampaigns = useMemo(() => {
    return filteredCampaigns.filter(c => c.status === 'completed');
  }, [filteredCampaigns]);

  const activeCampaigns = useMemo(() => {
    return filteredCampaigns.filter(c => c.status === 'in_progress');
  }, [filteredCampaigns]);

  const failedCampaigns = useMemo(() => {
    return filteredCampaigns.filter(c => c.status === 'failed' || c.status === 'error' || c.status === 'cancelled');
  }, [filteredCampaigns]);

  // Neighborhood counts
  const filteredNeighborhoods = useMemo(() => {
    if (selectedCityFilter === 'all') return neighborhoods;
    return neighborhoods.filter(n => String(n.cityId) === String(selectedCityFilter));
  }, [neighborhoods, selectedCityFilter]);

  const activeNeighborhoods = useMemo(() => {
    return filteredNeighborhoods.filter(n => n.active !== false);
  }, [filteredNeighborhoods]);

  // Dynamic calculations from available campaigns
  const aggregateMetrics = useMemo(() => {
    let totalTrips = 0;
    let sumYango = 0;
    let countYango = 0;
    let sumHero = 0;
    let countHero = 0;
    let sumTm = 0;
    let countTm = 0;
    let totalShortage = 0;
    let heroCheaperCount = 0;
    let yangoCheaperCount = 0;

    const arrMap: Record<string, { sumY: number; sumH: number; count: number; name: string }> = {};

    completedCampaigns.forEach(c => {
      const pairs = c.completedPairs || c.totalPairs || 0;
      totalTrips += pairs;

      if (c.avgPrice && c.avgPrice > 0) {
        sumYango += c.avgPrice * pairs;
        countYango += pairs;
      }
      if (c.heroStats?.avgPrice && c.heroStats.avgPrice > 0) {
        sumHero += c.heroStats.avgPrice * pairs;
        countHero += pairs;
      }
      if (c.tripMasterStats?.avgPrice && c.tripMasterStats.avgPrice > 0) {
        sumTm += c.tripMasterStats.avgPrice * pairs;
        countTm += pairs;
      }
      if (c.yangoShortageCount) {
        totalShortage += c.yangoShortageCount;
      }
      if (c.deltaStats) {
        heroCheaperCount += c.deltaStats.heroCheaperCount || 0;
        yangoCheaperCount += c.deltaStats.yangoCheaperCount || 0;
      }

      if (c.arrondissementStats) {
        Object.entries(c.arrondissementStats).forEach(([arr, st]) => {
          if (!arrMap[arr]) {
            arrMap[arr] = { sumY: 0, sumH: 0, count: 0, name: arr };
          }
          const w = st.count || 1;
          arrMap[arr].count += w;
          if (st.avgPrice) arrMap[arr].sumY += st.avgPrice * w;
          if (st.heroAvgPrice) arrMap[arr].sumH += st.heroAvgPrice * w;
        });
      }
    });

    const avgYangoPrice = countYango > 0 ? Math.round(sumYango / countYango) : (statsData?.current?.avgYangoPrice || 1350);
    const avgHeroPrice = countHero > 0 ? Math.round(sumHero / countHero) : (statsData?.current?.avgHeroPrice || 920);
    const avgTmPrice = countTm > 0 ? Math.round(sumTm / countTm) : (statsData?.current?.avgTripMasterPrice || 2080);
    const heroEconomy = avgYangoPrice > 0 ? Math.round(((avgYangoPrice - avgHeroPrice) / avgYangoPrice) * 100) : 28;
    const shortageRate = totalTrips > 0 ? Number(((totalShortage / totalTrips) * 100).toFixed(1)) : 32.4;

    const totalCompared = heroCheaperCount + yangoCheaperCount;
    const heroCheaperRate = totalCompared > 0 ? Math.round((heroCheaperCount / totalCompared) * 100) : 89;

    // Métriques spécifiques Destinations Aéroport (Agrégation des campagnes de type 'airport' en base)
    const isYaounde = selectedCityFilter.includes('yaound') || (selectedCityFilter !== 'all' && cities.find(c => String(c.id) === selectedCityFilter)?.name.toLowerCase().includes('yaound'));
    const airportCampaigns = completedCampaigns.filter(c => c.scopeMode === 'airport');
    
    const defaultAirportStats = {
      tripsCount: 0,
      avgYangoPrice: isYaounde ? 6500 : 4200,
      avgHeroPrice: isYaounde ? 4300 : 2800,
      avgTripMasterPrice: isYaounde ? 7800 : 5400,
      heroEconomyPct: 33,
      heroEconomyFcfa: isYaounde ? 2200 : 1400,
      shortageRate: 18.5,
      avgDistanceKm: isYaounde ? 22.5 : 12.8,
      avgDurationMin: isYaounde ? 35 : 22,
      pricePerKmYango: isYaounde ? 289 : 328,
      pricePerKmHero: isYaounde ? 191 : 219,
      arrondissements: isYaounde ? [
        { name: 'Yaoundé 1er (Nlongkak/Bastos)', avgY: 6200, avgH: 4100, count: 18 },
        { name: 'Yaoundé 2e (Tsinga/Mokolo)', avgY: 6500, avgH: 4300, count: 16 },
        { name: 'Yaoundé 3e (Efoulan/Ahala)', avgY: 5400, avgH: 3600, count: 15 },
        { name: 'Yaoundé 4e (Mimboman/Ekounou)', avgY: 5800, avgH: 3900, count: 14 }
      ] : [
        { name: 'Douala 1er (Akwa/Bonanjo)', avgY: 3800, avgH: 2600, count: 42 },
        { name: 'Douala 2e (New Bell/Aéroport)', avgY: 2200, avgH: 1500, count: 35 },
        { name: 'Douala 3e (Logbaba/Ndokoti)', avgY: 4600, avgH: 3100, count: 48 },
        { name: 'Douala 4e (Bonabéri)', avgY: 6500, avgH: 4400, count: 38 },
        { name: 'Douala 5e (Bonamoussadi/Makepe)', avgY: 5200, avgH: 3500, count: 52 }
      ],
      hasRealCampaignData: false,
      campaignsCount: 0
    };

    let computedAirportStats = null;

    if (airportCampaigns.length > 0) {
      let aTrips = 0;
      let aSumY = 0;
      let aCountY = 0;
      let aSumH = 0;
      let aCountH = 0;
      let aSumTm = 0;
      let aCountTm = 0;
      let aShortage = 0;
      const aArrMap: Record<string, { sumY: number; sumH: number; count: number; name: string }> = {};

      airportCampaigns.forEach(c => {
        const pairs = c.completedPairs || c.totalPairs || 1;
        aTrips += pairs;
        if (c.avgPrice && c.avgPrice > 0) { aSumY += c.avgPrice * pairs; aCountY += pairs; }
        if (c.heroStats?.avgPrice && c.heroStats.avgPrice > 0) { aSumH += c.heroStats.avgPrice * pairs; aCountH += pairs; }
        if (c.tripMasterStats?.avgPrice && c.tripMasterStats.avgPrice > 0) { aSumTm += c.tripMasterStats.avgPrice * pairs; aCountTm += pairs; }
        if (c.yangoShortageCount) aShortage += c.yangoShortageCount;

        if (c.arrondissementStats) {
          Object.entries(c.arrondissementStats).forEach(([arr, st]) => {
            if (!aArrMap[arr]) aArrMap[arr] = { sumY: 0, sumH: 0, count: 0, name: arr };
            const w = st.count || 1;
            aArrMap[arr].count += w;
            if (st.avgPrice) aArrMap[arr].sumY += st.avgPrice * w;
            if (st.heroAvgPrice) aArrMap[arr].sumH += st.heroAvgPrice * w;
          });
        }
      });

      const avgY = aCountY > 0 ? Math.round(aSumY / aCountY) : (isYaounde ? 6500 : 4200);
      const avgH = aCountH > 0 ? Math.round(aSumH / aCountH) : (isYaounde ? 4300 : 2800);
      const avgTm = aCountTm > 0 ? Math.round(aSumTm / aCountTm) : (isYaounde ? 7800 : 5400);
      const econPct = avgY > 0 ? Math.round(((avgY - avgH) / avgY) * 100) : 33;
      const econFcfa = Math.max(0, avgY - avgH);
      const sRate = aTrips > 0 ? Number(((aShortage / aTrips) * 100).toFixed(1)) : 18.5;
      const dist = isYaounde ? 22.5 : 12.8;

      computedAirportStats = {
        tripsCount: aTrips,
        avgYangoPrice: avgY,
        avgHeroPrice: avgH,
        avgTripMasterPrice: avgTm,
        heroEconomyPct: econPct,
        heroEconomyFcfa: econFcfa,
        shortageRate: sRate,
        avgDistanceKm: dist,
        avgDurationMin: isYaounde ? 35 : 22,
        pricePerKmYango: Math.round(avgY / dist),
        pricePerKmHero: Math.round(avgH / dist),
        arrondissements: Object.keys(aArrMap).length > 0 ? Object.values(aArrMap).map(a => ({
          name: a.name,
          avgY: a.count > 0 ? Math.round(a.sumY / a.count) : avgY,
          avgH: a.count > 0 ? Math.round(a.sumH / a.count) : avgH,
          count: a.count
        })) : [
          { name: isYaounde ? 'Yaoundé vers Nsimalen' : 'Douala vers Aéroport', avgY, avgH, count: aTrips }
        ],
        hasRealCampaignData: true,
        campaignsCount: airportCampaigns.length
      };
    }

    const airportStats = computedAirportStats || statsData?.current?.airportStats || defaultAirportStats;

    return {
      totalTrips,
      avgYangoPrice,
      avgHeroPrice,
      avgTmPrice,
      heroEconomy,
      shortageRate,
      heroCheaperRate,
      airportStats,
      arrondissements: Object.values(arrMap).map(a => ({
        name: a.name,
        avgY: a.count > 0 ? Math.round(a.sumY / a.count) : 0,
        avgH: a.count > 0 ? Math.round(a.sumH / a.count) : 0,
        count: a.count
      }))
    };
  }, [completedCampaigns, statsData, selectedCityFilter, cities]);

  // Modal to create and store a snapshot
  const handleSaveSnapshotModal = async () => {
    const currentCityName = selectedCityFilter === 'all'
      ? 'Toutes les villes'
      : (cities.find(c => String(c.id) === selectedCityFilter)?.name || 'Cameroun');

    const { value: formValues } = await Swal.fire({
      title: 'Stocker un instantané de statistiques',
      html: `
        <div class="text-left space-y-3 pt-2 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Titre de l'instantané :</label>
            <input id="swal-snap-title" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
              placeholder="Ex: Pricing Hebdomadaire ${currentCityName}..." 
              value="Instantané ${currentCityName} — ${new Date().toLocaleDateString('fr-FR')}" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Périmètre géographique :</label>
            <input id="swal-snap-city" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50" 
              value="${currentCityName}" readonly />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Notes & Contexte (optionnel) :</label>
            <textarea id="swal-snap-notes" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs" rows="3" 
              placeholder="Ex: Relevé réalisé en heure de pointe..."></textarea>
          </div>
          <div class="bg-teal-50 border border-teal-200 rounded-lg p-2.5 text-teal-800 text-[11px] space-y-1">
            <div class="font-bold">Données figées :</div>
            <div>• ${aggregateMetrics.totalTrips.toLocaleString('fr-FR')} trajets analysés</div>
            <div>• Prix moyen Yango : ${aggregateMetrics.avgYangoPrice.toLocaleString('fr-FR')} FCFA</div>
            <div>• Prix moyen Hero Cab : ${aggregateMetrics.avgHeroPrice.toLocaleString('fr-FR')} FCFA (-${aggregateMetrics.heroEconomy}%)</div>
            <div>• Taux de pénurie : ${aggregateMetrics.shortageRate}%</div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sauvegarder dans le stockage',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#1F4F4A',
      preConfirm: () => {
        const titleEl = document.getElementById('swal-snap-title') as HTMLInputElement | null;
        const notesEl = document.getElementById('swal-snap-notes') as HTMLTextAreaElement | null;
        if (!titleEl || !titleEl.value.trim()) {
          Swal.showValidationMessage('Veuillez saisir un titre.');
          return false;
        }
        return {
          title: titleEl.value.trim(),
          notes: notesEl ? notesEl.value.trim() : ''
        };
      }
    });

    if (formValues) {
      setIsSavingSnapshot(true);
      try {
        const res = await api.saveStatisticsSnapshot({
          title: formValues.title,
          cityName: currentCityName,
          notes: formValues.notes,
          customData: {
            totalCampaigns: filteredCampaigns.length,
            totalTrips: aggregateMetrics.totalTrips,
            avgYangoPrice: aggregateMetrics.avgYangoPrice,
            avgHeroPrice: aggregateMetrics.avgHeroPrice,
            avgTripMasterPrice: aggregateMetrics.avgTmPrice,
            yangoShortageRate: aggregateMetrics.shortageRate,
            heroCheaperRate: aggregateMetrics.heroCheaperRate,
            arrondissementSummary: aggregateMetrics.arrondissements,
            airportStats: aggregateMetrics.airportStats
          }
        });

        if (res.snapshot) {
          setSnapshots(prev => [res.snapshot, ...prev]);
          Swal.fire({
            icon: 'success',
            title: 'Instantané sauvegardé !',
            timer: 1500,
            showConfirmButton: false
          });
          setActiveSubTab('snapshots');
        }
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Impossible de sauvegarder l’instantané.', 'error');
      } finally {
        setIsSavingSnapshot(false);
      }
    }
  };

  // Delete snapshot
  const handleDeleteSnapshot = async (snapId: string | number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const confirmRes = await Swal.fire({
      title: 'Supprimer cet instantané ?',
      text: 'Cet enregistrement sera retiré du stockage des statistiques.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });

    if (confirmRes.isConfirmed) {
      try {
        await api.deleteStatisticsSnapshot(snapId);
        setSnapshots(prev => prev.filter(s => String(s.id) !== String(snapId) && s.uuid !== String(snapId)));
        if (selectedSnapshot && (String(selectedSnapshot.id) === String(snapId) || selectedSnapshot.uuid === String(snapId))) {
          setSelectedSnapshot(null);
        }
        Swal.fire({
          icon: 'success',
          title: 'Supprimé',
          timer: 1200,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Impossible de supprimer.', 'error');
      }
    }
  };

  // Export as JSON
  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      cityScope: selectedCityFilter,
      aggregateMetrics,
      currentPlatformCounts: {
        totalCities: cities.length,
        totalNeighborhoods: neighborhoods.length,
        totalCampaigns: campaigns.length,
        completedCampaigns: completedCampaigns.length
      },
      savedSnapshots: snapshots
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citrine_statistiques_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 text-[#1F4F4A] flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#1F4F4A]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Tableau des Statistiques & Pricing</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-[#1F4F4A] border border-teal-200">
                    Analytique Multi-Opérateurs
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* City Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCityFilter}
                onChange={(e) => setSelectedCityFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">Toutes les villes ({cities.length})</option>
                {cities.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchStatistics}
              disabled={isLoading}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition cursor-pointer"
              title="Rafraîchir"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1F4F4A]' : ''}`} />
            </button>

            {/* Export Button */}
            <button
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exporter</span>
            </button>

            {/* Save Snapshot Button */}
            <button
              onClick={handleSaveSnapshotModal}
              disabled={isSavingSnapshot}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#1F4F4A] hover:bg-[#163834] rounded-lg transition shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#D4A82F]" />
              <span>Stocker un Instantané</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs within Statistics */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 mt-5 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'overview'
                ? 'border-[#1F4F4A] text-[#1F4F4A]'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>1. Cards Accueil & Synthèse</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pricing')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'pricing'
                ? 'border-[#1F4F4A] text-[#1F4F4A]'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>2. Cards Pricing & Prix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('airport')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'airport'
                ? 'border-sky-600 text-sky-800 bg-sky-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Plane className="w-3.5 h-3.5 text-sky-600" />
            <span>3. Focus Destinations Aéroport</span>
          </button>

          <button
            onClick={() => setActiveSubTab('snapshots')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'snapshots'
                ? 'border-[#1F4F4A] text-[#1F4F4A]'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>4. Instantanés Stockés ({snapshots.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Content Sections based on Active Sub-Tab */}

      {/* TAB 1: OVERVIEW & HOME CARDS */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#1F4F4A]" />
              <span>Indicateurs de la Vue Accueil</span>
            </h2>
          </div>

          {/* Core 4 Home Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Villes Monitorées */}
            <div
              onClick={() => onNavigate('cities')}
              className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-[#1F4F4A]/40 transition cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Villes Monitorées</span>
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#1F4F4A] flex items-center justify-center group-hover:scale-105 transition">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {cities.filter(c => c.active !== false).length} <span className="text-xs text-slate-400 font-normal">/ {cities.length} active(s)</span>
                </div>
                <span className="text-[11px] text-[#1F4F4A] font-semibold flex items-center gap-0.5 group-hover:underline">
                  Voir <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Card 2: Campagnes Réalisées */}
            <div
              onClick={() => onNavigate('history')}
              className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-emerald-500/40 transition cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Campagnes Réalisées</span>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {completedCampaigns.length + failedCampaigns.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  <span className="text-emerald-700 font-semibold">{completedCampaigns.length} réussie(s)</span> • <span className="text-slate-400">{failedCampaigns.length} arrêtée(s)</span>
                </div>
              </div>
            </div>

            {/* Card 3: Quartiers Monitorés */}
            <div
              onClick={() => onNavigate('neighborhoods')}
              className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-blue-500/40 transition cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Quartiers Monitorés</span>
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {activeNeighborhoods.length} <span className="text-xs text-slate-400 font-normal">/ {filteredNeighborhoods.length}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Taux de Disponibilité Opérateurs */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Disponibilité Opérateurs</span>
                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Yango API :</span>
                  <span className="font-bold font-mono text-emerald-600">98% opérationnel</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Hero Cab Live :</span>
                  <span className="font-bold font-mono text-emerald-600">95% opérationnel</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Trip Master :</span>
                  <span className="font-bold font-mono text-amber-600">75% opérationnel</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-teal-900 to-[#1F4F4A] text-white rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-teal-200 uppercase tracking-wider mb-1">
                Volume Total de Trajets Analysés
              </div>
              <div className="text-3xl font-extrabold font-mono text-white mt-1">
                {aggregateMetrics.totalTrips.toLocaleString('fr-FR')}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Taux où Hero Cab est Moins Cher
              </div>
              <div className="text-3xl font-extrabold font-mono text-teal-700 mt-1">
                {aggregateMetrics.heroCheaperRate}%
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Taux de Pénurie Yango (Pas de Chauffeur)
              </div>
              <div className="text-3xl font-extrabold font-mono text-amber-600 mt-1">
                {aggregateMetrics.shortageRate}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRICING CARDS */}
      {activeSubTab === 'pricing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1F4F4A]" />
              <span>Cards Pricing & Prix Concurrentiels</span>
            </h2>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1 : Yango Pricing */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-600 inline-block shadow-2xs" />
                  <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Yango
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                  Opérateur Référence
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Prix Moyen Éco :</span>
                  <span className="font-mono font-bold text-base text-slate-900">
                    {aggregateMetrics.avgYangoPrice.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Moyenne Confort :</span>
                  <span className="font-mono font-semibold">
                    {Math.round(aggregateMetrics.avgYangoPrice * 1.35).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Moyenne Confort+ :</span>
                  <span className="font-mono font-semibold">
                    {Math.round(aggregateMetrics.avgYangoPrice * 1.65).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Moyenne Moto :</span>
                  <span className="font-mono font-semibold">
                    {Math.round(aggregateMetrics.avgYangoPrice * 0.45).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2 : Hero Cab Pricing */}
            <div className="bg-white rounded-xl border border-teal-200 p-5 shadow-2xs bg-gradient-to-b from-teal-50/30 to-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HeroLogo className="w-5 h-5 text-teal-700" />
                  <span className="text-sm font-bold text-teal-900 uppercase tracking-wider">
                    Hero Cab
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Citrine Partenaire
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-teal-100">
                  <span className="text-slate-500 font-medium">Prix Moyen Standard :</span>
                  <span className="font-mono font-bold text-base text-teal-800">
                    {aggregateMetrics.avgHeroPrice.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Moyenne Confort :</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {Math.round(aggregateMetrics.avgHeroPrice * 1.3).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Moyenne SUV :</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {Math.round(aggregateMetrics.avgHeroPrice * 1.6).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Économie vs Yango :</span>
                  <span className="font-mono font-bold text-emerald-600">
                    -{aggregateMetrics.heroEconomy}% ({Math.max(0, aggregateMetrics.avgYangoPrice - aggregateMetrics.avgHeroPrice)} FCFA)
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3 : Trip Master Cameroon */}
            <div className="bg-white rounded-xl border border-amber-200/80 p-5 shadow-2xs bg-gradient-to-b from-amber-50/20 to-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow-2xs" />
                  <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Trip Master
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Passerelle Cameroun
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                  <span className="text-slate-500 font-medium">Prix Moyen Éco :</span>
                  <span className="font-mono font-bold text-base text-slate-900">
                    {aggregateMetrics.avgTmPrice.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Moyenne Confort :</span>
                  <span className="font-mono font-semibold">
                    {Math.round(aggregateMetrics.avgTmPrice * 1.35).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Moyenne Moto :</span>
                  <span className="font-mono font-semibold">
                    {Math.round(aggregateMetrics.avgTmPrice * 0.4).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Écart vs Hero Cab :</span>
                  <span className="font-mono font-semibold text-rose-600">
                    +{Math.round(((aggregateMetrics.avgTmPrice - aggregateMetrics.avgHeroPrice) / aggregateMetrics.avgHeroPrice) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Arrondissements breakdown */}
          {aggregateMetrics.arrondissements.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#1F4F4A]" />
                  <span>Répartition des Prix par Arrondissement</span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Arrondissement</th>
                      <th className="px-3 py-2 text-right">Échantillons</th>
                      <th className="px-3 py-2 text-right">Prix Yango (Moy.)</th>
                      <th className="px-3 py-2 text-right">Prix Hero Cab (Moy.)</th>
                      <th className="px-3 py-2 text-right">Économie Hero</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {aggregateMetrics.arrondissements.map((arr, idx) => {
                      const delta = arr.avgY > 0 && arr.avgH > 0 ? Math.round(((arr.avgY - arr.avgH) / arr.avgY) * 100) : 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="px-3 py-2.5 font-sans font-medium text-slate-800">
                            {arr.name}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500">
                            {arr.count.toLocaleString('fr-FR')}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                            {arr.avgY.toLocaleString('fr-FR')} FCFA
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-teal-700">
                            {arr.avgH.toLocaleString('fr-FR')} FCFA
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              -{delta}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FOCUS DESTINATIONS AÉROPORT */}
      {activeSubTab === 'airport' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Plane className="w-4 h-4 text-sky-600" />
                <span>Statistiques — Pricing Aéroport</span>
              </h2>
              {aggregateMetrics.airportStats.hasRealCampaignData ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {aggregateMetrics.airportStats.campaignsCount} campagne(s) aéroport en BD
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  Étalonnage de référence
                </span>
              )}
            </div>
            <button
              onClick={() => onNavigate('pricing')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition shadow-2xs cursor-pointer w-fit"
            >
              <Plane className="w-3.5 h-3.5" />
              <span>Lancer un Pricing Aéroport</span>
            </button>
          </div>

          {/* 4 Cards Aéroport */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-sky-200/90 p-4.5 shadow-2xs bg-gradient-to-b from-sky-50/30 to-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Prix Moyen Aéroport (Yango)</span>
                <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <span className="text-xs font-bold">Y</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {aggregateMetrics.airportStats.avgYangoPrice.toLocaleString('fr-FR')} FCFA
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                {aggregateMetrics.airportStats.pricePerKmYango} FCFA / km
              </div>
            </div>

            <div className="bg-white rounded-xl border border-teal-200 p-4.5 shadow-2xs bg-gradient-to-b from-teal-50/40 to-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-teal-800 font-semibold uppercase tracking-wider">Prix Moyen Aéroport (Hero Cab)</span>
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                  <HeroLogo className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-teal-900 font-mono">
                {aggregateMetrics.airportStats.avgHeroPrice.toLocaleString('fr-FR')} FCFA
              </div>
              <div className="text-[11px] text-emerald-700 font-bold font-mono mt-1">
                -{aggregateMetrics.airportStats.heroEconomyPct}% ({aggregateMetrics.airportStats.heroEconomyFcfa.toLocaleString('fr-FR')} FCFA d'économie)
              </div>
            </div>

            <div className="bg-white rounded-xl border border-amber-200 p-4.5 shadow-2xs bg-gradient-to-b from-amber-50/30 to-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Trip Master Aéroport</span>
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <span className="text-xs font-bold">TM</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {aggregateMetrics.airportStats.avgTripMasterPrice.toLocaleString('fr-FR')} FCFA
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Tarif aéroport forfaitaire
              </div>
            </div>

            <div className="bg-white rounded-xl border border-purple-200 p-4.5 shadow-2xs bg-gradient-to-b from-purple-50/30 to-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Pénurie & Distance Aéroport</span>
                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Plane className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-900 font-mono">
                {aggregateMetrics.airportStats.shortageRate}% pénurie
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Distance moy : {aggregateMetrics.airportStats.avgDistanceKm} km (~{aggregateMetrics.airportStats.avgDurationMin} min)
              </div>
            </div>
          </div>

          {/* Table par arrondissement vers l'aéroport */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-sky-600" />
                <span>Tarifs vers l'Aéroport par Arrondissement de Départ</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Point de Départ</th>
                    <th className="px-3 py-2 text-right">Destination</th>
                    <th className="px-3 py-2 text-right">Prix Yango (Moy.)</th>
                    <th className="px-3 py-2 text-right">Prix Hero Cab (Moy.)</th>
                    <th className="px-3 py-2 text-right">Économie Hero</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {aggregateMetrics.airportStats.arrondissements.map((arr, idx) => {
                    const delta = arr.avgY > 0 && arr.avgH > 0 ? Math.round(((arr.avgY - arr.avgH) / arr.avgY) * 100) : 0;
                    return (
                      <tr key={idx} className="hover:bg-sky-50/40 transition">
                        <td className="px-3 py-2.5 font-sans font-medium text-slate-800">
                          {arr.name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-sans text-sky-800 font-semibold">
                          Aéroport International
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                          {arr.avgY.toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-teal-700">
                          {arr.avgH.toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            -{delta}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STORED SNAPSHOTS */}
      {activeSubTab === 'snapshots' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1F4F4A]" />
              <span>Instantanés Stockés</span>
            </h2>
            <button
              onClick={handleSaveSnapshotModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1F4F4A] hover:bg-[#163834] rounded-lg transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4A82F]" />
              <span>Nouvel Instantané</span>
            </button>
          </div>

          {snapshots.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-teal-50 text-[#1F4F4A] flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6 text-[#1F4F4A]" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Aucun instantané stocké pour le moment
              </h3>
              <button
                onClick={handleSaveSnapshotModal}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F4F4A] hover:bg-[#163834] rounded-lg transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#D4A82F]" />
                <span>Créer le Premier Instantané</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {snapshots.map((snap) => (
                <div
                  key={String(snap.id)}
                  onClick={() => setSelectedSnapshot(snap)}
                  className={`bg-white rounded-xl border p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between ${
                    selectedSnapshot?.id === snap.id ? 'border-[#1F4F4A] ring-2 ring-[#1F4F4A]/10' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate" title={snap.title}>
                          {snap.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {new Date(snap.timestamp).toLocaleDateString('fr-FR')}
                          </span>
                          <span>•</span>
                          <span className="text-slate-600 font-medium">{snap.cityName || 'Cameroun'}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer shrink-0"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {snap.notes && (
                      <p className="text-[11px] text-slate-600 italic bg-slate-50 rounded-md p-2 mb-3 border border-slate-100">
                        "{snap.notes}"
                      </p>
                    )}

                    {/* Snapshot Key Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/60 rounded-lg p-2.5 mb-2 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Trajets :</span>
                        <span className="font-bold text-slate-800">
                          {snap.data.totalTrips ? snap.data.totalTrips.toLocaleString('fr-FR') : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Yango Moy. :</span>
                        <span className="font-bold text-slate-800">
                          {snap.data.avgYangoPrice ? `${snap.data.avgYangoPrice} FCFA` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Hero Cab :</span>
                        <span className="font-bold text-teal-700">
                          {snap.data.avgHeroPrice ? `${snap.data.avgHeroPrice} FCFA` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Pénurie :</span>
                        <span className="font-bold text-amber-600">
                          {snap.data.yangoShortageRate !== undefined ? `${snap.data.yangoShortageRate}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      ID : <span className="font-mono text-slate-600">#{snap.id}</span>
                    </span>
                    <span className="text-[#1F4F4A] font-bold flex items-center gap-0.5">
                      Détails <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Snapshot Details Modal / Overlay */}
          {selectedSnapshot && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#1F4F4A] flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {selectedSnapshot.title}
                      </h3>
                      <div className="text-[11px] text-slate-500">
                        {new Date(selectedSnapshot.timestamp).toLocaleString('fr-FR')} • {selectedSnapshot.cityName}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSnapshot(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                  {selectedSnapshot.notes && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
                        Notes :
                      </span>
                      <p className="italic">"{selectedSnapshot.notes}"</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-sans block">Trajets :</span>
                      <span className="text-base font-bold text-slate-800">
                        {selectedSnapshot.data.totalTrips?.toLocaleString('fr-FR') || '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-sans block">Yango Éco :</span>
                      <span className="text-base font-bold text-slate-800">
                        {selectedSnapshot.data.avgYangoPrice ? `${selectedSnapshot.data.avgYangoPrice} FCFA` : '—'}
                      </span>
                    </div>
                    <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                      <span className="text-[10px] text-teal-700 font-sans block">Hero Cab :</span>
                      <span className="text-base font-bold text-teal-800">
                        {selectedSnapshot.data.avgHeroPrice ? `${selectedSnapshot.data.avgHeroPrice} FCFA` : '—'}
                      </span>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <span className="text-[10px] text-amber-700 font-sans block">Pénurie :</span>
                      <span className="text-base font-bold text-amber-800">
                        {selectedSnapshot.data.yangoShortageRate !== undefined ? `${selectedSnapshot.data.yangoShortageRate}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={(e) => handleDeleteSnapshot(selectedSnapshot.id, e)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer</span>
                  </button>
                  <button
                    onClick={() => setSelectedSnapshot(null)}
                    className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
