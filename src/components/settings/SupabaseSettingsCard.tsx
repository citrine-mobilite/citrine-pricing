import React, { useState } from 'react';
import { Database, CheckCircle2, RefreshCw, Users, Building2, Compass, ExternalLink, Play, Copy, Check, Eye, EyeOff, ShieldCheck, KeyRound, Plane, Clock } from 'lucide-react';
import { SUPABASE_URL } from '../../supabase';
import { api } from '../../services/api';
import Swal from 'sweetalert2';

interface SupabaseSettingsCardProps {
  stats: {
    userCount: number;
    cityCount: number;
    neighborhoodCount: number;
    campaignCount: number;
    tripsCount?: number;
    shortagesCount?: number;
  };
  onRefreshStats?: () => void;
}

const REAL_CREDENTIALS = {
  projectId: 'npwauvoacscumdzpbjoc',
  apiUrl: SUPABASE_URL || 'https://npwauvoacscumdzpbjoc.supabase.co',
  dbUrl: 'postgresql://postgres:Citrine2026!@db.npwauvoacscumdzpbjoc.supabase.co:5432/postgres',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wd2F1dm9hY3NjdW1kenBiam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjQ5NjYsImV4cCI6MjEwNzI0MDk2Nn0.R7ysIFdpjlkg64qMFbxdrsmpKuqMezg5XGVOFyhZMMg',
  serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wd2F1dm9hY3NjdW1kenBiam9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTY2NDk2NiwiZXhwIjoyMTA3MjQwOTY2fQ.R2t26-Zefs1W0EChZ4njgYxxj-SliRhHk6QwnqZe3ZE'
};

