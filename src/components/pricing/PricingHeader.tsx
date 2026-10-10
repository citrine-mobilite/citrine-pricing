import React from 'react';
import Swal from 'sweetalert2';
import { City, PricingCampaign } from '../../types';
import { Play, RotateCw, Trash2, Building2, SlidersHorizontal, Sparkles, Navigation, ArrowRight, Clock, MessageSquare, Zap, UserCircle, AlertTriangle } from 'lucide-react';
import { computeCampaignDuration, getCampaignPeakHourInfo } from '../../utils/durationUtils';
import { SearchableSelect } from '../SearchableSelect';
import { api } from '../../services/api';

interface PricingHeaderProps {
  cities: City[];
  currentCity: City;
  onSelectCityId: (cityId: string) => void;
  campaigns: PricingCampaign[];
  activeCampaignId: string;
  onCampaignChange: (campaignId: string) => void;
  onRefresh?: () => void;
  onDeleteCampaign?: () => void;
  activeTesterPanel: 'none' | 'single' | 'intra' | 'inter';
  onToggleTesterPanel: (panel: 'single' | 'intra' | 'inter') => void;
  totalCombinations: number;
  launchingTarget: string | null;
  onLaunch: (overrideLimit: number | 'all') => void;
  activeCampaign?: PricingCampaign;
}

