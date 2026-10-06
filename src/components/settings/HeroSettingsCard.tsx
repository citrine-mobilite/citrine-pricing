import React from 'react';
import { HeroSettings } from '../../types';
import { Server, Key, Clock, Radio, Save, CheckCircle2, ShieldCheck } from 'lucide-react';
import { HeroLogo } from '../HeroLogo';

interface HeroSettingsCardProps {
  settings: HeroSettings;
  onChange: (updated: HeroSettings) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

export const HeroSettingsCard: React.FC<HeroSettingsCardProps> = ({
  settings,
  onChange,
  onSubmit,
  isSaving,
  saveSuccess
}) => {
  return (
    <div className="bg-white rounded-xl border border-teal-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-4 border-b border-teal-100 flex items-center justify-between bg-teal-50/20">
        <div className="flex items-center gap-2">
          <HeroLogo className="w-4 h-4 text-teal-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Passerelle API Hero Cab Pro (MobiCity)
          </h2>
        </div>
        <span className="text-[11px] font-medium text-teal-800 bg-teal-100/60 px-2 py-0.5 rounded-md">
          Live Dispatcher
        </span>
      </div>

      <form onSubmit={onSubmit} className="p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <span className="font-semibold text-slate-800">Activer l'agrégateur Hero Cab</span>
            <p className="text-[11px] text-slate-500">
              {settings.enabled !== false ? 'Actif : Interrogé lors des campagnes et tests' : 'Désactivé : Requêtes ignorées pour éviter les gaspillages'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled !== false}
              onChange={(e) => onChange({ ...settings, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3D8B85]"></div>
          </label>
        </div>

        <div>
          <label htmlFor="hero-endpoint-input" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Endpoint de calcul & devis (cx-get_available_driver_list.php)</span>
          </label>
          <input
            id="hero-endpoint-input"
            type="text"
            required
            value={settings.apiEndpoint}
            onChange={(e) => onChange({ ...settings, apiEndpoint: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3D8B85]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="hero-email-input" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Identifiant / Email API Hero</span>
            </label>
            <input
              id="hero-email-input"
              type="text"
              value={settings.email}
              onChange={(e) => onChange({ ...settings, email: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
            />
          </div>

          <div>
            <label htmlFor="hero-password-input" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span>Mot de passe API</span>
            </label>
            <input
              id="hero-password-input"
              type="password"
              value={settings.password}
              onChange={(e) => onChange({ ...settings, password: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="hero-delay-input" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Délai anti-rate limit (ms)</span>
            </label>
            <input
              id="hero-delay-input"
              type="number"
              value={settings.requestDelayMs}
              onChange={(e) => onChange({ ...settings, requestDelayMs: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
            />
          </div>

          <div>
            <label htmlFor="hero-mode-select" className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              <span>Mode d'extraction</span>
            </label>
            <select
              id="hero-mode-select"
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
            <span className="text-teal-700 font-semibold flex items-center gap-1 text-xs">
              <CheckCircle2 className="w-4 h-4" /> Paramètres Hero Cab enregistrés !
            </span>
          ) : <span />}

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Enregistrement...' : 'Sauvegarder Hero Cab'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
