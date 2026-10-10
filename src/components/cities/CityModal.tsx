import React from 'react';
import { City } from '../../types';
import { X, Building2, Edit3, Plus, Plane, MapPin } from 'lucide-react';

interface CityModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditMode?: boolean;
  name: string;
  onNameChange: (val: string) => void;
  lat: string;
  onLatChange: (val: string) => void;
  lng: string;
  onLngChange: (val: string) => void;
  currency: string;
  onCurrencyChange: (val: string) => void;
  active?: boolean;
  onActiveChange?: (val: boolean) => void;
  airportName?: string;
  onAirportNameChange?: (val: string) => void;
  airportLat?: string;
  onAirportLatChange?: (val: string) => void;
  airportLng?: string;
  onAirportLngChange?: (val: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  error?: string | null;
}

export const CityModal: React.FC<CityModalProps> = ({
  isOpen,
  onClose,
  isEditMode = false,
  name,
  onNameChange,
  lat,
  onLatChange,
  lng,
  onLngChange,
  currency,
  onCurrencyChange,
  active = true,
  onActiveChange,
  airportName = '',
  onAirportNameChange,
  airportLat = '',
  onAirportLatChange,
  airportLng = '',
  onAirportLngChange,
  isSubmitting,
  onSubmit,
  error
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A]">
            {isEditMode ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEditMode ? 'Modifier la ville' : 'Ajouter une ville'}
            </h2>
            <p className="text-xs text-slate-500">
              Centre géographique et devise locale
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="city-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Nom de la ville *
            </label>
            <input
              id="city-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex: Douala, Yaoundé..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="city-lat-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Latitude centre *
              </label>
              <input
                id="city-lat-input"
                type="number"
                step="any"
                required
                value={lat}
                onChange={(e) => onLatChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
              />
            </div>
            <div>
              <label htmlFor="city-lng-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Longitude centre *
              </label>
              <input
                id="city-lng-input"
                type="number"
                step="any"
                required
                value={lng}
                onChange={(e) => onLngChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="city-currency-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Devise monétaire (ex: XAF, EUR, USD)
            </label>
            <input
              id="city-currency-input"
              type="text"
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              placeholder="XAF"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 uppercase focus:outline-none focus:border-[#3D8B85]"
            />
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Plane className="w-3.5 h-3.5 text-sky-600" />
                <span>Aéroport & Coordonnées GPS</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Requis pour Pricing Aéroport</span>
            </div>

            <div className="space-y-2.5 bg-sky-50/40 p-3 rounded-xl border border-sky-100">
              <div>
                <label htmlFor="city-airport-name-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nom de l'aéroport
                </label>
                <input
                  id="city-airport-name-input"
                  type="text"
                  value={airportName}
                  onChange={(e) => onAirportNameChange?.(e.target.value)}
                  placeholder="Ex: Aéroport International de Douala"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="city-airport-lat-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Latitude aéroport
                  </label>
                  <input
                    id="city-airport-lat-input"
                    type="number"
                    step="any"
                    value={airportLat}
                    onChange={(e) => onAirportLatChange?.(e.target.value)}
                    placeholder="Ex: 4.0061"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="city-airport-lng-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Longitude aéroport
                  </label>
                  <input
                    id="city-airport-lng-input"
                    type="number"
                    step="any"
                    value={airportLng}
                    onChange={(e) => onAirportLngChange?.(e.target.value)}
                    placeholder="Ex: 9.7195"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {onActiveChange && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="city-active-checkbox"
                checked={active}
                onChange={(e) => onActiveChange(e.target.checked)}
                className="rounded border-slate-300 text-[#1F4F4A] focus:ring-[#3D8B85]"
              />
              <label htmlFor="city-active-checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                Ville active
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50"
            >
              {isSubmitting ? 'Enregistrement...' : isEditMode ? 'Mettre à jour' : 'Créer la ville'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
