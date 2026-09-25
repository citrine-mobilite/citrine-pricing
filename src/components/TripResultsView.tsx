import React, { useEffect, useState, useMemo } from 'react';
import { PricingCampaign, TripResult } from '../types';
import {
  TableProperties,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  Grid,
  List,
  Sparkles,
  TrendingDown,
  TrendingUp,
  MapPin,
  Clock,
  Car
} from 'lucide-react';
import { api } from '../services/api';

interface TripResultsViewProps {
  campaigns: PricingCampaign[];
  selectedCampaignId: string | null;
  onSelectCampaignId: (id: string) => void;
}

export const TripResultsView: React.FC<TripResultsViewProps> = ({
  campaigns,
  selectedCampaignId,
  onSelectCampaignId
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('table');
  const [trips, setTrips] = useState<TripResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [startFilter, setStartFilter] = useState('');
  const [endFilter, setEndFilter] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'distanceKm' | 'pricePerKm'>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const currentCampaign =
    campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];

  useEffect(() => {
    if (!currentCampaign) return;
    setIsLoading(true);
    api
      .getCampaignResults(currentCampaign.id)
      .then((data) => setTrips(data))
      .catch((err) => console.error('Error fetching trips:', err))
      .finally(() => setIsLoading(false));
  }, [currentCampaign?.id]);

  // Extract distinct neighborhood names
  const neighborhoodsList = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      set.add(t.startNeighborhoodName);
      set.add(t.endNeighborhoodName);
    });
    return Array.from(set).sort();
  }, [trips]);

  // Filtered & Sorted trips
  const filteredTrips = useMemo(() => {
    let list = trips;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.startNeighborhoodName.toLowerCase().includes(q) ||
          t.endNeighborhoodName.toLowerCase().includes(q)
      );
    }

    if (startFilter) {
      list = list.filter((t) => t.startNeighborhoodName === startFilter);
    }

    if (endFilter) {
      list = list.filter((t) => t.endNeighborhoodName === endFilter);
    }

    return [...list].sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [trips, search, startFilter, endFilter, sortBy, sortOrder]);

  // Key metrics calculation
  const stats = useMemo(() => {
    if (trips.length === 0) return { min: 0, max: 0, avg: 0, avgKm: 0, maxTrip: null, minTrip: null };
    const prices = trips.map((t) => t.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const avgKm = Number(
      (trips.reduce((a, b) => a + b.distanceKm, 0) / trips.length).toFixed(1)
    );
    const maxTrip = trips.find((t) => t.price === max);
    const minTrip = trips.find((t) => t.price === min);

    return { min, max, avg, avgKm, maxTrip, minTrip };
  }, [trips]);

  // Matrix construction
  const matrixData = useMemo(() => {
    const map: Record<string, Record<string, TripResult>> = {};
    neighborhoodsList.forEach((o) => {
      map[o] = {};
    });
    trips.forEach((t) => {
      if (map[t.startNeighborhoodName]) {
        map[t.startNeighborhoodName][t.endNeighborhoodName] = t;
      }
    });
    return map;
  }, [neighborhoodsList, trips]);

  const getHeatmapColor = (price: number) => {
    if (!stats.max || !stats.min || stats.max === stats.min) return 'bg-slate-800 text-white';
    const ratio = (price - stats.min) / (stats.max - stats.min);
    if (ratio < 0.3) return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
    if (ratio < 0.65) return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
    return 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold';
  };

  const handleExportCsv = () => {
    if (!currentCampaign) return;
    window.location.href = api.getExportCsvUrl(currentCampaign.id);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Bar with Campaign Picker & Export Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <TableProperties className="w-5 h-5 text-rose-500" />
            Résultats Détaillés des Trajets & Matrice Tarifaire
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Analyse comparative des prix réels collectés pour chaque paire Origine ➔ Destination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Campaign dropdown */}
          <select
            value={currentCampaign?.id || ''}
            onChange={(e) => onSelectCampaignId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
          >
            {campaigns.map((camp) => (
              <option key={camp.id} value={camp.id}>
                {camp.cityName} • {new Date(camp.startedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} ({camp.completedPairs} trajets)
              </option>
            ))}
          </select>

          {/* Export button */}
          <button
            onClick={handleExportCsv}
            disabled={!currentCampaign || trips.length === 0}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-md shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
            title="Exporter en CSV standard compatible Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exporter Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Prix Moyen Trajet</span>
            <span className="font-mono text-[10px] text-slate-400">{currentCampaign?.currency}</span>
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {stats.avg.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">FCFA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Distance moyenne : {stats.avgKm} km
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Trajet le Moins Cher</span>
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {stats.min.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">FCFA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
            {stats.minTrip ? `${stats.minTrip.startNeighborhoodName} → ${stats.minTrip.endNeighborhoodName}` : '-'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Trajet le Plus Cher</span>
            <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400 mt-1">
            {stats.max.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">FCFA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
            {stats.maxTrip ? `${stats.maxTrip.startNeighborhoodName} → ${stats.maxTrip.endNeighborhoodName}` : '-'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tarif Moyen au Km</span>
            <span className="text-[10px] text-amber-400 font-mono">Benchmark</span>
          </div>
          <div className="text-xl font-bold text-amber-300 mt-1">
            {stats.avgKm > 0 ? Math.round(stats.avg / stats.avgKm) : 0} <span className="text-xs font-normal text-slate-400">FCFA/km</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Sur {trips.length} trajets collectés
          </div>
        </div>
      </div>

      {/* View Switcher & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tableau Triable ({filteredTrips.length})</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Matrice Départ × Destination</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrer par quartier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Filter Bar (for Table view) */}
        {viewMode === 'table' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtres :</span>
            </div>

            <select
              value={startFilter}
              onChange={(e) => setStartFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200"
            >
              <option value="">Départ : Tous les quartiers</option>
              {neighborhoodsList.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <select
              value={endFilter}
              onChange={(e) => setEndFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200"
            >
              <option value="">Arrivée : Tous les quartiers</option>
              {neighborhoodsList.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-slate-400">Trier par :</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
              >
                <option value="price">Prix</option>
                <option value="distanceKm">Distance</option>
                <option value="pricePerKm">Prix / km</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300"
                title="Inverser l'ordre"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Render View: Table */}
      {viewMode === 'table' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Départ (Origine)</th>
                  <th className="py-3 px-4">Arrivée (Destination)</th>
                  <th className="py-3 px-4">Distance (km)</th>
                  <th className="py-3 px-4">Durée</th>
                  <th className="py-3 px-4">Classe</th>
                  <th className="py-3 px-4 font-bold text-white">Prix Relevé</th>
                  <th className="py-3 px-4">Tarif / km</th>
                  <th className="py-3 px-4">Attente</th>
                  <th className="py-3 px-4">Source API</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      Chargement des résultats...
                    </td>
                  </tr>
                ) : filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      Aucun trajet correspondant aux critères de filtre.
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{trip.startNeighborhoodName}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{trip.endNeighborhoodName}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300">
                        {trip.distanceKm} km
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300">
                        {trip.durationMinutes} min
                      </td>

                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          {trip.tariffClass}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-sm text-rose-400">
                          {trip.priceFormatted || `${trip.price.toLocaleString('fr-FR')} ${trip.currency}`}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-amber-300">
                        {trip.pricePerKm} {trip.currency}/km
                      </td>

                      <td className="py-3 px-4 text-slate-400">
                        {trip.waitingTimeMinutes ? `~${trip.waitingTimeMinutes} min` : '-'}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                            trip.source === 'yango_live'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {trip.source === 'yango_live' ? 'Yango Live' : 'Routestats'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Render View: Matrix Grid */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-x-auto shadow-sm">
          <div className="text-xs text-slate-400 mb-3 flex items-center justify-between">
            <span>Matrice de prix croisée (Ligne: Origine Départ ➔ Colonne: Arrivée Destination)</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500" /> Tarif bas
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-500/30 border border-amber-500" /> Tarif moyen
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-rose-500/40 border border-rose-500" /> Tarif élevé
              </span>
            </div>
          </div>

          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2 border border-slate-800 bg-slate-950 text-slate-400 font-semibold text-left">
                  Départ \ Arrivée
                </th>
                {neighborhoodsList.map((dest) => (
                  <th
                    key={dest}
                    className="p-2 border border-slate-800 bg-slate-950 text-slate-300 font-medium text-center min-w-[110px]"
                  >
                    <span className="truncate block max-w-[110px]" title={dest}>
                      {dest}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {neighborhoodsList.map((origin) => (
                <tr key={origin}>
                  <td className="p-2 border border-slate-800 bg-slate-950 text-white font-semibold whitespace-nowrap">
                    {origin}
                  </td>
                  {neighborhoodsList.map((dest) => {
                    if (origin === dest) {
                      return (
                        <td
                          key={dest}
                          className="p-2 border border-slate-800 bg-slate-950/40 text-center text-slate-600 font-mono text-[10px]"
                        >
                          -
                        </td>
                      );
                    }
                    const trip = matrixData[origin]?.[dest];
                    if (!trip) {
                      return (
                        <td
                          key={dest}
                          className="p-2 border border-slate-800 text-center text-slate-600 text-[10px]"
                        >
                          N/A
                        </td>
                      );
                    }
                    return (
                      <td
                        key={dest}
                        className={`p-2 border border-slate-800 text-center font-mono transition hover:scale-105 cursor-pointer ${getHeatmapColor(
                          trip.price
                        )}`}
                        title={`${origin} → ${dest} : ${trip.price} FCFA (${trip.distanceKm} km, ${trip.durationMinutes} min)`}
                      >
                        <div className="font-bold">{trip.price}</div>
                        <div className="text-[10px] opacity-80">{trip.distanceKm} km</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
