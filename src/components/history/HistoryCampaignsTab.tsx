import React, { useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { PricingCampaign, City } from '../../types';
import { api } from '../../services/api';
import { DataTable, Column } from '../DataTable';
import {
  computeCampaignDuration,
  getCampaignPeakHourInfo,
  matchesTimeSlotFilter,
  TimeSlotFilter
} from '../../utils/durationUtils';
import { SearchableSelect } from '../SearchableSelect';
import {
  ArrowRight,
  Calendar,
  LayoutGrid,
  Table,
  RotateCw,
  Trash2,
  MessageSquare,
  MapPin,
  Zap,
  Filter
} from 'lucide-react';

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
  const [scopeFilter, setScopeFilter] = useState<'all' | 'city_wide' | 'arrondissement' | 'test_sample'>('all');
  const [arrondissementFilter, setArrondissementFilter] = useState<string>('all');
  const [timeSlotFilter, setTimeSlotFilter] = useState<TimeSlotFilter>('all');

  const availableArrondissements = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach(c => {
      if (cityFilter && c.cityId !== cityFilter) return;
      if (c.arrondissement && c.arrondissement.trim()) set.add(c.arrondissement.trim());
    });
    return Array.from(set).sort();
  }, [campaigns, cityFilter]);

  const handleEditComment = async (campaign: PricingCampaign, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const peak = getCampaignPeakHourInfo(campaign);
    const currentSlot = campaign.timeSlotOverride || 'auto';
    const currentComment = (campaign.comment || campaign.comments || '').replace(/"/g, '&quot;');

    const { value: formValues, isConfirmed } = await Swal.fire({
      title: 'Créneau & Commentaire du relevé',
      html: `
        <div style="text-align: left; font-size: 12px; color: #334155;">
          <p style="margin-bottom: 10px; font-weight: 600; color: #0f172a;">
            ${campaign.cityName} — Relevé du ${new Date(campaign.startedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <label style="display: block; font-weight: 700; margin-bottom: 4px; color: #475569;">
            1. Créneau horaire / Heure de pointe :
          </label>
          <select id="swal-hist-slot" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 12px; font-size: 12px; background: #f8fafc;">
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
          <textarea id="swal-hist-comment" rows="3" placeholder="Ex: Forte pluie, embouteillages, jour férié..." style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;">${currentComment}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#1F4F4A',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Enregistrer',
      cancelButtonText: 'Annuler',
      preConfirm: () => {
        const slotEl = document.getElementById('swal-hist-slot') as HTMLSelectElement | null;
        const commentEl = document.getElementById('swal-hist-comment') as HTMLTextAreaElement | null;
        return {
          timeSlotOverride: slotEl ? slotEl.value : 'auto',
          comment: commentEl ? commentEl.value.trim() : ''
        };
      }
    });

    if (isConfirmed && formValues) {
      try {
        await api.updateCampaignComment(campaign.id, formValues.comment, formValues.timeSlotOverride);
        campaign.comment = formValues.comment;
        campaign.comments = formValues.comment;
        campaign.timeSlotOverride = formValues.timeSlotOverride === 'auto' ? undefined : formValues.timeSlotOverride;
        onRefresh();
        Swal.fire({
          icon: 'success',
          title: 'Mis à jour',
          timer: 1200,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Impossible de sauvegarder.', 'error');
      }
    }
  };

  const handleDeleteCampaign = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const res = await Swal.fire({
      title: 'Supprimer cette campagne ?',
      text: 'Toutes les données associées seront définitivement supprimées de la base.',
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
        onRefresh();
        Swal.fire({
          icon: 'success',
          title: 'Campagne supprimée',
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Erreur lors de la suppression.', 'error');
      }
    }
  };

  const handleDeleteAllCompleted = async () => {
    const completedCampaigns = campaigns.filter(c => c.status === 'completed');
    if (completedCampaigns.length === 0) {
      Swal.fire('Information', 'Aucune campagne terminée à supprimer.', 'info');
      return;
    }
    const res = await Swal.fire({
      title: 'Supprimer toutes les campagnes terminées ?',
      text: `${completedCampaigns.length} campagne(s) terminée(s) et leurs trajets seront définitivement supprimés.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Oui, tout supprimer',
      cancelButtonText: 'Annuler'
    });
    if (res.isConfirmed) {
      try {
        for (const c of completedCampaigns) {
          await api.deleteCampaign(c.id);
        }
        onRefresh();
        Swal.fire({
          icon: 'success',
          title: 'Historique des campagnes vidé',
          text: `${completedCampaigns.length} campagne(s) supprimée(s).`,
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Erreur lors de la suppression.', 'error');
      }
    }
  };

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (cityFilter && c.cityId !== cityFilter) return false;

      const isSample = Boolean(c.isTestSample || (c.sampleLimit && c.sampleLimit <= 50) || (c.totalPairs && c.totalPairs <= 50));
      const isIntra = Boolean(c.scopeMode === 'intra' || c.arrondissement);

      if (scopeFilter === 'test_sample' && !isSample) return false;
      if (scopeFilter === 'city_wide' && (isSample || isIntra)) return false;
      if (scopeFilter === 'arrondissement' && !isIntra) return false;

      if (arrondissementFilter !== 'all') {
        if ((c.arrondissement || '').trim() !== arrondissementFilter) return false;
      }

      if (!matchesTimeSlotFilter(c, timeSlotFilter)) return false;

      return true;
    });
  }, [campaigns, cityFilter, scopeFilter, arrondissementFilter, timeSlotFilter]);

  const filteredStats = useMemo(() => {
    const total = filteredCampaigns.length;
    const totalTrips = filteredCampaigns.reduce((acc, c) => acc + (c.completedPairs || 0), 0);
    const withYango = filteredCampaigns.filter(c => c.avgPrice && c.avgPrice > 0);
    const avgYango = withYango.length > 0
      ? Math.round(withYango.reduce((acc, c) => acc + (c.avgPrice || 0), 0) / withYango.length)
      : 0;
    const withHero = filteredCampaigns.filter(c => c.heroStats?.avgPrice && c.heroStats.avgPrice > 0);
    const avgHero = withHero.length > 0
      ? Math.round(withHero.reduce((acc, c) => acc + (c.heroStats?.avgPrice || 0), 0) / withHero.length)
      : 0;
    const peakCount = filteredCampaigns.filter(c => getCampaignPeakHourInfo(c).isPeakHour).length;
    return { total, totalTrips, avgYango, avgHero, peakCount };
  }, [filteredCampaigns]);

  // Group campaigns strictly by calendar day
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
      label: 'Date, Créneau & Pointe',
      sortable: true,
      render: (c) => {
        const peakInfo = getCampaignPeakHourInfo(c);
        return (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-slate-900">
              {new Date(c.startedAt).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={(e) => handleEditComment(c, e)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:opacity-80 transition ${peakInfo.badgeClass}`}
                title={`${peakInfo.slotLabel} — Cliquer pour modifier le créneau`}
              >
                {peakInfo.shortLabel}
              </button>
              {peakInfo.surgePct > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300"
                  title="Forte demande / hausse tarifaire Yango par rapport au tarif creux"
                >
                  🔥 +{peakInfo.surgePct}%
                </span>
              )}
              {peakInfo.shortageCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                  <Zap className="w-2.5 h-2.5" /> {peakInfo.shortageCount} pén.
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'cityName',
      label: 'Ville & Zone',
      sortable: true,
      render: (c) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-800">{c.cityName}</span>
          {c.arrondissement ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded w-fit">
              <MapPin className="w-2.5 h-2.5" />
              {c.arrondissement}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">Ville globale</span>
          )}
        </div>
      )
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
        <span className="font-mono text-xs font-semibold text-slate-700">
          {computeCampaignDuration(c)}
        </span>
      )
    },
    {
      key: 'comment',
      label: 'Commentaire',
      render: (c) => (
        <div className="max-w-[220px]">
          {c.comment ? (
            <button
              onClick={(e) => handleEditComment(c, e)}
              className="group text-left flex items-start gap-1.5 text-xs text-slate-700 hover:text-[#1F4F4A] bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 px-2 py-1 rounded-lg transition cursor-pointer"
              title="Cliquer pour modifier le commentaire"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{c.comment}</span>
            </button>
          ) : (
            <button
              onClick={(e) => handleEditComment(c, e)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition cursor-pointer"
            >
              <MessageSquare className="w-3 h-3" />
              <span>+ Ajouter une note</span>
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
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              onSelectCampaign(String(c.id));
              onNavigate('pricing');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1F4F4A] hover:bg-[#1F4F4A]/10 rounded-lg transition cursor-pointer"
          >
            <span>Voir tableau</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => handleDeleteCampaign(String(c.id), e)}
            title="Supprimer cette campagne"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ], [onSelectCampaign, onNavigate]);

  return (
    <div className="space-y-4">
      {/* Statistiques filtrées de l'historique */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Campagnes filtrées</div>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            {filteredStats.total} <span className="text-xs font-normal text-slate-400">/ {campaigns.length}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Trajets analysés</div>
          <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
            {filteredStats.totalTrips.toLocaleString('fr-FR')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Moyenne Yango (filtrée)</div>
          <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
            {filteredStats.avgYango > 0 ? `${filteredStats.avgYango.toLocaleString('fr-FR')} F` : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Moyenne Hero Cab (filtrée)</div>
          <div className="text-base font-bold text-teal-700 mt-0.5 font-mono">
            {filteredStats.avgHero > 0 ? `${filteredStats.avgHero.toLocaleString('fr-FR')} F` : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Heures de pointe</div>
          <div className="text-base font-bold text-rose-700 mt-0.5">
            {filteredStats.peakCount} <span className="text-xs font-normal text-slate-500">campagne(s)</span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-[#1F4F4A]" />
            <span>Filtres :</span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="city-filter-select" className="text-xs text-slate-500 font-medium">Ville :</label>
            <SearchableSelect
              id="city-filter-select"
              options={[
                { value: '', label: 'Toutes les villes' },
                ...cities.map((c) => ({ value: c.id, label: c.name, sublabel: c.country }))
              ]}
              value={cityFilter}
              onChange={onCityFilterChange}
              searchPlaceholder="Rechercher une ville..."
            />
          </div>

          {/* Arrondissement */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 font-medium">Arrondissement :</label>
            <select
              value={arrondissementFilter}
              onChange={(e) => setArrondissementFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Tous arrondissements</option>
              {availableArrondissements.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Périmètre */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 font-medium">Périmètre :</label>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Tous périmètres</option>
              <option value="city_wide">Ville entière</option>
              <option value="arrondissement">Arrondissement (Intra)</option>
              <option value="test_sample">Tests (&le; 50)</option>
            </select>
          </div>

          {/* Heures de pointe & Créneaux */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 font-medium">Créneau / Pointe :</label>
            <select
              value={timeSlotFilter}
              onChange={(e) => setTimeSlotFilter(e.target.value as TimeSlotFilter)}
              className={`rounded-lg px-2 py-1 text-xs font-medium border focus:outline-none ${
                timeSlotFilter !== 'all'
                  ? 'bg-amber-50/80 border-amber-300 text-amber-900 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">Tous les créneaux (24h/24)</option>
              <option value="peak_any">🔥 Toutes Heures de Pointe (Matin, Midi, Soir)</option>
              <option value="morning_peak">🌅 Pointe Matin (06h00 – 10h00)</option>
              <option value="off_peak_morning">🟢 Creuse Matinée (10h00 – 12h00)</option>
              <option value="midday_peak">☀️ Pointe Midi (12h00 – 14h30)</option>
              <option value="off_peak_afternoon">🌤️ Creuse Après-midi (14h30 – 16h30)</option>
              <option value="evening_peak">🌆 Pointe Soir (16h30 – 20h30)</option>
              <option value="night">🌙 Creuse Soir / Nuit (20h30 – 06h00)</option>
              <option value="off_peak">🟢 Toutes Heures Creuses (Fluide)</option>
              <option value="with_shortage">⚠️ Avec Pénurie Chauffeurs</option>
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

        <div className="flex items-center gap-2">
          <button
            onClick={handleDeleteAllCompleted}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 rounded-lg transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vider les terminées</span>
          </button>

          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Cards View Grouped By Day */}
      {viewMode === 'cards' ? (
        <div className="space-y-6">
          {campaignsByDay.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              Aucune campagne enregistrée pour les filtres sélectionnés.
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
                    const peakInfo = getCampaignPeakHourInfo(c);
                    return (
                      <div
                        key={c.id}
                        className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-sm hover:shadow-md hover:border-[#1F4F4A]/40 transition flex flex-col justify-between gap-3"
                      >
                        {/* Top info */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <strong className="text-xs font-bold text-slate-900 truncate">
                                {c.cityName}
                              </strong>
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
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

                          {/* Peak Hour & Arrondissement Badges */}
                          <div className="flex flex-wrap items-center gap-1 mb-2">
                            <button
                              type="button"
                              onClick={(e) => handleEditComment(c, e)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:opacity-80 transition ${peakInfo.badgeClass}`}
                              title={`${peakInfo.slotLabel} — Cliquer pour modifier le créneau`}
                            >
                              {peakInfo.shortLabel}
                            </button>
                            {c.arrondissement && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                                <MapPin className="w-2.5 h-2.5" />
                                {c.arrondissement}
                              </span>
                            )}
                            {peakInfo.surgePct > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300"
                                title="Forte demande / hausse tarifaire Yango par rapport au tarif creux"
                              >
                                🔥 +{peakInfo.surgePct}%
                              </span>
                            )}
                            {peakInfo.shortageCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                                <Zap className="w-2.5 h-2.5" /> {peakInfo.shortageCount} pén.
                              </span>
                            )}
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
                              <span className="text-slate-500 text-[11px]">Durée calculée :</span>
                              <span className="font-mono font-semibold text-[#1F4F4A] text-[11px]">
                                {computeCampaignDuration(c)}
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

                          {/* Comment Section */}
                          <div className="mt-2">
                            {c.comment ? (
                              <button
                                onClick={(e) => handleEditComment(c, e)}
                                className="w-full text-left flex items-start gap-1.5 text-[11px] text-slate-700 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 p-1.5 rounded-lg transition cursor-pointer"
                                title="Modifier le commentaire"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{c.comment}</span>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => handleEditComment(c, e)}
                                className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 py-1 rounded-md border border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Ajouter un commentaire</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onSelectCampaign(String(c.id));
                              onNavigate('pricing');
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1F4F4A] bg-[#1F4F4A]/10 hover:bg-[#1F4F4A] hover:text-white rounded-lg transition cursor-pointer"
                          >
                            <span>Voir les résultats</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteCampaign(String(c.id), e)}
                            title="Supprimer cette campagne"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
          searchPlaceholder="Rechercher par date, ville, arrondissement ou commentaire..."
          searchKeys={['cityName', 'arrondissement', 'comment']}
          exportFileName="historique_campagnes_vtc"
        />
      )}
    </div>
  );
};

