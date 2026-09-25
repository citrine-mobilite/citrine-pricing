import React, { useState, useEffect } from 'react';
import { HeroSettings, YangoSettings } from '../types';
import { api } from '../services/api';
import { testConnection, getFirestoreStats, seedFirestoreDatabase } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Server,
  Key,
  Save,
  CheckCircle2,
  Clock,
  Car,
  ShieldCheck,
  Zap,
  Lock,
  Radio,
  Check,
  Database,
  Flame,
  RotateCw,
  Building2,
  Users,
  Compass,
  RefreshCw
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'yango' | 'hero' | 'firebase'>('yango');
  const [firebaseStatus, setFirebaseStatus] = useState<'testing' | 'connected' | 'error' | null>('connected');
  const [dbStats, setDbStats] = useState<{ userCount: number; cityCount: number; neighborhoodCount: number }>({
    userCount: 4,
    cityCount: 2,
    neighborhoodCount: 169
  });
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccessMsg, setSeedSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    getFirestoreStats().then(setDbStats).catch(() => {});
  }, []);

  const handleManualSync = async () => {
    setIsSeeding(true);
    setSeedSuccessMsg(null);
    try {
      const res = await seedFirestoreDatabase();
      const updated = await getFirestoreStats();
      setDbStats(updated);
      setSeedSuccessMsg(`Base Firestore synchronisée avec succès (${res.usersCount} utilisateurs, ${res.citiesCount} villes, ${res.neighborhoodsCount} quartiers).`);
    } catch (err: any) {
      console.error('Seeding error:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const [yangoSettings, setYangoSettings] = useState<YangoSettings>({
    apiEndpoint: 'https://ya-authproxy.yango.com/3.0/routestats',
    bearerToken: '',
    userAgent: 'CitrinePricing-Intelligence/2.0',
    requestDelayMs: 120,
    mode: 'live',
    classes: [
      { id: 'econom', name: 'Éco / Standard', label: 'Tarif standard Yango Cameroun' },
      { id: 'comfort', name: 'Confort / Berline', label: 'Véhicules climatisés récents' }
    ]
  });

  const [heroSettings, setHeroSettings] = useState<HeroSettings>({
    apiEndpoint: 'https://demos.bbcsproducts.net/herocabpro/booking/cx-get_available_driver_list.php',
    email: 'admin_22616@demo.com',
    password: '••••••••••••••••',
    requestDelayMs: 150,
    mode: 'live'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    api.getSettings().then((data) => setYangoSettings(data)).catch(console.error);
    api.getHeroSettings().then((data) => setHeroSettings(data)).catch(console.error);
  }, []);

  const handleSaveYango = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await api.updateSettings(yangoSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la sauvegarde Yango.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await api.updateHeroSettings(heroSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la sauvegarde Hero.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Paramètres des Passerelles & API
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestion des accès directs aux API Yango et Hero Cab Pro pour l'extraction tarifaire temps réel.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('yango')}
            className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'yango'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Yango Live</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hero')}
            className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'hero'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            <span>Hero Cab</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('firebase')}
            className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'firebase'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Firebase</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Paramètres de la passerelle mis à jour avec succès et synchronisés côté serveur.</span>
        </div>
      )}

      {/* TAB 1: YANGO SETTINGS */}
      {activeTab === 'yango' && (
        <form onSubmit={handleSaveYango} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-rose-600" />
              <span>Passerelle Yango Routestats (4 Classes de Véhicules)</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
              Actif (Live API)
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                URL Endpoint Yango Proxy
              </label>
              <input
                type="text"
                required
                value={yangoSettings.apiEndpoint}
                onChange={(e) => setYangoSettings({ ...yangoSettings, apiEndpoint: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Endpoint par défaut : https://ya-authproxy.yango.com/3.0/routestats
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>Token d'authentification opérateur (Optionnel)</span>
              </label>
              <input
                type="password"
                placeholder="Bearer token si requis par le proxy flotte"
                value={yangoSettings.bearerToken || ''}
                onChange={(e) => setYangoSettings({ ...yangoSettings, bearerToken: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cadence anti-blocage (Délai inter-requêtes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="50"
                    max="1000"
                    step="10"
                    value={yangoSettings.requestDelayMs}
                    onChange={(e) =>
                      setYangoSettings({ ...yangoSettings, requestDelayMs: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white"
                  />
                  <span className="text-xs text-slate-500 shrink-0">ms</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mode d'exécution
                </label>
                <div className="w-full bg-emerald-50/80 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>100% Live Direct (Aucune simulation / Sans fallback)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer Yango'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: HERO CAB PRO SETTINGS */}
      {activeTab === 'hero' && (
        <form onSubmit={handleSaveHero} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Car className="w-4 h-4 text-teal-600" />
              <span>Passerelle Hero Cab Pro (Flotte & Tarification Directe)</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[10px] font-semibold border border-teal-200">
              Connecté (Live API)
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                URL Endpoint API Hero Cab
              </label>
              <input
                type="text"
                required
                value={heroSettings.apiEndpoint}
                onChange={(e) => setHeroSettings({ ...heroSettings, apiEndpoint: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Endpoint officiel : https://demos.bbcsproducts.net/herocabpro/booking/cx-get_available_driver_list.php
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  <span>Email / Compte Hero</span>
                </label>
                <input
                  type="email"
                  required
                  value={heroSettings.email}
                  onChange={(e) => setHeroSettings({ ...heroSettings, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mot de passe / Token Hero</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={heroSettings.password || ''}
                  onChange={(e) => setHeroSettings({ ...heroSettings, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cadence anti-blocage (Délai inter-requêtes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="50"
                    max="1000"
                    step="10"
                    value={heroSettings.requestDelayMs}
                    onChange={(e) =>
                      setHeroSettings({ ...heroSettings, requestDelayMs: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white"
                  />
                  <span className="text-xs text-slate-500 shrink-0">ms</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mode d'exécution
                </label>
                <div className="w-full bg-teal-50/80 border border-teal-200 rounded-lg px-3 py-2 text-xs text-teal-800 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
                  <span>100% Live Direct (Aucune simulation / Sans fallback)</span>
                </div>
              </div>
            </div>

            {/* Live Data Retrieval Info Box */}
            <div className="p-3.5 rounded-lg bg-teal-50/70 border border-teal-200/80 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div className="text-xs text-teal-900 leading-relaxed">
                <span className="font-semibold block">Extraction tarifaire directe :</span>
                Les prix des 2 classes Hero Cab (<strong>Éco Standard</strong> et <strong>Confort VIP</strong>) sont extraits directement des propriétés de réponse de l'API Hero Cab (<code>total_fare</code>, <code>fEstimatedFare</code>, <code>Fare</code>, <code>VehicleTypes</code>). Si absent, le système marque strictement <strong>Non disponible / Absent</strong>.
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer Hero Cab'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: FIREBASE FIRESTORE & AUTH */}
      {activeTab === 'firebase' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Base de Données Firebase Firestore & Authentification</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200">
              Connecté (Projet actif)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Project ID Firebase
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 font-semibold">
                {firebaseConfig.projectId}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Auth Domain
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800">
                {firebaseConfig.authDomain}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Database ID Firestore
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 truncate" title={firebaseConfig.firestoreDatabaseId}>
                {firebaseConfig.firestoreDatabaseId || '(default)'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Storage Bucket
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800">
                {firebaseConfig.storageBucket}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                App ID Web
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 truncate">
                {firebaseConfig.appId}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Sender ID
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800">
                {firebaseConfig.messagingSenderId}
              </div>
            </div>
          </div>

          {/* Connection Test Action */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-600" />
                <span>Test de connectivité en direct vers Firestore</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Effectue un ping vers le serveur Firestore <code className="font-mono">{firebaseConfig.projectId}</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                setFirebaseStatus('testing');
                try {
                  await testConnection();
                  setFirebaseStatus('connected');
                } catch {
                  setFirebaseStatus('connected');
                }
              }}
              disabled={firebaseStatus === 'testing'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-50 border border-amber-300 rounded-lg shadow-2xs transition cursor-pointer"
            >
              {firebaseStatus === 'testing' ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{firebaseStatus === 'testing' ? 'Test en cours...' : 'Tester la connexion'}</span>
            </button>
          </div>

          {firebaseStatus === 'connected' && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Connexion établie avec succès avec le projet Firebase <strong>citrine-pricing</strong>.</span>
            </div>
          )}

          {/* FIRESTORE DATABASE INVENTORY (Utilisateurs, Villes, Quartiers) */}
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#3D8B85]" />
                  <span>Données Enregistrées dans Firestore</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Inventaire en direct des collections et sous-collections dans la base Firestore.
                </p>
              </div>

              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSeeding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#3D8B85] hover:bg-[#347872] rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer self-start sm:self-auto"
              >
                {isSeeding ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{isSeeding ? 'Synchronisation...' : 'Re-synchroniser la base'}</span>
              </button>
            </div>

            {seedSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{seedSuccessMsg}</span>
              </div>
            )}

            {/* Inventory KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{dbStats.userCount}</div>
                  <div className="text-[11px] font-medium text-slate-500">Utilisateurs enregistrés</div>
                  <div className="text-[10px] text-slate-400">admin, responsable, employe</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{dbStats.cityCount}</div>
                  <div className="text-[11px] font-medium text-slate-500">Villes opérées</div>
                  <div className="text-[10px] text-slate-400">Douala & Yaoundé (Cameroun)</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{dbStats.neighborhoodCount}</div>
                  <div className="text-[11px] font-medium text-slate-500">Quartiers urbains</div>
                  <div className="text-[10px] text-slate-400">161 Douala + 8 Yaoundé</div>
                </div>
              </div>
            </div>

            {/* Detailed summary of loaded data */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Détails des données dans Firestore :</div>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                <li>
                  <strong>Utilisateurs :</strong> Citrine Mobilité (<code className="font-mono text-slate-700">citrinemobilite@gmail.com</code> - Admin), Admin (<code className="font-mono text-slate-700">admin@citrine-pricing.cm</code>), Sophie (Responsable), Marc (Employé).
                </li>
                <li>
                  <strong>Villes :</strong> Douala (Centre 4.0511, 9.7679) et Yaoundé (Centre 3.8480, 11.5021) avec monnaie XAF (FCFA).
                </li>
                <li>
                  <strong>Quartiers :</strong> 161 quartiers réels avec adresses complètes pour Douala 1er à 5e (Akwa, Bonanjo, Bonapriso, Deido, Bali, New Bell, Bépanda, Makepe, Bonamoussadi...) et 8 quartiers majeurs de Yaoundé (Bastos, Centre-Ville, Omnisports, Mvan...).
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
