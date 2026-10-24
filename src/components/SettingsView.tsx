import React, { useState, useEffect } from 'react';
import { HeroSettings, TripMasterSettings, YangoSettings } from '../types';
import { api } from '../services/api';
import { getFirestoreStats, seedFirestoreDatabase } from '../firebase';
import { SettingsTabsHeader } from './settings/SettingsTabsHeader';
import { YangoSettingsCard } from './settings/YangoSettingsCard';
import { HeroSettingsCard } from './settings/HeroSettingsCard';
import { TripMasterSettingsCard } from './settings/TripMasterSettingsCard';
import { DatabaseSettingsCard } from './settings/DatabaseSettingsCard';
import Swal from 'sweetalert2';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'yango' | 'hero' | 'tripmaster' | 'database'>('yango');
  const [dbStats, setDbStats] = useState<{ userCount: number; cityCount: number; neighborhoodCount: number }>({
    userCount: 0,
    cityCount: 0,
    neighborhoodCount: 0
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
      setSeedSuccessMsg(`Base de données synchronisée avec succès (${res.usersCount} utilisateurs, ${res.citiesCount} villes, ${res.neighborhoodsCount} quartiers).`);
      Swal.fire({
        title: 'Synchronisation réussie',
        text: 'La base de données est à jour.',
        icon: 'success',
        confirmButtonColor: '#1F4F4A',
        timer: 2500
      });
    } catch (err: any) {
      console.error('Seeding error:', err);
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Erreur lors de la synchronisation.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
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
      { id: 'econom', name: 'Économique', enabled: true, multiplier: 1, baseFare: 300, minFare: 500, perKmRate: 150, perMinuteRate: 30 },
      { id: 'comfort', name: 'Confort', enabled: true, multiplier: 1.25, baseFare: 500, minFare: 800, perKmRate: 220, perMinuteRate: 40 },
      { id: 'moto', name: 'Moto Taxi', enabled: true, multiplier: 0.6, baseFare: 150, minFare: 250, perKmRate: 80, perMinuteRate: 15 }
    ]
  });

  const [heroSettings, setHeroSettings] = useState<HeroSettings>({
    apiEndpoint: 'https://demos.bbcsproducts.net/herocabpro/booking/cx-ajax_booking_details.php',
    mode: 'live',
    enabled: true,
    multiplier: 1.15
  });

  const [tripMasterSettings, setTripMasterSettings] = useState<TripMasterSettings>({
    apiEndpoint: 'https://tripmastercameroon.com/',
    mode: 'live',
    enabled: true,
    multiplier: 1.1
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.getYangoSettings().then(setYangoSettings).catch(() => {});
    api.getHeroSettings().then(setHeroSettings).catch(() => {});
    api.getTripMasterSettings().then(setTripMasterSettings).catch(() => {});
  }, []);

  const handleSaveYango = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      await api.saveYangoSettings(yangoSettings);
      setSaveSuccess('Paramètres Yango sauvegardés.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch {
      alert('Erreur lors de la sauvegarde Yango.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      await api.saveHeroSettings(heroSettings);
      setSaveSuccess('Paramètres Hero Cab Pro sauvegardés.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch {
      alert('Erreur lors de la sauvegarde Hero Cab.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTripMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      await api.saveTripMasterSettings(tripMasterSettings);
      setSaveSuccess('Paramètres Trip Master sauvegardés.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch {
      alert('Erreur lors de la sauvegarde Trip Master.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <SettingsTabsHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'yango' && (
        <YangoSettingsCard
          settings={yangoSettings}
          onChange={setYangoSettings}
          onSubmit={handleSaveYango}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
        />
      )}

      {activeTab === 'hero' && (
        <HeroSettingsCard
          settings={heroSettings}
          onChange={setHeroSettings}
          onSubmit={handleSaveHero}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
        />
      )}

      {activeTab === 'tripmaster' && (
        <TripMasterSettingsCard
          settings={tripMasterSettings}
          onChange={setTripMasterSettings}
          onSubmit={handleSaveTripMaster}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
        />
      )}

      {activeTab === 'database' && (
        <DatabaseSettingsCard
          dbStats={dbStats}
          isSeeding={isSeeding}
          seedSuccessMsg={seedSuccessMsg}
          onManualSync={handleManualSync}
        />
      )}
    </div>
  );
};
