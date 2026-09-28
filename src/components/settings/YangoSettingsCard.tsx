import React from 'react';
import { YangoSettings } from '../../types';
import { Server, Key, Clock, Radio, Save, CheckCircle2 } from 'lucide-react';

interface YangoSettingsCardProps {
  settings: YangoSettings;
  onChange: (updated: YangoSettings) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

export const YangoSettingsCard: React.FC<YangoSettingsCardProps> = ({
  settings,
  onChange,
  onSubmit,
  isSaving,
  saveSuccess
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <h2 className="text-sm font-semibold text-slate-900">
            Passerelle API Yango Routestats
          </h2>
        </div>
        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
          Live Endpoint
        </span>
      </div>

      <form onSubmit={onSubmit} className="p-5 space-y-4 text-xs">
        <div>
          <label htmlFor="yango-endpoint-input" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Endpoint d'évaluation tarifaire (routestats)</span>
          </label>
          <input
            id="yango-endpoint-input"
            type="text"
            required
            value={settings.apiEndpoint}
            onChange={(e) => onChange({ ...settings, apiEndpoint: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3D8B85]"
          />
        </div>

        <div>
          <label htmlFor="yango-token-input" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-slate-400" />
            <span>Bearer Token Authorization (Yango Authproxy)</span>
          </label>
          <input
            id="yango-token-input"
            type="password"
            value={settings.bearerToken}
            onChange={(e) => onChange({ ...settings, bearerToken: e.target.value })}
            placeholder="OAuth y0_AgAAAAB..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3D8B85]"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Requis pour authentifier les appels en direct auprès du reverse-proxy Yango.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="yango-delay-input" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Délai anti-rate limit (ms)</span>
            </label>
            <input
              id="yango-delay-input"
              type="number"
              value={settings.requestDelayMs}
              onChange={(e) => onChange({ ...settings, requestDelayMs: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
            />
          </div>

          <div>
            <label htmlFor="yango-mode-select" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              <span>Mode d'extraction</span>
            </label>
            <select
              id="yango-mode-select"
              value={settings.mode}
              onChange={(e) => onChange({ ...settings, mode: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
            >
              <option value="live">Live direct (Recommandé)</option>
              <option value="mock">Simulation locale (Hors-ligne)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {saveSuccess ? (
            <span className="text-emerald-600 font-semibold flex items-center gap-1 text-xs">
              <CheckCircle2 className="w-4 h-4" /> Paramètres Yango enregistrés !
            </span>
          ) : <span />}

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Enregistrement...' : 'Sauvegarder Yango'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