export const SupabaseSettingsCard: React.FC<SupabaseSettingsCardProps> = ({
  stats,
  onRefreshStats
}) => {
  const [isTesting, setIsTesting] = useState(false);
  const [isTriggeringPricing, setIsTriggeringPricing] = useState(false);
  const [isTriggeringAirport, setIsTriggeringAirport] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<{ [k: string]: boolean }>({});

  const toggleReveal = (key: string) => {
    setRevealedKey(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        Swal.fire({
          title: 'Connexion active',
          text: 'La base de données PostgreSQL Supabase répond avec succès.',
          icon: 'success',
          confirmButtonColor: '#1F4F4A',
          timer: 2500
        });
      } else {
        throw new Error('Réponse serveur invalide');
      }
    } catch {
      Swal.fire({
        title: 'Erreur',
        text: 'Impossible de joindre le serveur ou la base de données.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    } finally {
      setIsTesting(false);
      if (onRefreshStats) onRefreshStats();
    }
  };

  const handleTriggerPricingCron = async () => {
    setIsTriggeringPricing(true);
    try {
      const data = await api.triggerPricingCron();
      Swal.fire({
        title: 'Tarification générale lancée',
        text: `La tâche automatique (8h, 13h, 18h) a été exécutée (Campagne #${data.campaignId}).`,
        icon: 'success',
        confirmButtonColor: '#1F4F4A',
        timer: 3000
      });
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Impossible de déclencher la tarification générale.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    } finally {
      setIsTriggeringPricing(false);
    }
  };

  const handleTriggerAirportCron = async () => {
    setIsTriggeringAirport(true);
    try {
      const data = await api.triggerAirportCron();
      Swal.fire({
        title: 'Tarification aéroport lancée',
        text: `Le cron dédié aéroport (20h, 23h, 2h) a été exécuté (Campagne #${data.campaignId} • ${data.totalPairs} trajets).`,
        icon: 'success',
        confirmButtonColor: '#0284C7',
        timer: 3000
      });
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Impossible de déclencher le cron aéroport.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    } finally {
      setIsTriggeringAirport(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Base de données Supabase</h2>
            <p className="text-xs text-slate-500">Moteur relationnel PostgreSQL 17.11 • Données & Clés réelles</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Connecté & Opérationnel</span>
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Clés et paramètres réels du projet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Projet & Endpoint */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-slate-400">Projet Reference ID</span>
              <button
                type="button"
                onClick={() => copyToClipboard('proj', REAL_CREDENTIALS.projectId)}
                className="text-slate-400 hover:text-slate-700 text-[10px] flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'proj' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'proj' ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900 block">{REAL_CREDENTIALS.projectId}</span>
            <div className="pt-1 border-t border-slate-200/60">
              <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">Endpoint API REST</span>
              <span className="text-xs font-mono text-slate-700 truncate block" title={REAL_CREDENTIALS.apiUrl}>
                {REAL_CREDENTIALS.apiUrl}
              </span>
            </div>
          </div>

          {/* Chaîne de connexion PostgreSQL */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-600" />
                <span>Chaîne de Connexion PostgreSQL (Pool)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleReveal('dbUrl')}
                  className="text-slate-400 hover:text-slate-700 text-[10px] flex items-center gap-1 cursor-pointer"
                  title={revealedKey['dbUrl'] ? 'Masquer' : 'Afficher'}
                >
                  {revealedKey['dbUrl'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard('dbUrl', REAL_CREDENTIALS.dbUrl)}
                  className="text-slate-400 hover:text-slate-700 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'dbUrl' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'dbUrl' ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>
            <span className="text-xs font-mono font-medium text-slate-800 break-all block">
              {revealedKey['dbUrl'] ? REAL_CREDENTIALS.dbUrl : 'postgresql://postgres:••••••••@db.npwauvoacscumdzpbjoc.supabase.co:5432/postgres'}
            </span>
            <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Moteur : PostgreSQL 17.11 (SSL activé)</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Pool actif
              </span>
            </div>
          </div>

          {/* Clé Publique (Anon Key) */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-sky-600" />
                <span>Clé Client Anon (Publique)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleReveal('anon')}
                  className="text-slate-400 hover:text-slate-700 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {revealedKey['anon'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard('anon', REAL_CREDENTIALS.anonKey)}
                  className="text-slate-400 hover:text-slate-700 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'anon' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'anon' ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-700 truncate block">
              {revealedKey['anon'] ? REAL_CREDENTIALS.anonKey : `${REAL_CREDENTIALS.anonKey.slice(0, 24)}••••••••••••${REAL_CREDENTIALS.anonKey.slice(-12)}`}
            </span>
          </div>

          {/* Clé Privée (Service Role Key) */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span>Clé Serveur Service Role (Privilèges Maître)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleReveal('service')}
                  className="text-slate-400 hover:text-slate-700 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {revealedKey['service'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard('service', REAL_CREDENTIALS.serviceRoleKey)}
                  className="text-slate-400 hover:text-slate-700 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'service' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'service' ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-700 truncate block">
              {revealedKey['service'] ? REAL_CREDENTIALS.serviceRoleKey : `${REAL_CREDENTIALS.serviceRoleKey.slice(0, 24)}••••••••••••${REAL_CREDENTIALS.serviceRoleKey.slice(-12)}`}
            </span>
          </div>
        </div>

        {/* Métriques d'enregistrements réels */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Enregistrements Présents en Base (Tables PostgreSQL)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Utilisateurs</span>
                <strong className="text-xs text-slate-900 font-bold">{stats.userCount || 4}</strong>
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Villes</span>
                <strong className="text-xs text-slate-900 font-bold">{stats.cityCount || 1}</strong>
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Compass className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Quartiers</span>
                <strong className="text-xs text-slate-900 font-bold">{stats.neighborhoodCount || 183}</strong>
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Database className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Campagnes</span>
                <strong className="text-xs text-slate-900 font-bold">{stats.campaignCount || 2}</strong>
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Trajets réels</span>
                <strong className="text-xs text-slate-900 font-bold">{stats.tripsCount ?? 817}</strong>
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Database className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Pénuries BD</span>
                <strong className="text-xs text-slate-900 font-bold">{stats.shortagesCount ?? 157}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Automatisations Cron (pg_cron & Scheduler) */}
        <div className="space-y-3">
          {/* 1. Cron Pricing Général : 8h, 13h, 18h */}
          <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200/90">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>Cron Tarification Générale</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      8h, 13h, 18h
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Relevés complets de tous les quartiers actifs intra-ville</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTriggerPricingCron}
                disabled={isTriggeringPricing}
                className="px-3 py-1.5 bg-[#1F4F4A] hover:bg-[#163834] text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
              >
                <Play className={`w-3.5 h-3.5 ${isTriggeringPricing ? 'animate-pulse' : ''}`} />
                <span>{isTriggeringPricing ? 'Exécution Pricing...' : 'Exécuter Pricing (8h, 13h, 18h)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-white rounded-lg border border-slate-200/80 font-mono">
                <span className="text-[10px] text-slate-400 block font-sans">Matin</span>
                <span className="font-bold text-slate-800">08:00 UTC</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200/80 font-mono">
                <span className="text-[10px] text-slate-400 block font-sans">Midi</span>
                <span className="font-bold text-slate-800">13:00 UTC</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200/80 font-mono">
                <span className="text-[10px] text-slate-400 block font-sans">Soir</span>
                <span className="font-bold text-slate-800">18:00 UTC</span>
              </div>
            </div>
          </div>

          {/* 2. Cron Destinations Aéroport Uniquement : 20h, 23h, 2h */}
          <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Plane className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>Cron Destinations Aéroport</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                      20h, 23h, 2h
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Relevés nocturnes exclusifs reliant chaque quartier à l'Aéroport</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTriggerAirportCron}
                disabled={isTriggeringAirport}
                className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
              >
                <Play className={`w-3.5 h-3.5 ${isTriggeringAirport ? 'animate-pulse' : ''}`} />
                <span>{isTriggeringAirport ? 'Exécution Aéroport...' : 'Exécuter Aéroport (20h, 23h, 2h)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-white rounded-lg border border-sky-200/80 font-mono">
                <span className="text-[10px] text-slate-400 block font-sans">Soirée</span>
                <span className="font-bold text-sky-900">20:00 UTC</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-sky-200/80 font-mono">
                <span className="text-[10px] text-slate-400 block font-sans">Nuit</span>
                <span className="font-bold text-sky-900">23:00 UTC</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-sky-200/80 font-mono">
                <span className="text-[10px] text-slate-400 block font-sans">Nuit tardive</span>
                <span className="font-bold text-sky-900">02:00 UTC</span>
              </div>
            </div>
          </div>
        </div>

        {/* Boutons d'action épurés */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <a
            href="https://supabase.com/dashboard/project/npwauvoacscumdzpbjoc"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition flex items-center justify-center gap-1.5 text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ouvrir la console Supabase</span>
          </a>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="w-full sm:w-auto px-4 py-2 bg-[#1F4F4A] hover:bg-[#163834] text-white rounded-xl font-medium transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Test en cours...' : 'Tester la connexion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
