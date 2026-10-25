import React from 'react';
import Swal from 'sweetalert2';
import { City, PricingCampaign } from '../../types';
import {
  Play,
  RotateCw,
  Trash2,
  Building2,
  SlidersHorizontal,
  Sparkles,
  Navigation,
  ArrowRight,
  Clock,
  MessageSquare,
  Zap,
  UserCircle,
  AlertTriangle,
  Plane,
  CheckCircle2
} from 'lucide-react';
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
  activeTesterPanel: 'none' | 'single' | 'intra' | 'inter' | 'airport';
  onToggleTesterPanel: (panel: 'single' | 'intra' | 'inter' | 'airport') => void;
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
    const currentComment = (activeCampaign.comment || activeCampaign.comments || '').replace(/"/g, '&quot;');

    const { value: commentText, isConfirmed } = await Swal.fire({
      title: 'Commentaire du relevé',
      html: `
        <div style="text-align: left; font-size: 12px; color: #334155;">
          <p style="margin-bottom: 10px; font-weight: 600; color: #0f172a;">
            ${activeCampaign.cityName} — Relevé du ${new Date(activeCampaign.startedAt).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <label style="display: block; font-weight: 700; margin-bottom: 4px; color: #475569;">
            Commentaire / Observation (météo, trafic, événement) :
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
        const commentEl = document.getElementById('swal-header-comment') as HTMLTextAreaElement | null;
        return commentEl ? commentEl.value.trim() : '';
      }
    });

    if (isConfirmed && commentText !== undefined) {
      try {
        await api.updateCampaignComment(activeCampaign.id, commentText, activeCampaign.timeSlotOverride);
        activeCampaign.comment = commentText;
        activeCampaign.comments = commentText;
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

  const peakInfo = activeCampaign ? getCampaignPeakHourInfo(activeCampaign) : null;
  const shortageCount = activeCampaign?.yangoShortageCount || 0;
  const hasTension = Boolean(peakInfo && peakInfo.surgePct > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-4.5 space-y-3.5">
      {/* ===================================================================== */}
      {/* LIGNE 1 : CONTRÔLES DU PÉRIMÈTRE & BADGES D'ÉTAT DU RELEVÉ          */}
      {/* ===================================================================== */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        {/* Sélecteurs Ville, Relevé et Actions Rapides */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Sélecteur de Ville */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 shrink-0 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-[#1F4F4A] shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500">Ville :</span>
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

          {/* Sélecteur de Relevé / Campagne */}
          {campaigns.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 flex-1 sm:flex-none shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 shrink-0">Relevé :</span>
              <SearchableSelect
                options={campaigns.map((c) => {
                  const peak = getCampaignPeakHourInfo(c);
                  return {
                    value: String(c.id),
                    label: `${c.cityName} — ${new Date(c.startedAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`,
                    sublabel: `${peak.shortLabel} • ${c.completedPairs || 0} tr. • ⏱️ ${computeCampaignDuration(c)}${
                      c.comment ? ` • 💬 ${c.comment}` : ''
                    }`
                  };
                })}
                value={String(activeCampaignId)}
                onChange={onCampaignChange}
                searchPlaceholder="Rechercher un relevé..."
              />
            </div>
          )}

          {/* Boutons Rafraîchir & Supprimer */}
          <div className="flex items-center gap-1 shrink-0 ml-auto lg:ml-0">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Actualiser les relevés et statistiques"
                className="p-1.5 border border-slate-200/80 hover:bg-slate-100 rounded-xl text-slate-600 transition cursor-pointer shadow-2xs"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}

            {activeCampaignId && onDeleteCampaign && !isRunning && (
              <button
                type="button"
                onClick={onDeleteCampaign}
                title="Supprimer définitivement ce relevé"
                className="p-1.5 border border-slate-200/80 hover:border-rose-300 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Indicateurs Synthétiques du Relevé Actif (Tension, Pénurie, Créneau, Durée, Auteur, Note) */}
        {activeCampaign && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs w-full lg:w-auto lg:justify-end">
            {/* 1. MENTION EXPLICITE : TRAJETS EN TENSION */}
            {hasTension ? (
              <span
                className="inline-flex items-center gap-1 bg-amber-50 text-amber-950 border border-amber-300 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 shadow-2xs"
                title="Trajets en tension : forte demande constatée et tarif ajusté ROUGE"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Trajets en tension (+{peakInfo?.surgePct}%)</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 shadow-2xs"
                title="Aucune tension tarifaire majeure détectée"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Tension normale</span>
              </span>
            )}

            {/* 2. MENTION EXPLICITE : TRAJETS EN PÉNURIE (GARDER AFFICHÉ) */}
            {shortageCount > 0 ? (
              <span
                className="inline-flex items-center gap-1 bg-purple-50 text-purple-950 border border-purple-300 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 shadow-2xs"
                title="Trajets en pénurie : aucun véhicule ROUGE disponible lors du relevé"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-purple-700" />
                <span>{shortageCount} trajet(s) en pénurie</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 border border-slate-200 px-2 py-1 rounded-xl text-xs font-medium shrink-0"
                title="Aucune pénurie de véhicules signalée"
              >
                <span>0 pénurie</span>
              </span>
            )}

            {/* 3. Créneau Horaire */}
            {peakInfo && (
              <button
                type="button"
                onClick={handleEditComment}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border shrink-0 cursor-pointer hover:opacity-85 transition shadow-2xs ${peakInfo.badgeClass}`}
                title={`${peakInfo.slotLabel} — Cliquer pour modifier la note`}
              >
                <span>{peakInfo.shortLabel}</span>
              </button>
            )}

            {/* 4. Durée du Relevé */}
            <span
              className="inline-flex items-center gap-1 bg-[#1F4F4A]/10 text-[#1F4F4A] px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0"
              title="Durée totale calculée"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{computeCampaignDuration(activeCampaign)}</span>
            </span>

            {/* 5. Utilisateur Ayant Lancé */}
            {activeCampaign.triggeredByUserName && (
              <span
                className="hidden xl:inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-xl text-xs font-medium shrink-0"
                title={`Relevé lancé par ${activeCampaign.triggeredByUserName}`}
              >
                <UserCircle className="w-3.5 h-3.5 text-[#1F4F4A]" />
                <span className="max-w-[110px] truncate">{activeCampaign.triggeredByUserName}</span>
              </span>
            )}

            {/* 6. Commentaire / Note */}
            <button
              type="button"
              onClick={handleEditComment}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition cursor-pointer shrink-0 shadow-2xs ${
                activeCampaign.comment || activeCampaign.comments
                  ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title={activeCampaign.comment || 'Ajouter une note ou contexte sur ce relevé'}
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
              <span className="max-w-[120px] truncate">
                {activeCampaign.comment || activeCampaign.comments || 'Note'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* LIGNE 2 : MODES DE CIBLAGE RÉORGANISÉS & DÉCLENCHEMENT DE TARIFICATION */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Navigation des Modes de Ciblage (Segmented Group) */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 hidden md:inline-block">
            Ciblage :
          </span>

          {/* Test Unique */}
          <button
            type="button"
            onClick={() => onToggleTesterPanel('single')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTesterPanel === 'single'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Test Unique</span>
          </button>

          {/* 1 Arrondissement */}
          <button
            type="button"
            onClick={() => onToggleTesterPanel('intra')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTesterPanel === 'intra'
                ? 'bg-[#1F4F4A] text-white shadow-xs'
                : 'text-teal-800 hover:text-teal-900 hover:bg-white/80'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            <span>1 Arrondissement</span>
          </button>

          {/* 2 Arrondissements */}
          <button
            type="button"
            onClick={() => onToggleTesterPanel('inter')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTesterPanel === 'inter'
                ? 'bg-blue-800 text-white shadow-xs'
                : 'text-blue-800 hover:text-blue-900 hover:bg-white/80'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span>2 Arrondissements</span>
          </button>

          {/* Pricing Destinations Aéroport */}
          <button
            type="button"
            onClick={() => onToggleTesterPanel('airport')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTesterPanel === 'airport'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'text-sky-800 hover:text-sky-900 hover:bg-white/80'
            }`}
            title="Tarification systématique vers l'aéroport international"
          >
            <Plane className="w-3.5 h-3.5 shrink-0" />
            <span>Pricing Aéroport</span>
          </button>
        </div>

        {/* Boutons d'Action de Lancement */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          {/* Échantillon Rapide 25 */}
          <button
            type="button"
            onClick={() => onLaunch(25)}
            disabled={isRunning || launchingTarget !== null || totalCombinations === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-2xs active:scale-98"
            title="Lancer un échantillon rapide de 25 trajets"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{launchingTarget === '25' ? 'Démarrage...' : 'Échantillon (25)'}</span>
          </button>

          {/* Lancer Tout */}
          <button
            type="button"
            onClick={() => onLaunch('all')}
            disabled={isRunning || launchingTarget !== null || totalCombinations === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-[#1F4F4A] hover:bg-[#163834] text-white rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-98"
            title={`Lancer la tarification complète de tous les ${totalCombinations.toLocaleString('fr-FR')} trajets`}
          >
            <Play className="w-3.5 h-3.5 fill-white shrink-0" />
            <span>{launchingTarget === 'all' ? 'Lancement...' : `Lancer Tout (${totalCombinations.toLocaleString('fr-FR')})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
