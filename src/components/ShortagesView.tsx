import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertOctagon,
  TrendingDown,
  Building2,
  Clock,
  MapPin,
  Search,
  Download,
  Filter,
  RotateCw,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Flame,
  ArrowRight,
  Layers,
  Sparkles,
  ZapOff
} from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../services/api';
import { City, CampaignShortageRecord, ShortagesAnalyticsSummary } from '../types';

interface ShortagesViewProps {
  cities: City[];
  onNavigate: (tab: string) => void;
  onSelectCampaign?: (campaignId: string) => void;
}

export const ShortagesView: React.FC<ShortagesViewProps> = ({
  cities,
  onNavigate,
  onSelectCampaign
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('all');
  const [selectedArrondissement, setSelectedArrondissement] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [shortages, setShortages] = useState<CampaignShortageRecord[]>([]);
  const [analytics, setAnalytics] = useState<ShortagesAnalyticsSummary | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getShortages({
        cityId: selectedCity,
        timeSlot: selectedTimeSlot,
        arrondissement: selectedArrondissement,
        search: searchQuery.trim(),
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
      });
      setShortages(res.shortages || []);
      setTotalCount(res.total || 0);
      setAnalytics(res.analytics || null);
    } catch (err: any) {
      console.warn('[ShortagesView] Error fetching shortages:', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity, selectedTimeSlot, selectedArrondissement, searchQuery, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData();
  };

  const handleDelete = async (id: string | number) => {
    const res = await Swal.fire({
      title: 'Supprimer ce relevé de pénurie ?',
      text: 'Ce trajet sera retiré du registre des ruptures.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });

    if (res.isConfirmed) {
      try {
        await api.deleteShortage(id);
        setShortages(prev => prev.filter(s => s.id !== id));
        setTotalCount(prev => Math.max(0, prev - 1));
        Swal.fire({
          icon: 'success',
          title: 'Supprimé',
          timer: 1000,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Erreur lors de la suppression.', 'error');
      }
    }
  };

  const handleReExtract = async () => {
    setIsLoading(true);
    try {
      const res = await api.reExtractShortages();
      Swal.fire({
        icon: 'success',
        title: 'Synchronisation terminée',
        text: `${res.extractedCount} trajets en pénurie extraits depuis l'historique des campagnes. Total : ${res.total} enregistrements.`,
        timer: 2500,
        showConfirmButton: false
      });
      setCurrentPage(1);
      loadData();
    } catch (err: any) {
      Swal.fire('Erreur', err?.message || 'Erreur lors de la ré-extraction.', 'error');
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    setIsExporting(true);
    const exportUrl = api.getShortagesExportUrl(selectedCity, selectedTimeSlot);
    window.location.href = exportUrl;
    setTimeout(() => setIsExporting(false), 1500);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Calcul des arrondissements disponibles
  const availableArrondissements = useMemo(() => {
    if (!analytics?.byArrondissement) return [];
    return analytics.byArrondissement.map(a => a.name);
  }, [analytics]);

  const topCorridor = analytics?.topCorridors?.[0];
  const peakSlot = analytics?.byTimeSlot?.slice().sort((a, b) => b.count - a.count)?.[0];
  const topOrigin = analytics?.topOrigins?.[0];

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ZapOff className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Pénuries & Ruptures de Trajets (Yango Unavailable)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                    Registre Post-Campagne
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extraction et cartographie des trajets n'ayant trouvé aucun chauffeur lors des campagnes de relevé.
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleReExtract}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition cursor-pointer"
              title="Scanner et extraire les trajets en pénurie depuis l'historique complet"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#1F4F4A]' : 'text-slate-600'}`} />
              <span>Ré-extraire</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={isExporting || totalCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter CSV ({totalCount})</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-slate-100 text-xs">
          {/* City Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedCity}
              onChange={(e) => { setSelectedCity(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-xs font-semibold text-slate-800 w-full focus:outline-none cursor-pointer"
            >
              <option value="all">Toutes les villes</option>
              {cities.map(c => (
                <option key={String(c.id)} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* TimeSlot Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedTimeSlot}
              onChange={(e) => { setSelectedTimeSlot(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-xs font-semibold text-slate-800 w-full focus:outline-none cursor-pointer"
            >
              <option value="all">Tous les créneaux</option>
              <option value="08:00">Matin (08:00)</option>
              <option value="13:00">Midi (13:00)</option>
              <option value="18:00">Soirée (18:00)</option>
            </select>
          </div>

          {/* Arrondissement Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedArrondissement}
              onChange={(e) => { setSelectedArrondissement(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-xs font-semibold text-slate-800 w-full focus:outline-none cursor-pointer"
            >
              <option value="all">Tous les arrondissements</option>
              {availableArrondissements.map(arr => (
                <option key={arr} value={arr}>{arr}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Rechercher quartier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-slate-800 w-full focus:outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </form>
        </div>
      </div>

      {/* 2. Top Analytical KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Pénuries */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Trajets en Pénurie</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {totalCount.toLocaleString('fr-FR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Trajets où le client a subi une absence de taxi
          </div>
        </div>

        {/* Card 2: Corridor Critique */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Corridor le Plus Bloqué</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-900 truncate" title={topCorridor ? `${topCorridor.origin} ➔ ${topCorridor.destination}` : '—'}>
            {topCorridor ? `${topCorridor.origin} ➔ ${topCorridor.destination}` : 'Données en cours'}
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1">
            {topCorridor ? `${topCorridor.count} ruptures recensées` : '—'}
          </div>
        </div>

        {/* Card 3: Créneau Pic */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Créneau Horaire Critique</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {peakSlot?.label || '18:00'}
          </div>
          <div className="text-[11px] text-purple-700 font-semibold mt-1">
            {peakSlot ? `${peakSlot.count} ruptures (${peakSlot.pct}%)` : '—'}
          </div>
        </div>

        {/* Card 4: Quartier d'Origine Critique */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Zone Départ la Plus Saturée</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#1F4F4A] flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-900 truncate" title={topOrigin?.name || '—'}>
            {topOrigin?.name || 'Calcul en cours'}
          </div>
          <div className="text-[11px] text-[#1F4F4A] font-semibold mt-1">
            {topOrigin ? `${topOrigin.count} départs sans chauffeur` : '—'}
          </div>
        </div>
      </div>

      {/* 3. Visual Analysis Panels */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Top Corridors List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-600" />
                <span>Top Corridors & Axes à Forte Pénurie</span>
              </h3>
              <span className="text-[11px] text-slate-400">Classé par volume de ruptures</span>
            </div>

            <div className="space-y-2.5">
              {analytics.topCorridors.slice(0, 8).map((corridor, idx) => {
                const maxCount = analytics.topCorridors[0]?.count || 1;
                const ratio = Math.min(100, Math.round((corridor.count / maxCount) * 100));

                return (
                  <div key={idx} className="bg-slate-50/70 hover:bg-slate-50 rounded-lg p-2.5 border border-slate-100 transition text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {corridor.origin}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-900 truncate">
                          {corridor.destination}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                          {corridor.count} ruptures
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-rose-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown by TimeSlot & Arrondissement */}
          <div className="space-y-5">
            {/* By TimeSlot */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1F4F4A]" />
                <span>Ruptures par Créneau</span>
              </h3>
              <div className="space-y-2 text-xs">
                {analytics.byTimeSlot.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">{s.label}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-slate-900">{s.count}</span>
                      <span className="text-[10px] text-slate-400 font-sans">({s.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Arrondissement */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1F4F4A]" />
                <span>Arrondissements les Plus Touchés</span>
              </h3>
              <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto">
                {analytics.byArrondissement.slice(0, 6).map((arr, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0">
                    <span className="font-medium text-slate-700 truncate">{arr.name}</span>
                    <span className="font-mono font-bold text-slate-900 shrink-0">{arr.count} ({arr.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Complete Shortages Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ZapOff className="w-4 h-4 text-rose-600" />
              <span>Table des Trajets en Pénurie (Enregistrée en Fin de Campagne)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Affichage de {shortages.length} trajet(s) sur {totalCount.toLocaleString('fr-FR')} au total.
            </p>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono font-bold text-slate-800">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Quartier Départ</th>
                <th className="px-3 py-2.5">Quartier Arrivée</th>
                <th className="px-3 py-2.5">Campagne</th>
                <th className="px-3 py-2.5">Heure / Créneau</th>
                <th className="px-3 py-2.5 text-right">Distance</th>
                <th className="px-3 py-2.5 text-center">Attente Estimée</th>
                <th className="px-3 py-2.5 text-center">Statut Rupture</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {shortages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Aucun trajet en pénurie ne correspond aux filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                shortages.map((item) => (
                  <tr key={String(item.id)} className="hover:bg-slate-50/80 transition">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{item.origin}</div>
                      <div className="text-[10px] text-slate-400">{item.arrondissementOrigin || 'Douala'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{item.destination}</div>
                      <div className="text-[10px] text-slate-400">{item.arrondissementDest || 'Douala'}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      <button
                        onClick={() => onSelectCampaign?.(String(item.campaignId))}
                        className="text-[#1F4F4A] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                        title="Consulter la campagne"
                      >
                        <span>#{String(item.campaignId).slice(0, 8)}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-slate-800">
                        {new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-purple-700 font-semibold">{item.timeSlot}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {item.distanceKm ? `${item.distanceKm} km` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        ~{item.waitingMinutes || 12} min
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                        <ZapOff className="w-2.5 h-2.5" />
                        <span>Pas de taxi</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Supprimer ce relevé"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
