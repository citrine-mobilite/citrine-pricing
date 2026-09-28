import React from 'react';
import { TripMasterSettings } from '../../types';
import { Server, Compass, Save, CheckCircle2, Clock, Radio, Info } from 'lucide-react';

interface TripMasterSettingsCardProps {
  settings: TripMasterSettings;
  onChange: (updated: TripMasterSettings) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

export const TripMasterSettingsCard: React.FC<TripMasterSettingsCardProps> = ({
  settings,
  onChange,
  onSubmit,
  isSaving,
  saveSuccess
}) => {
  return (
    <div className="bg-white rounded-xl border border-indigo-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-4 border-b border-indigo-100 flex items-center justify-between bg-indigo-50/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Passerelle API Trip Master (Cameroun)
            </h2>
            <p className="text-[11px] text-slate-500">
              Extraction des tarifs en temps réel via l'API officielle de calcul Trip Master
            </p>
          </div>
        </div>
        <span className="text-[11px] font-medium text-indigo-800 bg-indigo-100/60 px-2.5 py-0.5 rounded-md">
          Live Direct API
        </span>
      </div>

      <form onSubmit={onSubmit} className="p-5 space-y-4 text-xs">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5 text-slate-600">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-800">Interrogation 100% directe des serveurs Trip Master</span>
            <p className="text-[11px] text-slate-500">
              L'application transmet les coordonnées GPS aux endpoints officiels Trip Master Cameroun (<code className="text-indigo-600 font-mono">/get-distance</code> et <code className="text-indigo-600 font-mono">/search-vehicle</code>) et restitue les prix réels retournés sans calcul artificiel.
            </p>
          </div>
        </div>

        {/* Endpoints */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tm-dist-endpoint" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-500" />
              <span>Endpoint Distance (/get-distance)</span>
            </label>
            <input
              id="tm-dist-endpoint"
              type="text"
              required
              value={settings.distanceEndpoint}
              onChange={(e) => onChange({ ...settings, distanceEndpoint: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="tm-search-endpoint" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-500" />
              <span>Endpoint Véhicules (/search-vehicle)</span>
            </label>
            <input
              id="tm-search-endpoint"
              type="text"
              required
              value={settings.searchVehicleEndpoint}
              onChange={(e) => onChange({ ...settings, searchVehicleEndpoint: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Operational settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tm-delay-input" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Délai anti-rate limit (ms)</span>
            </label>
            <input
              id="tm-delay-input"
              type="number"
              min="50"
              step="25"
              value={settings.requestDelayMs}
              onChange={(e) => onChange({ ...settings, requestDelayMs: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="tm-mode-select" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              <span>Mode d'exécution</span>
            </label>
            <select
              id="tm-mode-select"
              value={settings.mode}
              onChange={(e) => onChange({ ...settings, mode: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="live">Live direct (Interrogation API officielle Trip Master)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {saveSuccess ? (
            <span className="text-indigo-700 font-semibold flex items-center gap-1 text-xs">
              <CheckCircle2 className="w-4 h-4" /> Paramètres Trip Master enregistrés !
            </span>
          ) : <span />}

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Enregistrement...' : 'Sauvegarder Trip Master'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
