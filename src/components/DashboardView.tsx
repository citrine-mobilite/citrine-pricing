import React, { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { City, Neighborhood, PricingCampaign } from '../types';
import { api } from '../services/api';
import {
  ArrowRight,
  Activity,
  Trash2,
  MessageSquare,
  Zap,
  MapPin,
  Filter,
  RotateCcw,
  Building2,
  Clock,
  Calendar,
  Award
} from 'lucide-react';
import { DataTable, Column } from './DataTable';
import { DashboardMetricCards } from './dashboard/DashboardMetricCards';
import { detectArrondissement } from '../utils/routeMatrix';
import { getCampaignPeakHourInfo, matchesTimeSlotFilter, TimeSlotFilter } from '../utils/durationUtils';

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
  // États des filtres globaux de statistiques
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [arrondissementFilter, setArrondissementFilter] = useState<string>('all');
  const [timeSlotFilter, setTimeSlotFilter] = useState<TimeSlotFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'city_wide' | 'arrondissement' | 'test_sample'>('all');

  const isFiltered =
    cityFilter !== 'all' ||
    arrondissementFilter !== 'all' ||
    timeSlotFilter !== 'all' ||
    periodFilter !== 'all' ||
    scopeFilter !== 'all';

  const handleResetFilters = () => {
    setCityFilter('all');
    setArrondissementFilter('all');
    setTimeSlotFilter('all');
    setPeriodFilter('all');
    setScopeFilter('all');
  };

  // Liste dynamique des arrondissements selon la ville sélectionnée
  const availableArrondissements = useMemo(() => {
    const set = new Set<string>();
    const nbsToScan = cityFilter !== 'all'
      ? neighborhoods.filter(n => n.cityId === cityFilter)
      : neighborhoods;

    nbsToScan.forEach(nb => {
      const arr = detectArrondissement(nb);
      if (arr && arr.trim() && arr !== 'Centre / Général') {
        set.add(arr.trim());
      } else if (nb.arrondissement && nb.arrondissement.trim()) {
        set.add(nb.arrondissement.trim());
      }
    });

    campaigns.forEach(c => {
      if (cityFilter !== 'all' && c.cityId !== cityFilter) return;
      if (c.arrondissement && c.arrondissement.trim()) set.add(c.arrondissement.trim());
      if (c.originArrondissement && c.originArrondissement.trim()) set.add(c.originArrondissement.trim());
      if (c.destArrondissement && c.destArrondissement.trim()) set.add(c.destArrondissement.trim());
      if (c.arrondissementStats) {
        Object.keys(c.arrondissementStats).forEach(arr => {
          if (arr && arr.trim()) set.add(arr.trim());
        });
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  }, [campaigns, neighborhoods, cityFilter]);

  // Campagnes filtrées selon tous les critères
  const filteredCampaigns = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 3600 * 1000;
    const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 3600 * 1000;

    return campaigns.filter((c) => {
      // 1. Ville
      if (cityFilter !== 'all' && c.cityId !== cityFilter) return false;

      // 2. Période
      const t = new Date(c.startedAt).getTime();
      if (periodFilter === 'today' && t < todayStart) return false;
      if (periodFilter === 'yesterday' && (t < yesterdayStart || t >= todayStart)) return false;
      if (periodFilter === '7days' && t < sevenDaysAgo) return false;
      if (periodFilter === '30days' && t < thirtyDaysAgo) return false;

      // 3. Périmètre
      const isSample = Boolean(c.isTestSample || (c.sampleLimit && c.sampleLimit <= 50) || (c.totalPairs && c.totalPairs <= 50));
      const isIntra = Boolean(c.scopeMode === 'intra' || c.arrondissement);
      const isInter = Boolean(c.scopeMode === 'inter' || (c.originArrondissement && c.destArrondissement));

      if (scopeFilter === 'test_sample' && !isSample) return false;
      if (scopeFilter === 'city_wide' && (isSample || isIntra || isInter)) return false;
      if (scopeFilter === 'arrondissement' && !isIntra && !isInter && arrondissementFilter === 'all') return false;

      // 4. Arrondissement
      if (arrondissementFilter !== 'all') {
        const targetArr = arrondissementFilter.toLowerCase().trim();
        const cArr = (c.arrondissement || '').toLowerCase().trim();
        const oArr = (c.originArrondissement || '').toLowerCase().trim();
        const dArr = (c.destArrondissement || '').toLowerCase().trim();
        const matchesExplicitArr = cArr === targetArr || oArr === targetArr || dArr === targetArr;
        const hasArrStats = Boolean(
          c.arrondissementStats &&
          Object.keys(c.arrondissementStats).some(k => k.toLowerCase().trim() === targetArr)
        );
        const isGlobalCityCampaign = Boolean(
          c.scopeMode === 'global' || c.scopeMode === 'city' || (!c.scopeMode && !c.arrondissement)
        );
        if (!matchesExplicitArr && !hasArrStats && !isGlobalCityCampaign) return false;
      }

      // 5. Créneau horaire / Heure de pointe
      if (!matchesTimeSlotFilter(c, timeSlotFilter)) return false;

      return true;
    });
  }, [campaigns, cityFilter, periodFilter, scopeFilter, arrondissementFilter, timeSlotFilter]);

  // Quartiers filtrés selon Ville + Arrondissement
  const filteredNeighborhoods = useMemo(() => {
    return neighborhoods.filter(n => {
      if (cityFilter !== 'all' && n.cityId !== cityFilter) return false;
      if (arrondissementFilter !== 'all') {
        const arr = detectArrondissement(n).toLowerCase().trim();
        const rawArr = (n.arrondissement || '').toLowerCase().trim();
        const target = arrondissementFilter.toLowerCase().trim();
        if (arr !== target && rawArr !== target) return false;
      }
      return true;
    });
  }, [neighborhoods, cityFilter, arrondissementFilter]);

  const filteredCities = useMemo(() => {
    if (cityFilter === 'all') return cities;
    return cities.filter(c => c.id === cityFilter);
  }, [cities, cityFilter]);

  const activeCities = filteredCities.filter((c) => c.active);

  const completedCampaignsCount = useMemo(
    () => filteredCampaigns.filter((c) => c.status === 'completed').length,
    [filteredCampaigns]
  );

  const failedCampaignsCount = useMemo(
    () => filteredCampaigns.filter((c) => c.status === 'failed' || c.status === 'cancelled' || c.status === 'error').length,
    [filteredCampaigns]
  );

  const activeNeighborhoodsCount = useMemo(
    () => filteredNeighborhoods.filter((n) => n.active).length,
    [filteredNeighborhoods]
  );

  const totalNeighborhoodsCount = useMemo(
    () => filteredNeighborhoods.length,
    [filteredNeighborhoods]
  );

  // Statistiques tarifaires et de disponibilité dynamiques (filtrables par ville, arrondissement, heure de pointe, période)
  const filteredPricingSummary = useMemo(() => {
    const completedCamps = filteredCampaigns.filter(c => c.status === 'completed');
    let sumYango = 0, countYango = 0;
    let sumHero = 0, countHero = 0;
    let sumTm = 0, countTm = 0;
    let heroWinsTotal = 0, yangoWinsTotal = 0, comparableTripsTotal = 0;
    let peakCampaignsCount = 0;
    let jamsTotalCount = 0;
    let shortageTotalCount = 0;

    for (const c of filteredCampaigns) {
      const peakInfo = getCampaignPeakHourInfo(c);
      if (peakInfo.isPeakHour) peakCampaignsCount++;
      jamsTotalCount += peakInfo.jamsCount;
      shortageTotalCount += peakInfo.shortageCount;
    }

    for (const c of completedCamps) {
      let yPrice = c.avgPrice || c.classStats?.econom?.avgPrice || 0;
      let hPrice = c.heroStats?.avgPrice || c.classesStats?.hero?.avgPrice || 0;
      let tmPrice = c.tripMasterStats?.avgPrice || 0;

      // Si un arrondissement spécifique est filtré, utiliser ses statistiques dédiées
      if (arrondissementFilter !== 'all' && c.arrondissementStats) {
        const key = Object.keys(c.arrondissementStats).find(
          k => k.toLowerCase().trim() === arrondissementFilter.toLowerCase().trim()
        );
        if (key && c.arrondissementStats[key]) {
          yPrice = c.arrondissementStats[key].avgPrice || yPrice;
          hPrice = c.arrondissementStats[key].heroAvgPrice || hPrice;
          tmPrice = c.arrondissementStats[key].tripMasterAvgPrice || tmPrice;
        }
      }

      if (yPrice > 0) { sumYango += yPrice; countYango++; }
      if (hPrice > 0) { sumHero += hPrice; countHero++; }
      if (tmPrice > 0) { sumTm += tmPrice; countTm++; }

      if (c.deltaStats) {
        heroWinsTotal += c.deltaStats.heroCheaperCount || 0;
        yangoWinsTotal += c.deltaStats.yangoCheaperCount || 0;
        comparableTripsTotal += (c.deltaStats.heroCheaperCount || 0) + (c.deltaStats.yangoCheaperCount || 0) + (c.deltaStats.equalCount || 0);
      } else if (hPrice > 0 && yPrice > 0) {
        const pairs = c.completedPairs || 1;
        comparableTripsTotal += pairs;
        if (hPrice < yPrice) heroWinsTotal += pairs;
        else if (yPrice < hPrice) yangoWinsTotal += pairs;
      }
    }

    return {
      avgYango: countYango > 0 ? Math.round(sumYango / countYango) : 0,
      avgHero: countHero > 0 ? Math.round(sumHero / countHero) : 0,
      avgTm: countTm > 0 ? Math.round(sumTm / countTm) : 0,
      heroWinRate: comparableTripsTotal > 0 ? Math.round((heroWinsTotal / comparableTripsTotal) * 100) : 0,
      peakCampaignsCount,
      jamsTotalCount,
      shortageTotalCount
    };
  }, [filteredCampaigns, arrondissementFilter]);

  const availabilityStats = useMemo(() => {
    const completedCamps = filteredCampaigns.filter(c => c.status === 'completed');
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
  }, [filteredCampaigns]);

  const handleEditComment = async (c: PricingCampaign, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const peak = getCampaignPeakHourInfo(c);
    const currentSlot = c.timeSlotOverride || 'auto';
    const currentComment = (c.comment || c.comments || '').replace(/"/g, '&quot;');

    const { value: formValues, isConfirmed } = await Swal.fire({
      title: 'Créneau & Commentaire du relevé',
      html: `
        <div style="text-align: left; font-size: 12px; color: #334155;">
          <p style="margin-bottom: 10px; font-weight: 600; color: #0f172a;">
            ${c.cityName} — Relevé du ${new Date(c.startedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <label style="display: block; font-weight: 700; margin-bottom: 4px; color: #475569;">
            1. Créneau horaire / Heure de pointe :
          </label>
          <select id="swal-slot-select" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 12px; font-size: 12px; background: #f8fafc;">
            <option value="auto" ${currentSlot === 'auto' ? 'selected' : ''}>⏱️ Automatique selon l'heure (${peak.exactTimeStr})</option>
            <option value="morning_peak" ${currentSlot === 'morning_peak' ? 'selected' : ''}>🌅 Pointe Matin (06h00 – 10h00)</option>
            <option value="off_peak_morning" ${currentSlot === 'off_peak_morning' ? 'selected' : ''}>🟢 Creuse Matinée (10h00 – 12h00)</option>
            <option value="midday_peak" ${currentSlot === 'midday_peak' ? 'selected' : ''}>☀️ Pointe Midi (12h00 – 14h30)</option>
            <option value="off_peak_afternoon" ${currentSlot === 'off_peak_afternoon' ? 'selected' : ''}>🌤️ Creuse Après-midi (14h30 – 16h30)</option>
            <option value="evening_peak" ${currentSlot === 'evening_peak' ? 'selected' : ''}>🌆 Pointe Soir (16h30 – 20h30)</option>
            <option value="night" ${currentSlot === 'night' ? 'selected' : ''}>🌙 Creuse Soir / Nuit (20h30 – 06h00)</option>
          </select>
          <label style="display: block; font-weight: 700; margin-bottom: 4px; color: #475569;">
            2. Commentaire / Observation (météo, trafic, événement) :
          </label>
          <textarea id="swal-comment-input" rows="3" placeholder="Ex: Forte pluie sur Akwa, embouteillages Rond-point Deïdo..." style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;">${currentComment}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#1F4F4A',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Enregistrer',
      cancelButtonText: 'Annuler',
      preConfirm: () => {
        const slotEl = document.getElementById('swal-slot-select') as HTMLSelectElement | null;
        const commentEl = document.getElementById('swal-comment-input') as HTMLTextAreaElement | null;
        return {
          timeSlotOverride: slotEl ? slotEl.value : 'auto',
          comment: commentEl ? commentEl.value.trim() : ''
        };
      }
    });

    if (isConfirmed && formValues) {
      try {
        await api.updateCampaignComment(c.id, formValues.comment, formValues.timeSlotOverride);
        c.comment = formValues.comment;
        c.comments = formValues.comment;
        c.timeSlotOverride = formValues.timeSlotOverride === 'auto' ? undefined : formValues.timeSlotOverride;
        onRefresh?.();
        Swal.fire({
          icon: 'success',
          title: 'Mis à jour',
          timer: 1300,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Impossible d’enregistrer.', 'error');
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
          ) : c.originArrondissement && c.destArrondissement ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
              <MapPin className="w-2.5 h-2.5" />
              <span>{c.originArrondissement} ➔ {c.destArrondissement}</span>
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
      label: 'Horodatage & Heures de pointe',
      sortable: true,
      render: (c) => {
        const peak = getCampaignPeakHourInfo(c);
        return (
          <div className="space-y-1">
            <span className="text-slate-700 font-mono text-[11px] font-semibold block">
              {new Date(c.startedAt).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={(e) => handleEditComment(c, e)}
                className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-80 transition ${peak.badgeClass}`}
                title={`${peak.slotLabel} — Cliquer pour modifier le créneau`}
              >
                <span>{peak.shortLabel}</span>
              </button>
              {peak.surgePct > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-950 bg-amber-200 px-1.5 py-0.5 rounded border border-amber-300"
                  title="Forte demande / hausse tarifaire Yango par rapport au tarif creux"
                >
                  <Zap className="w-2.5 h-2.5 text-amber-700" />
                  <span>+{peak.surgePct}%</span>
                </span>
              )}
              {peak.shortageCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-purple-950 bg-purple-200 px-1.5 py-0.5 rounded border border-purple-300">
                  <span>{peak.shortageCount} pénurie(s)</span>
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'comment',
      label: 'Commentaire / Contexte',
      sortable: false,
      render: (c) => (
        <div className="max-w-[210px]">
          {c.comment || c.comments ? (
            <button
              onClick={(e) => handleEditComment(c, e)}
              className="text-left group flex items-start gap-1.5 p-1.5 bg-teal-50/60 hover:bg-teal-100/70 border border-teal-200/70 rounded-lg text-slate-700 transition cursor-pointer"
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
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-[#1F4F4A] bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-200 px-2 py-1 rounded-lg transition cursor-pointer"
              title="Ajouter un commentaire sur cette campagne"
            >
              <MessageSquare className="w-3 h-3" />
              <span>+ Commentaire</span>
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
        let y = c.avgPrice || c.classStats?.econom?.avgPrice;
        if (arrondissementFilter !== 'all' && c.arrondissementStats) {
          const k = Object.keys(c.arrondissementStats).find(
            key => key.toLowerCase().trim() === arrondissementFilter.toLowerCase().trim()
          );
          if (k && c.arrondissementStats[k]?.avgPrice) y = c.arrondissementStats[k].avgPrice;
        }
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
        let h = c.heroStats?.avgPrice || c.classesStats?.hero?.avgPrice;
        if (arrondissementFilter !== 'all' && c.arrondissementStats) {
          const k = Object.keys(c.arrondissementStats).find(
            key => key.toLowerCase().trim() === arrondissementFilter.toLowerCase().trim()
          );
          if (k && c.arrondissementStats[k]?.heroAvgPrice) h = c.arrondissementStats[k].heroAvgPrice;
        }
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
  ], [onSelectCampaign, onNavigate, onRefresh, arrondissementFilter]);

  return (
    <div className="space-y-5">
      {/* Barre de Filtres Dynamiques de la Statistique Globale */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#1F4F4A] flex items-center justify-center">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span>Filtres des Statistiques & Relevés</span>
                <span className="text-[11px] font-semibold text-[#1F4F4A] bg-teal-50 px-2 py-0.5 rounded-full normal-case border border-teal-200/60">
                  {filteredCampaigns.length} / {campaigns.length} campagne(s)
                </span>
              </h2>
            </div>
          </div>

          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser tous les filtres</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          {/* 1. Ville */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
              <Building2 className="w-3 h-3 text-[#1F4F4A]" />
              <span>Ville</span>
            </label>
            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setArrondissementFilter('all');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
            >
              <option value="all">Toutes les villes ({cities.length})</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 2. Arrondissement */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
              <MapPin className="w-3 h-3 text-teal-700" />
              <span>Arrondissement</span>
            </label>
            <select
              value={arrondissementFilter}
              onChange={(e) => setArrondissementFilter(e.target.value)}
              className={`w-full border rounded-lg px-2.5 py-1.5 font-medium text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none ${
                arrondissementFilter !== 'all'
                  ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">Tous les arrondissements ({availableArrondissements.length})</option>
              {availableArrondissements.map((arr) => (
                <option key={arr} value={arr}>{arr}</option>
              ))}
            </select>
          </div>

          {/* 3. Heures de pointe & Créneaux horaires */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Heures de pointe & Créneaux</span>
            </label>
            <select
              value={timeSlotFilter}
              onChange={(e) => setTimeSlotFilter(e.target.value as TimeSlotFilter)}
              className={`w-full border rounded-lg px-2.5 py-1.5 font-medium text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none ${
                timeSlotFilter !== 'all'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">Tous les créneaux (24h/24)</option>
              <option value="any_peak">🔥 Toutes Heures de Pointe (Matin, Midi, Soir)</option>
              <option value="morning_peak">🌅 Pointe Matin (06h00 – 10h00)</option>
              <option value="off_peak_morning">🟢 Creuse Matinée (10h00 – 12h00)</option>
              <option value="midday_peak">☀️ Pointe Midi (12h00 – 14h30)</option>
              <option value="off_peak_afternoon">🌤️ Creuse Après-midi (14h30 – 16h30)</option>
              <option value="evening_peak">🌆 Pointe Soir (16h30 – 20h30)</option>
              <option value="night">🌙 Creuse Soir / Nuit (20h30 – 06h00)</option>
              <option value="off_peak">🟢 Toutes Heures Creuses (Fluide)</option>
              <option value="with_shortage">⚠️ Avec pénurie véhicules</option>
            </select>
          </div>

          {/* 4. Période temporelle */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span>Période</span>
            </label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
            >
              <option value="all">Tout l'historique</option>
              <option value="today">Aujourd'hui</option>
              <option value="yesterday">Hier</option>
              <option value="7days">7 derniers jours</option>
              <option value="30days">30 derniers jours</option>
            </select>
          </div>

          {/* 5. Périmètre */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#1F4F4A]" />
              <span>Périmètre</span>
            </label>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
            >
              <option value="all">Tous les périmètres</option>
              <option value="city_wide">Ville entière</option>
              <option value="arrondissement">Par arrondissement</option>
              <option value="test_sample">Échantillons tests (&le; 50)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cartes KPI Opérationnelles (Dynamiquement filtrées) */}
      <DashboardMetricCards
        activeCitiesCount={activeCities.length}
        totalCitiesCount={filteredCities.length}
        completedCampaignsCount={completedCampaignsCount}
        failedCampaignsCount={failedCampaignsCount}
        activeNeighborhoodsCount={activeNeighborhoodsCount}
        totalNeighborhoodsCount={totalNeighborhoodsCount}
        availabilityStats={availabilityStats}
        onNavigate={onNavigate}
      />

      {/* Bandeau de Synthèse Tarifaire & Heures de Pointe (100% Filtrable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-teal-200/80 p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
              Moyenne Hero Cab {arrondissementFilter !== 'all' ? `(${arrondissementFilter})` : '(Filtrée)'}
            </span>
            <span className="text-lg font-extrabold font-mono text-[#1F4F4A] mt-0.5 block">
              {filteredPricingSummary.avgHero > 0 ? `${filteredPricingSummary.avgHero.toLocaleString('fr-FR')} FCFA` : '—'}
            </span>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Award className="w-3 h-3" />
              {filteredPricingSummary.heroWinRate}% victoires
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Moyenne Yango {arrondissementFilter !== 'all' ? `(${arrondissementFilter})` : '(Filtrée)'}
            </span>
            <span className="text-lg font-extrabold font-mono text-slate-900 mt-0.5 block">
              {filteredPricingSummary.avgYango > 0 ? `${filteredPricingSummary.avgYango.toLocaleString('fr-FR')} FCFA` : '—'}
            </span>
          </div>
          {filteredPricingSummary.avgHero > 0 && filteredPricingSummary.avgYango > 0 && (
            <span className={`text-xs font-mono font-bold ${
              filteredPricingSummary.avgHero < filteredPricingSummary.avgYango ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {filteredPricingSummary.avgHero < filteredPricingSummary.avgYango
                ? `Hero -${(filteredPricingSummary.avgYango - filteredPricingSummary.avgHero).toLocaleString('fr-FR')} F`
                : `Yango -${(filteredPricingSummary.avgHero - filteredPricingSummary.avgYango).toLocaleString('fr-FR')} F`}
            </span>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Moyenne Trip Master
            </span>
            <span className="text-lg font-extrabold font-mono text-purple-800 mt-0.5 block">
              {filteredPricingSummary.avgTm > 0 ? `${filteredPricingSummary.avgTm.toLocaleString('fr-FR')} FCFA` : '—'}
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">Gamme Éco</span>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/90 p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
              Heures de Pointe & Trafic
            </span>
            <span className="text-lg font-extrabold font-mono text-amber-950 mt-0.5 block">
              {filteredPricingSummary.peakCampaignsCount} relevé(s)
            </span>
          </div>
          <div className="text-right space-y-0.5">
            <span className="block text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
              ⚡ {filteredPricingSummary.jamsTotalCount} embouteillage(s)
            </span>
            {filteredPricingSummary.shortageTotalCount > 0 && (
              <span className="block text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                ⚠️ {filteredPricingSummary.shortageTotalCount} pénurie(s)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#1F4F4A]" />
            <span>Relevés de Pricing ({isFiltered ? `${filteredCampaigns.length} filtrés` : 'Récents'})</span>
          </h2>
        </div>

        <DataTable
          columns={columns}
          data={isFiltered ? filteredCampaigns : filteredCampaigns.slice(0, 15)}
          searchPlaceholder="Rechercher par ville, commentaire, auteur..."
          searchKeys={['cityName', 'comment', 'triggeredByUserName', 'arrondissement']}
          exportFileName="activite_recente_pricing"
        />
      </div>
    </div>
  );
};

