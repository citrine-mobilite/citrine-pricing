import React from 'react';
import { Neighborhood, City } from '../../types';
import { X, Plus, Edit3, MapPin, Building, Globe, Compass, Activity } from 'lucide-react';

interface NeighborhoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditMode?: boolean;
  neighborhood?: Neighborhood | null;
  // Nom
  name: string;
  onNameChange: (val: string) => void;
  // Localisation administrative
  ville: string;
  onVilleChange: (val: string) => void;
  departement: string;
  onDepartementChange: (val: string) => void;
  arrondissement: string;
  onArrondissementChange: (val: string) => void;
  fullAddress: string;
  onFullAddressChange: (val: string) => void;
  // Coordonnées GPS
  lat: string;
  onLatChange: (val: string) => void;
  lng: string;
  onLngChange: (val: string) => void;
  // Zone & Statut
  zone: string;
  onZoneChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  active: boolean;
  onActiveChange: (val: boolean) => void;
  // Ville parente / Système
  cityId: string;
  onCityIdChange?: (val: string) => void;
  cities: City[];
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  error?: string | null;
}

export const NeighborhoodModal: React.FC<NeighborhoodModalProps> = ({
  isOpen,
  onClose,
  isEditMode = false,
  name,
  onNameChange,
  ville,
  onVilleChange,
  departement,
  onDepartementChange,
  arrondissement,
  onArrondissementChange,
  fullAddress,
  onFullAddressChange,
  lat,
  onLatChange,
  lng,
  onLngChange,
  zone,
  onZoneChange,
  status,
  onStatusChange,
  active,
  onActiveChange,
  cityId,
  onCityIdChange,
  cities,
  isSubmitting,
  onSubmit,
  error
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 relative my-auto max-h-[94vh] flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 border border-[#1F4F4A]/20 flex items-center justify-center text-[#1F4F4A]">
            {isEditMode ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEditMode ? 'Modifier le quartier' : 'Nouveau quartier'}
            </h2>
            <p className="text-xs text-slate-500">
              Édition complète : Ville, Département, Arrondissement, Coordonnées, Adresse et Zone
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto pr-1">
          {/* Section 1 : Informations Principales */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              <Building className="w-3.5 h-3.5 text-[#3D8B85]" />
              Identification & Nom
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom du quartier *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Ex: Ndogbong, Akwa, Bonanjo"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
                />
              </div>

              {onCityIdChange && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ville de rattachement
                  </label>
                  <select
                    value={cityId}
                    onChange={(e) => {
                      onCityIdChange(e.target.value);
                      const c = cities.find(x => x.id === e.target.value);
                      if (c && !ville) onVilleChange(c.name);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
                  >
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.country})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Section 2 : Découpage Administratif */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              <Globe className="w-3.5 h-3.5 text-[#3D8B85]" />
              Découpage Administratif
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ville (colonne Ville)
                </label>
                <input
                  type="text"
                  value={ville}
                  onChange={(e) => onVilleChange(e.target.value)}
                  placeholder="Ex: Douala"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Département
                </label>
                <input
                  type="text"
                  value={departement}
                  onChange={(e) => onDepartementChange(e.target.value)}
                  placeholder="Ex: Wouri"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Arrondissement *
                </label>
                <input
                  type="text"
                  value={arrondissement}
                  onChange={(e) => onArrondissementChange(e.target.value)}
                  placeholder="Ex: 1er, 2e, Centre, District Nord..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Section 3 : Adresse Complète */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Adresse complète (libellé géocodé étendu)
            </label>
            <input
              type="text"
              value={fullAddress}
              onChange={(e) => onFullAddressChange(e.target.value)}
              placeholder="Ex: Ndogbong, Douala 5e, Wouri, Cameroun"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
            />
          </div>

          {/* Section 4 : Coordonnées GPS */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              <Compass className="w-3.5 h-3.5 text-[#3D8B85]" />
              Coordonnées GPS WGS84
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Latitude *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={lat}
                  onChange={(e) => onLatChange(e.target.value)}
                  placeholder="Ex: 4.053000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Longitude *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={lng}
                  onChange={(e) => onLngChange(e.target.value)}
                  placeholder="Ex: 9.748000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Section 5 : Zone & Statut */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              <Activity className="w-3.5 h-3.5 text-[#3D8B85]" />
              Typologie & État d'activité
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zone (Type de zone)
                </label>
                <select
                  value={zone}
                  onChange={(e) => onZoneChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
                >
                  <option value="commercial">Commercial</option>
                  <option value="residential">Résidentiel</option>
                  <option value="popular">Populaire</option>
                  <option value="business">Affaires / Centre d'affaires</option>
                  <option value="industrial">Industriel</option>
                  <option value="airport">Aéroportuaire</option>
                  <option value="peripheral">Périphérie</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Statut (Texte colonne Status)
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    const val = e.target.value;
                    onStatusChange(val);
                    onActiveChange(val.toLowerCase() !== 'inactif');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition"
                >
                  <option value="actif">Actif (en service)</option>
                  <option value="inactif">Inactif (désactivé)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3">
              <input
                type="checkbox"
                id="modal-active-checkbox"
                checked={active}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onActiveChange(checked);
                  onStatusChange(checked ? 'actif' : 'inactif');
                }}
                className="w-4 h-4 rounded border-slate-300 text-[#1F4F4A] focus:ring-[#3D8B85] cursor-pointer"
              />
              <label htmlFor="modal-active-checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                Inclure ce quartier dans les calculs de benchmarks et campagnes tarifaires
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm hover:shadow"
            >
              {isSubmitting ? 'Enregistrement...' : isEditMode ? 'Enregistrer les modifications' : 'Ajouter le quartier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