export const PricingHeader: React.FC<PricingHeaderProps> = ({
  cities,
  currentCity,
  onSelectCityId,
  campaigns,
  activeCampaignId,
  onCampaignChange,
  onRefresh,
  onDeleteCampaign,
  activeTesterPanel,
  onToggleTesterPanel,
  totalCombinations,
  launchingTarget,
  onLaunch,
  activeCampaign
}) => {
  const isRunning = activeCampaign?.status === 'in_progress';

  const handleEditComment = async () => {
    if (!activeCampaign) return;
    const peak = getCampaignPeakHourInfo(activeCampaign);
    const currentSlot = activeCampaign.timeSlotOverride || 'auto';
    const currentComment = (activeCampaign.comment || activeCampaign.comments || '').replace(/"/g, '&quot;');

    const { value: formValues, isConfirmed } = await Swal.fire({
      title: 'Créneau & Commentaire du relevé',
      html: `
        <div style="text-align: left; font-size: 12px; color: #334155;">
          <p style="margin-bottom: 10px; font-weight: 600; color: #0f172a;">
            ${activeCampaign.cityName} — Relevé du ${new Date(activeCampaign.startedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <label style="display: block; font-weight: 700; margin-bottom: 4px; color: #475569;">
            1. Créneau horaire / Heure de pointe :
          </label>
          <select id="swal-header-slot" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 12px; font-size: 12px; background: #f8fafc;">
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
          <textarea id="swal-header-comment" rows="3" placeholder="Ex: Forte pluie, embouteillages, jour férié..." style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;">${currentComment}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#1F4F4A',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Enregistrer',
      cancelButtonText: 'Annuler',
      preConfirm: () => {
        const slotEl = document.getElementById('swal-header-slot') as HTMLSelectElement | null;
        const commentEl = document.getElementById('swal-header-comment') as HTMLTextAreaElement | null;
        return {
          timeSlotOverride: slotEl ? slotEl.value : 'auto',
          comment: commentEl ? commentEl.value.trim() : ''
        };
      }
    });

    if (isConfirmed && formValues) {
      try {
        await api.updateCampaignComment(activeCampaign.id, formValues.comment, formValues.timeSlotOverride);
        activeCampaign.comment = formValues.comment;
        activeCampaign.comments = formValues.comment;
        activeCampaign.timeSlotOverride = formValues.timeSlotOverride === 'auto' ? undefined : formValues.timeSlotOverride;
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

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      {/* Left : City Selector & Title */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A] shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Tarification & Benchmark VTC
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <label htmlFor="city-select" className="text-xs text-slate-500 font-medium">Ville cible :</label>
            <SearchableSelect
              id="city-select"
              options={cities.map((c) => ({
                value: String(c.id),
                label: c.name,
                sublabel: `${c.country}${!c.active ? ' • (Désactivée)' : ''}`
              }))}
              value={String(currentCity.id)}
              onChange={onSelectCityId}
              searchPlaceholder="Rechercher une ville..."
            />
          </div>
        </div>
      </div>

      {/* Right : Action Controls (Campaign Picker, Single Test, Launch Buttons) */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto justify-end">
        {/* Campaign Picker Dropdown */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {campaigns.length > 0 && (
            <div className="flex-1 sm:flex-none flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-[11px] text-slate-400 font-medium shrink-0">Relevé :</span>
              <SearchableSelect
                options={campaigns.map((c) => {
                  const peak = getCampaignPeakHourInfo(c);
                  return {
                    value: String(c.id),
                    label: `${c.cityName} — ${new Date(c.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
                    sublabel: `${peak.shortLabel} • ${c.completedPairs || 0} tr. • ⏱️ ${computeCampaignDuration(c)}${c.comment ? ` • 💬 ${c.comment}` : ''}`
                  };
                })}
                value={String(activeCampaignId)}
                onChange={onCampaignChange}
                searchPlaceholder="Rechercher un relevé..."
              />
            </div>
          )}

          {activeCampaign && (() => {
            const peak = getCampaignPeakHourInfo(activeCampaign);
            return (
              <>
                <button
                  type="button"
                  onClick={handleEditComment}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 cursor-pointer hover:opacity-80 transition ${peak.badgeClass}`}
                  title={`${peak.slotLabel} — Cliquer pour modifier le créneau`}
                >
                  <span>{peak.shortLabel}</span>
                </button>
                {peak.surgePct > 0 && (
                  <span
                    className="hidden md:inline-flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-300 px-2 py-1 rounded-lg text-xs font-bold shrink-0"
                    title="Forte demande / hausse tarifaire Yango par rapport au tarif creux"
                  >
                    <Zap className="w-3 h-3 text-amber-700" />
                    <span>+{peak.surgePct}%</span>
                  </span>
                )}
              </>
            );
          })()}

          {activeCampaign && (
            <span className="hidden sm:inline-flex items-center gap-1 bg-[#1F4F4A]/10 text-[#1F4F4A] px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0" title="Durée totale calculée">
              <Clock className="w-3.5 h-3.5" />
              <span>{computeCampaignDuration(activeCampaign)}</span>
            </span>
          )}

          {activeCampaign?.triggeredByUserName && (
            <span
              className="hidden md:inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-lg text-xs font-semibold shrink-0"
              title={`Campagne lancée par ${activeCampaign.triggeredByUserName}`}
            >
              <UserCircle className="w-3.5 h-3.5 text-[#1F4F4A]" />
              <span className="max-w-[110px] truncate">{activeCampaign.triggeredByUserName}</span>
            </span>
          )}

          {activeCampaign && (
            <button
              onClick={handleEditComment}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer shrink-0 ${
                activeCampaign.comment || activeCampaign.comments
                  ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/70'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title={activeCampaign.comment || 'Ajouter une note / contexte sur cette campagne'}
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
              <span className="max-w-[150px] truncate">
                {activeCampaign.comment || activeCampaign.comments || '+ Ajouter commentaire'}
              </span>
            </button>
          )}

          {activeCampaign && Boolean(activeCampaign.yangoShortageCount && activeCampaign.yangoShortageCount > 0) && (
            <span
              className="inline-flex items-center gap-1 bg-purple-100 text-purple-950 border border-purple-300 px-2 py-1 rounded-lg text-xs font-bold shrink-0"
              title="Trajets où aucun chauffeur VTC Yango n'était disponible (pénurie de véhicules)"
            >
              <AlertTriangle className="w-3 h-3 text-purple-700" />
              <span>{activeCampaign.yangoShortageCount} pénurie(s)</span>
            </span>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Rafraîchir les données"
              className="p-2 sm:p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer shrink-0"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          {/* Delete active campaign button */}
          {activeCampaignId && onDeleteCampaign && !isRunning && (
            <button
              onClick={onDeleteCampaign}
              title="Supprimer définitivement ce relevé"
              className="p-2 sm:p-2 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Buttons Row / Grid on Mobile */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* 1. Test Trajet Unique */}
          <button
            onClick={() => onToggleTesterPanel('single')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer min-h-[40px] sm:min-h-0 ${
              activeTesterPanel === 'single'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="truncate">Test Unique</span>
          </button>

          {/* 2. 1 Arrondissement (Intra) */}
          <button
            onClick={() => onToggleTesterPanel('intra')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer min-h-[40px] sm:min-h-0 ${
              activeTesterPanel === 'intra'
                ? 'bg-[#1F4F4A] text-white border-[#1F4F4A]'
                : 'bg-teal-50/70 text-teal-800 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="truncate">1 Arrond.</span>
          </button>

          {/* 3. 2 Arrondissements (Inter) */}
          <button
            onClick={() => onToggleTesterPanel('inter')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer min-h-[40px] sm:min-h-0 ${
              activeTesterPanel === 'inter'
                ? 'bg-blue-800 text-white border-blue-800'
                : 'bg-blue-50/70 text-blue-800 border-blue-200 hover:bg-blue-100'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">2 Arrond.</span>
          </button>

          {/* 4. Test Sample (25 pairs) */}
          <button
            onClick={() => onLaunch(25)}
            disabled={isRunning || launchingTarget !== null || totalCombinations === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-2xs min-h-[40px] sm:min-h-0 active:scale-95"
            title="Lancer un échantillon rapide de 25 trajets"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{launchingTarget === '25' ? 'Démarrage...' : 'Test 25'}</span>
          </button>

          {/* 5. Full Benchmark Launch */}
          <button
            onClick={() => onLaunch('all')}
            disabled={isRunning || launchingTarget !== null || totalCombinations === 0}
            className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer min-h-[40px] sm:min-h-0 active:scale-95"
            title={`Lancer la tarification de TOUS les ${totalCombinations.toLocaleString('fr-FR')} trajets`}
          >
            <Play className="w-3.5 h-3.5 fill-white shrink-0" />
            <span className="truncate font-bold">{launchingTarget === 'all' ? 'Lancement...' : `Tout (${totalCombinations.toLocaleString('fr-FR')})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
