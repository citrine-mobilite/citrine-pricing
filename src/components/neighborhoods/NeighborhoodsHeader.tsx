import React from 'react';
import { City } from '../../types';
import { Compass, Plus, FileSpreadsheet, RotateCw, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface NeighborhoodsHeaderProps {
  cities: City[];
  currentCity: City;
  onSelectCityId: (id: string) => void;
  selectedArrondissement: string;
  onSelectArrondissement: (arr: string) => void;
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
  onSelectCityId,
  selectedArrondissement,
  onSelectArrondissement,
  onOpenAddModal,
  onOpenImportModal,
  onBatchToggle,
  onClearCityNeighborhoods,
  onReloadOfficialDouala,
  isLoadingOfficial
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      {/* City & Filter Section */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A] shrink-0">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Quartiers & Points GPS
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <label htmlFor="nb-city-select" className="text-xs text-slate-500 font-medium">Ville :</label>
            <select
              id="nb-city-select"
              value={currentCity.id}
              onChange={(e) => onSelectCityId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#3D8B85]"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.country})
                </option>
              ))}
            </select>

            {currentCity.id === 'city_douala' && (
              <>
                <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                <label htmlFor="arr-select" className="text-xs text-slate-500 font-medium">Arrondissement :</label>
                <select
                  id="arr-select"
                  value={selectedArrondissement}
                  onChange={(e) => onSelectArrondissement(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:border-[#3D8B85]"
                >
                  <option value="all">Tous (1er à 5e)</option>
                  <option value="Douala 1er">Douala 1er</option>
                  <option value="Douala 2e">Douala 2e</option>
                  <option value="Douala 3e">Douala 3e</option>
                  <option value="Douala 4e">Douala 4e</option>
                  <option value="Douala 5e">Douala 5e</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
        {/* Toggle all active/inactive */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          <button
            onClick={() => onBatchToggle(true)}
            title="Activer tous les quartiers de la ville"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 rounded transition cursor-pointer"
          >
            <ToggleRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tout activer</span>
          </button>
          <button
            onClick={() => onBatchToggle(false)}
            title="Désactiver tous les quartiers"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
          >
            <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>Tout désactiver</span>
          </button>
        </div>

        {/* Reload Official */}
        {currentCity.id === 'city_douala' && (
          <button
            onClick={onReloadOfficialDouala}
            disabled={isLoadingOfficial}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm"
            title="Recharger la liste officielle des 5 arrondissements"
          >
            <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${isLoadingOfficial ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Recharger Douala</span>
          </button>
        )}

        {/* Clear City */}
        <button
          onClick={onClearCityNeighborhoods}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer shadow-sm"
          title="Vider les quartiers de cette ville"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
          <span className="hidden sm:inline">Vider</span>
        </button>

        {/* Excel Import */}
        <button
          onClick={onOpenImportModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition cursor-pointer shadow-sm"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Importer Excel</span>
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
  );
};
