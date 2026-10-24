import React, { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { PricingCampaign } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from './DataTable';
import {
  ArrowRight,
  RotateCw,
  Trash2,
  Clock,
  MessageSquare,
  Play,
  Zap,
  Filter,
  RotateCcw,
  Building2,
  MapPin,
  Award
} from 'lucide-react';
import { computeCampaignDuration, getCampaignPeakHourInfo, matchesTimeSlotFilter, TimeSlotFilter } from '../utils/durationUtils';

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

  const [cityFilter, setCityFilter] = useState<string>('all');
  const [arrondissementFilter, setArrondissementFilter] = useState<string>('all');
  const [timeSlotFilter, setTimeSlotFilter] = useState<TimeSlotFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const availableCities = useMemo(() => {
    const map = new Map<string, string>();
    campaigns.forEach(c => {
      if (c.cityId && c.cityName) map.set(c.cityId, c.cityName);
    });
    return Array.from(map.entries());
  }, [campaigns]);

  const availableArrondissements = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach(c => {
      if (cityFilter !== 'all' && c.cityId !== cityFilter) return;
      if (c.arrondissement?.trim()) set.add(c.arrondissement.trim());
      if (c.originArrondissement?.trim()) set.add(c.originArrondissement.trim());
      if (c.destArrondissement?.trim()) set.add(c.destArrondissement.trim());
      if (c.arrondissementStats) {
        Object.keys(c.arrondissementStats).forEach(a => {
          if (a.trim()) set.add(a.trim());
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  }, [campaigns, cityFilter]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (cityFilter !== 'all' && c.cityId !== cityFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (arrondissementFilter !== 'all') {
        const target = arrondissementFilter.toLowerCase().trim();
        const matchExplicit =
          (c.arrondissement || '').toLowerCase().trim() === target ||
          (c.originArrondissement || '').toLowerCase().trim() === target ||
          (c.destArrondissement || '').toLowerCase().trim() === target;
        const hasStats = Boolean(
          c.arrondissementStats &&
          Object.keys(c.arrondissementStats).some(k => k.toLowerCase().trim() === target)
        );
        if (!matchExplicit && !hasStats) return false;
      }
      if (!matchesTimeSlotFilter(c, timeSlotFilter)) return false;
      return true;
    });
  }, [campaigns, cityFilter, statusFilter, arrondissementFilter, timeSlotFilter]);

  const isFiltered =
    cityFilter !== 'all' ||
    arrondissementFilter !== 'all' ||
    timeSlotFilter !== 'all' ||
    statusFilter !== 'all';

  // Synthèse tarifaire et trafic pour les 4 cartes (filtrable dynamiquement)
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

  const handleEditComment = async (c: PricingCampaign) => {
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
          <select id="swal-camp-slot" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 12px; font-size: 12px; background: #f8fafc;">
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
          <textarea id="swal-camp-comment" rows="3" placeholder="Ex: Forte pluie, embouteillages, jour férié..." style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;">${currentComment}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#1F4F4A',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Enregistrer',
      cancelButtonText: 'Annuler',
      preConfirm: () => {
        const slotEl = document.getElementById('swal-camp-slot') as HTMLSelectElement | null;
        const commentEl = document.getElementById('swal-camp-comment') as HTMLTextAreaElement | null;
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
        onRefresh();
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

  const handleDelete = async (id: string) => {
    const res = await Swal.fire({
      title: 'Supprimer ce relevé ?',
      text: 'Tous les trajets et métriques associés seront définitivement effacés.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler'
    });
    if (res.isConfirmed) {
      try {
        await api.deleteCampaign(id);
        onRefresh();
        Swal.fire({
          icon: 'success',
          title: 'Campagne supprimée',
          timer: 1300,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Erreur lors de la suppression.', 'error');
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
              <span>{c.originArrondissement} ➔ {c.destArrondissement}</span>
            </span>
          ) : null}
        </div>
      )
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
      label: 'Date, Heure & Pointe',
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
                onClick={() => handleEditComment(c)}
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
      key: 'duration',
      label: 'Durée',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium font-mono">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{computeCampaignDuration(c)}</span>
        </div>
      )
    },
    {
      key: 'totalPairs',
      label: 'Paires Trajets',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-mono text-xs font-semibold text-slate-700">
          {(c.completedPairs || 0).toLocaleString('fr-FR')} / {(c.totalPairs || 0).toLocaleString('fr-FR')}
        </span>
      )
    },
    {
      key: 'avgPrice',
      label: 'Moyenne (Éco)',
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
              className="text-left group flex items-start gap-1.5 p-1.5 bg-teal-50/60 hover:bg-teal-100/70 border border-teal-200/70 rounded-lg text-slate-700 transition cursor-pointer"
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
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-[#1F4F4A] bg-slate-50 hover:bg-teal-50 border border-slate-200 px-2 py-1 rounded-lg transition cursor-pointer"
              title="Ajouter un commentaire"
            >
              <MessageSquare className="w-3 h-3" />
              <span>+ Commentaire</span>
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
      {/* Header & Filtres */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Campagnes de Pricing</span>
              <span className="text-xs font-semibold text-[#1F4F4A] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
                {filteredCampaigns.length} / {campaigns.length}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Historique, heures de pointe, commentaires et état d'exécution de toutes les campagnes.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {isFiltered && (
              <button
                onClick={() => {
                  setCityFilter('all');
                  setArrondissementFilter('all');
                  setTimeSlotFilter('all');
                  setStatusFilter('all');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('pricing')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition cursor-pointer shadow-2xs"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Lancer un relevé</span>
            </button>
          </div>
        </div>

        {/* Barre de filtres responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
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
              <option value="all">Toutes les villes</option>
              {availableCities.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3 text-teal-700" />
              <span>Arrondissement</span>
            </label>
            <select
              value={arrondissementFilter}
              onChange={(e) => setArrondissementFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
            >
              <option value="all">Tous les arrondissements</option>
              {availableArrondissements.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Heures de pointe & Créneaux</span>
            </label>
            <select
              value={timeSlotFilter}
              onChange={(e) => setTimeSlotFilter(e.target.value as TimeSlotFilter)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
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

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-600" />
              <span>Statut</span>
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="completed">Succès / Terminées</option>
              <option value="in_progress">En cours</option>
              <option value="cancelled">Arrêtées</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4 Cartes de Synthèse Tarifaire & Trafic (100% Responsives) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Hero Cab */}
        <div className="bg-white rounded-xl border border-teal-200/90 p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-2.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-teal-700 truncate" title="Moyenne Hero Cab">
              Moyenne Hero Cab {arrondissementFilter !== 'all' ? `(${arrondissementFilter})` : isFiltered ? '(Filtrée)' : ''}
            </span>
            {filteredPricingSummary.heroWinRate > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <Award className="w-3 h-3 text-emerald-600" />
                <span>{filteredPricingSummary.heroWinRate}% victoires</span>
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg sm:text-xl font-extrabold font-mono text-[#1F4F4A] tracking-tight">
              {filteredPricingSummary.avgHero > 0 ? `${filteredPricingSummary.avgHero.toLocaleString('fr-FR')} FCFA` : '—'}
            </span>
            <span className="text-[10px] font-medium text-slate-400">Tarif moyen</span>
          </div>
        </div>

        {/* 2. Yango */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-2.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Moyenne Yango">
              Moyenne Yango {arrondissementFilter !== 'all' ? `(${arrondissementFilter})` : isFiltered ? '(Filtrée)' : ''}
            </span>
            {filteredPricingSummary.avgHero > 0 && filteredPricingSummary.avgYango > 0 && (
              <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                filteredPricingSummary.avgHero < filteredPricingSummary.avgYango
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
                  : 'text-rose-600 bg-rose-50 border border-rose-200/80'
              }`}>
                {filteredPricingSummary.avgHero < filteredPricingSummary.avgYango
                  ? `Hero -${(filteredPricingSummary.avgYango - filteredPricingSummary.avgHero).toLocaleString('fr-FR')} F`
                  : `Yango -${(filteredPricingSummary.avgHero - filteredPricingSummary.avgYango).toLocaleString('fr-FR')} F`}
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 tracking-tight">
              {filteredPricingSummary.avgYango > 0 ? `${filteredPricingSummary.avgYango.toLocaleString('fr-FR')} FCFA` : '—'}
            </span>
            <span className="text-[10px] font-medium text-slate-400">Tarif moyen</span>
          </div>
        </div>

        {/* 3. Trip Master */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-2.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Moyenne Trip Master">
              Moyenne Trip Master
            </span>
            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 px-1.5 py-0.5 rounded shrink-0">
              Gamme Éco
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg sm:text-xl font-extrabold font-mono text-purple-800 tracking-tight">
              {filteredPricingSummary.avgTm > 0 ? `${filteredPricingSummary.avgTm.toLocaleString('fr-FR')} FCFA` : '—'}
            </span>
            <span className="text-[10px] font-medium text-slate-400">Tarif moyen</span>
          </div>
        </div>

        {/* 4. Heures de Pointe & Trafic */}
        <div className="bg-white rounded-xl border border-amber-200/90 p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-2.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate" title="Heures de Pointe & Trafic">
              Heures de Pointe & Trafic
            </span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
              {filteredPricingSummary.peakCampaignsCount} relevé(s)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              <span>⚡ {filteredPricingSummary.jamsTotalCount.toLocaleString('fr-FR')} embouteillage(s)</span>
            </span>
            {filteredPricingSummary.shortageTotalCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                <span>⚠️ {filteredPricingSummary.shortageTotalCount.toLocaleString('fr-FR')} pénurie(s)</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tableau des Campagnes */}
      <DataTable
        columns={columns}
        data={filteredCampaigns}
        searchPlaceholder="Rechercher par ville, auteur ou commentaire..."
        searchKeys={['cityName', 'comment', 'triggeredByUserName', 'arrondissement']}
        exportFileName="campagnes_pricing_citrine"
      />
    </div>
  );
};
