import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Key,
  Globe,
  Download,
  Save,
  ShieldCheck,
  UploadCloud,
  DownloadCloud,
  Code2,
  Copy,
  Check
} from 'lucide-react';
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
  const [isSyncingPush, setIsSyncingPush] = useState(false);
  const [isSyncingPull, setIsSyncingPull] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSqlSchema, setShowSqlSchema] = useState(false);
  const [sqlSchema, setSqlSchema] = useState('');
  const [hasCopied, setHasCopied] = useState(false);

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
        const stored = getStoredSupabaseConfig();
        if (stored.url) setUrl(stored.url);
        if (stored.anonKey) setAnonKey(stored.anonKey);
      });

    // Charger le schéma SQL
    fetch('/api/settings/supabase/schema')
      .then(res => res.json())
      .then(data => {
        if (data.schema) setSqlSchema(data.schema);
      })
      .catch(() => {});
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

  const handleSyncPush = async () => {
    setIsSyncingPush(true);
    try {
      const res = await fetch('/api/settings/supabase/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'push' })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          title: 'Synchronisation réussie !',
          text: data.message,
          icon: 'success'
        });
      } else {
        throw new Error(data.message || 'Erreur lors de la synchronisation.');
      }
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur de synchronisation',
        text: err.message,
        icon: 'error'
      });
    } finally {
      setIsSyncingPush(false);
    }
  };

  const handleSyncPull = async () => {
    const confirmRes = await Swal.fire({
      title: 'Importer depuis Supabase ?',
      text: 'Les données distantes de Supabase remplaceront les données en mémoire locale.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui, importer',
      cancelButtonText: 'Annuler'
    });

    if (!confirmRes.isConfirmed) return;

    setIsSyncingPull(true);
    try {
      const res = await fetch('/api/settings/supabase/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'pull' })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          title: 'Import terminé !',
          text: data.message,
          icon: 'success'
        });
      } else {
        throw new Error(data.message || 'Erreur lors de l’import.');
      }
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur d’import',
        text: err.message,
        icon: 'error'
      });
    } finally {
      setIsSyncingPull(false);
    }
  };

  const handleCopySql = () => {
    if (!sqlSchema) return;
    navigator.clipboard.writeText(sqlSchema).then(() => {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    });
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
                  Actif &amp; Correspondance 100%
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Toutes les insertions, modifications et suppressions du site (villes, quartiers, utilisateurs, campagnes, ruptures) sont synchronisées avec votre base Supabase.
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
              <span>Export Secours JSON</span>
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
          Entrez l’URL de votre projet Supabase ainsi que votre clé publique Anon pour lier l’application en lecture et écriture.
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

          <div className="flex flex-wrap items-center gap-3 pt-2">
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

            <button
              type="button"
              onClick={handleSyncPush}
              disabled={isSyncingPush}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
              title="Envoyer toutes les données locales vers Supabase"
            >
              <UploadCloud className={`w-3.5 h-3.5 ${isSyncingPush ? 'animate-spin' : ''}`} />
              <span>{isSyncingPush ? 'Synchronisation...' : 'Synchroniser le Site vers Supabase'}</span>
            </button>

            <button
              type="button"
              onClick={handleSyncPull}
              disabled={isSyncingPull}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
              title="Importer les données depuis Supabase vers le site"
            >
              <DownloadCloud className={`w-3.5 h-3.5 ${isSyncingPull ? 'animate-spin' : ''}`} />
              <span>{isSyncingPull ? 'Importation...' : 'Importer depuis Supabase'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Accordéon Schéma DDL SQL Supabase */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#1F4F4A]" />
            <h4 className="text-sm font-semibold text-slate-900">
              Script SQL de Création des Tables Supabase
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{hasCopied ? 'Copié !' : 'Copier le SQL'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSqlSchema(!showSqlSchema)}
              className="text-xs text-[#1F4F4A] hover:underline font-semibold cursor-pointer"
            >
              {showSqlSchema ? 'Masquer le code' : 'Afficher le code SQL'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-1 mb-3">
          Si votre projet Supabase est neuf, copiez et collez ce script dans l'éditeur SQL de votre Dashboard Supabase pour créer instantanément les tables (<code className="font-mono text-slate-700">cities</code>, <code className="font-mono text-slate-700">neighborhoods</code>, <code className="font-mono text-slate-700">users</code>, <code className="font-mono text-slate-700">campaigns</code>, <code className="font-mono text-slate-700">campaign_trips</code>, <code className="font-mono text-slate-700">shortages</code>).
        </p>

        {showSqlSchema && (
          <div className="mt-3 relative">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-96">
              {sqlSchema}
            </pre>
          </div>
        )}
      </div>

      {/* Guide & Sécurité */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Correspondance Exacte Site ↔ Base Supabase</span>
        </div>
        <p>
          1. <strong>CRUD Temps Réel</strong> : Dès que vous ajoutez, modifiez ou supprimez une ville, un quartier, un utilisateur ou une campagne, la mise à jour est immédiatement envoyée à Supabase avec repli transparent sur stockage disque local.
        </p>
        <p>
          2. <strong>Tolérance de Schéma</strong> : Le connecteur gère automatiquement à la fois les colonnes relationnelles standard et le conteneur JSONB <code className="font-mono text-slate-700">data</code> pour éviter toute erreur de schéma manquant.
        </p>
        <p>
          3. <strong>Indépendance &amp; Continuité</strong> : Même en cas de coupure de connexion avec Supabase, l'application continue de fonctionner sans interruption grâce au cache RAM et au stockage persistant sur disque.
        </p>
      </div>
    </div>
  );
};
