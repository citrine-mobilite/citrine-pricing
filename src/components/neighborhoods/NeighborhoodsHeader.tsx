import React from 'react';
import { City } from '../../types';
import {
  Compass,
  Plus,
  FileSpreadsheet,
  RotateCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Layers,
  Building2,
  Search,
  X,
  Filter
} from 'lucide-react';

interface NeighborhoodsHeaderProps {
  cities: City[];
  currentCity?: City;
  selectedCityId: string;
  onSelectCityId: (id: string) => void;
  availableDepartements: string[];
  selectedDepartement: string;
  onSelectDepartement: (dep: string) => void;
  availableArrondissements: string[];
  selectedArrondissement: string;
  onSelectArrondissement: (arr: string) => void;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (status: 'all' | 'active' | 'inactive') => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onResetFilters: () => void;
  filteredCount: number;
  totalCityCount: number;
  totalGlobalCount: number;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onBatchToggle: (activeState: boolean) => void;
  onClearCityNeighborhoods: () => void;
  onReloadOfficialDouala: () => void;
  isLoadingOfficial: boolean;
}

export const NeighborhoodsHeader: React.FC<NeighborhoodsHeaderProps> = ({
  cities,
  currentCity,
  selectedCityId,
  onSelectCityId,
  availableDepartements,
  selectedDepartement,
  onSelectDepartement,
  availableArrondissements,
  selectedArrondissement,
  onSelectArrondissement,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  onResetFilters,
  filteredCount,
  totalCityCount,
  totalGlobalCount,
  onOpenAddModal,
  onOpenImportModal,
  onBatchToggle,
  onClearCityNeighborhoods,
  onReloadOfficialDouala,
  isLoadingOfficial
}) => {
  const hasActiveFilters =
    selectedCityId !== 'all' ||
    selectedDepartement !== 'all' ||
    selectedArrondissement !== 'all' ||
    statusFilter !== 'all' ||
    searchQuery.trim().length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      {/* Top Bar: Title & Global Actions */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A] shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Quartiers & Points GPS
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                {filteredCount} / {selectedCityId === 'all' ? totalGlobalCount : totalCityCount}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestion de la géolocalisation, découpage territorial et filtrage multi-critères.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          {/* Toggle all active/inactive */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => onBatchToggle(true)}
              title="Activer tous les quartiers affichés"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 rounded transition cursor-pointer"
            >
              <ToggleRight className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tout activer</span>
            </button>
            <button
              onClick={() => onBatchToggle(false)}
              title="Désactiver tous les quartiers"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
            >
              <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>Tout désactiver</span>
            </button>
          </div>

          {/* Reload / Seeding Catalogue */}
          {currentCity?.id && (
            <button
              onClick={onReloadOfficialDouala}
              disabled={isLoadingOfficial}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm"
              title={`Recharger le catalogue des quartiers pour ${currentCity.name}`}
            >
              <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${isLoadingOfficial ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Catalogue {currentCity.name}</span>
            </button>
          )}

          {/* Clear City */}
          {selectedCityId !== 'all' && (
            <button
              onClick={onClearCityNeighborhoods}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer shadow-sm"
              title={`Vider les quartiers de ${currentCity?.name || 'cette ville'}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Vider</span>
            </button>
          )}

          {/* Excel Import / Rectifier */}
          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition cursor-pointer shadow-sm"
            title="Importer ou rectifier les coordonnées et quartiers depuis Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Rectifier</span>
          </button>

          {/* Add single */}
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter Quartier</span>
          </button>
        </div>
      </div>

      {/* Filter Section: Ville / Département / Arrondissement / Statut / Recherche */}
      <div className="p-4 sm:p-5 bg-slate-50/60 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-[#3D8B85]" />
            <span>Filtres territoriaux et recherche</span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 cursor-pointer transition"
            >
              <X className="w-3 h-3" />
              <span>Réinitialiser les filtres</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* 1. Filtre Ville */}
          <div className="relative">
            <label htmlFor="filter-city" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Ville
            </label>
            <div className="relative flex items-center">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                id="filter-city"
                value={selectedCityId}
                onChange={(e) => onSelectCityId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3D8B85] focus:border-[#3D8B85] shadow-2xs"
              >
                <option value="all">🌍 Toutes les villes</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    📍 {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Filtre Département */}
          <div className="relative">
            <label htmlFor="filter-departement" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Département
            </label>
            <div className="relative flex items-center">
              <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                id="filter-departement"
                value={selectedDepartement}
                onChange={(e) => onSelectDepartement(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 text-xs font-medium text-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3D8B85] focus:border-[#3D8B85] shadow-2xs"
              >
                <option value="all">Tous les départements</option>
                {availableDepartements.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Filtre Arrondissement */}
          <div className="relative">
            <label htmlFor="filter-arrondissement" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Arrondissement
            </label>
            <div className="relative flex items-center">
              <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                id="filter-arrondissement"
                value={selectedArrondissement}
                onChange={(e) => onSelectArrondissement(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 text-xs font-medium text-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3D8B85] focus:border-[#3D8B85] shadow-2xs"
              >
                <option value="all">Tous les arrondissements</option>
                {availableArrondissements.map((arr) => (
                  <option key={arr} value={arr}>
                    {arr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Filtre Statut */}
          <div className="relative">
            <label htmlFor="filter-status" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Statut
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 text-xs font-medium text-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3D8B85] focus:border-[#3D8B85] shadow-2xs"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">🟢 Actifs uniquement</option>
              <option value="inactive">⚪ Inactifs uniquement</option>
            </select>
          </div>

          {/* 5. Recherche par mot-clé */}
          <div className="relative">
            <label htmlFor="filter-search" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Recherche rapide
            </label>
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                id="filter-search"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Nom, rue, repère..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 text-xs font-medium text-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3D8B85] focus:border-[#3D8B85] shadow-2xs placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchQueryChange('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Effacer la recherche"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
