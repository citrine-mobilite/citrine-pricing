import React, { useState } from 'react';
import { YangoSettings } from '../../types';
import { Server, Key, Clock, Radio, Save, CheckCircle2, Code2, Copy, X } from 'lucide-react';
import { api } from '../../services/api';

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
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);
  const [rawYangoData, setRawYangoData] = useState<{ timestamp: string; rawJson: any; rawText: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInspectRawJson = async () => {
    setLoadingJson(true);
    setShowJsonModal(true);
    try {
      const data = await api.getLastYangoRawJson();
      setRawYangoData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingJson(false);
    }
  };

  const handleCopy = () => {
    if (!rawYangoData) return;
    const textToCopy = rawYangoData.rawJson ? JSON.stringify(rawYangoData.rawJson, null, 2) : rawYangoData.rawText || 'Aucune donnée';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <h2 className="text-sm font-semibold text-slate-900">
            Passerelle API Yango Routestats
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInspectRawJson}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-[#3D8B85]" />
            <span>Voir le dernier JSON brut</span>
          </button>
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            Live Endpoint
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <span className="font-semibold text-slate-800">Activer l'agrégateur Yango</span>
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

      {/* Modal d'inspection JSON Yango brut */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#3D8B85]" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Inspection du Dernier JSON Réseau Yango
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copié !' : 'Copier'}</span>
                </button>
                <button
                  onClick={() => setShowJsonModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-950 text-slate-100 font-mono text-xs">
              {loadingJson ? (
                <div className="p-8 text-center text-slate-400 animate-pulse">
                  Chargement du dernier JSON en mémoire serveur...
                </div>
              ) : rawYangoData && (rawYangoData.rawJson || rawYangoData.rawText) ? (
                <div>
                  <div className="mb-2 text-[10px] text-emerald-400 border-b border-slate-800 pb-1 flex justify-between">
                    <span>Reçu à : {rawYangoData.timestamp ? new Date(rawYangoData.timestamp).toLocaleString('fr-FR') : 'Inconnu'}</span>
                    <span>Source : /api/routestats</span>
                  </div>
                  <pre className="whitespace-pre-wrap break-words leading-relaxed">
                    {rawYangoData.rawJson
                      ? JSON.stringify(rawYangoData.rawJson, null, 2)
                      : rawYangoData.rawText}
                  </pre>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-sm font-medium text-amber-400 mb-1">Aucune requête Yango n'a été exécutée depuis le démarrage du serveur.</p>
                  <p className="text-xs">Lancez un "Test Rapide" de trajet dans l'onglet Tarification pour capturer un JSON Yango en direct.</p>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex justify-between items-center">
              <span>Conseil : Vous pouvez partager ce JSON pour affiner les clés de décodage.</span>
              <button
                onClick={() => setShowJsonModal(false)}
                className="px-3 py-1 bg-slate-800 text-white font-medium rounded-md hover:bg-slate-700 transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
