import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, Key, Globe, Download, Save, ShieldCheck } from 'lucide-react';
import Swal from 'sweetalert2';
import { getStoredSupabaseConfig, saveStoredSupabaseConfig } from '../../services/supabase';

interface SupabaseSettingsCardProps {
  onRefreshStats?: () => void;
}

export const SupabaseSettingsCard: React.FC<SupabaseSettingsCardProps> = () => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    // 1. Charger depuis le serveur
    fetch('/api/settings/supabase')
      .then(res => res.json())
      .then(data => {
        if (data.url) setUrl(data.url);
        if (data.anonKey && !data.anonKey.includes('...')) {
          setAnonKey(data.anonKey);
        }
      })
      .catch(() => {
        // Fallback localStorage
        const stored = getStoredSupabaseConfig();
        if (stored.url) setUrl(stored.url);
        if (stored.anonKey) setAnonKey(stored.anonKey);
      });
  }, []);

  const handleTestConnection = async () => {
    if (!url.trim()) {
      Swal.fire({
        title: 'URL requise',
        text: 'Veuillez saisir l’URL de votre projet Supabase (ex: https://xyz.supabase.co).',
        icon: 'warning'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Sauvegarder d'abord pour tester côté serveur
      await fetch('/api/settings/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
      });

      const res = await fetch('/api/settings/supabase/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        saveStoredSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() });
        Swal.fire({
          title: 'Connecté !',
          text: data.message || 'La connexion à Supabase a été établie avec succès.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Erreur lors du test de connexion'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
      });
      if (res.ok) {
        saveStoredSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() });
        Swal.fire({
          title: 'Enregistré !',
          text: 'La configuration Supabase a été enregistrée avec succès.',
          icon: 'success',
          timer: 1800,
          showConfirmButton: false
        });
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Erreur de sauvegarde');
      }
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message,
        icon: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête statut */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                Base de Données Supabase (PostgreSQL)
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  Actif &amp; Zéro Quota
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Toutes les opérations Firestore ont été retirées. Les données sont persistées en stockage local haute performance et synchronisables avec Supabase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/export/db-full"
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter JSON</span>
            </a>
          </div>
        </div>
      </div>

      {/* Formulaire de configuration Supabase */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs">
        <h4 className="text-sm font-semibold text-slate-900 mb-1">
          Identifiants de Connexion Supabase
        </h4>
        <p className="text-xs text-slate-500 mb-4">
          Entrez l’URL de votre projet Supabase ainsi que votre clé publique Anon pour lier l’application.
        </p>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL du Projet Supabase (Project URL)
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://votre-projet.supabase.co"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F4F4A]/20 focus:border-[#1F4F4A] transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Clé Publique Supabase (Anon Key)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F4F4A]/20 focus:border-[#1F4F4A] transition font-mono"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Test en cours...' : 'Tester la connexion'}</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#183F3B] rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer la configuration'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Guide & Sécurité */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Architecture Indépendante &amp; Haute Disponibilité</span>
        </div>
        <p>
          1. <strong>Zéro Quota Bloquant</strong> : L'application n'utilise plus Firestore. Vos calculs de pricing, villes et quartiers ne subissent plus les limites de quota journalier de Google Cloud.
        </p>
        <p>
          2. <strong>Données Sécurisées</strong> : Toutes vos campagnes, quartiers et configurations sont sauvegardés en mémoire vive ultra-rapide (RAM) et synchronisés en continu sur disque persistant.
        </p>
        <p>
          3. <strong>Évolutivité Supabase</strong> : Dès que votre projet Supabase est configuré, vos tables PostgreSQL peuvent être alimentées directement via le client Supabase.
        </p>
      </div>
    </div>
  );
};
