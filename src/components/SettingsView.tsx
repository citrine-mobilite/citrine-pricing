import React, { useState, useEffect } from 'react';
import { HeroSettings, TripMasterSettings, YangoSettings } from '../types';
import { api } from '../services/api';
import { getFirestoreStats, seedFirestoreDatabase } from '../firebase';
import { SettingsTabsHeader } from './settings/SettingsTabsHeader';
import { YangoSettingsCard } from './settings/YangoSettingsCard';
import { HeroSettingsCard } from './settings/HeroSettingsCard';
import { TripMasterSettingsCard } from './settings/TripMasterSettingsCard';
import { FirebaseSettingsCard } from './settings/FirebaseSettingsCard';
import Swal from 'sweetalert2';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'yango' | 'hero' | 'tripmaster' | 'firebase'>('yango');
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
      setSeedSuccessMsg(`Base Firestore synchronisée avec succès (${res.usersCount} utilisateurs, ${res.citiesCount} villes, ${res.neighborhoodsCount} quartiers).`);
      Swal.fire({
        title: 'Synchronisation réussie',
        text: 'La base Firestore est à jour.',
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

  const [tripMasterSettings, setTripMasterSettings] = useState<TripMasterSettings>({
    distanceEndpoint: 'https://tripmastercameroon.com/get-distance',
    searchVehicleEndpoint: 'https://tripmastercameroon.com/search-vehicle',
    requestDelayMs: 150,
    mode: 'live'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    api.getSettings().then((data) => setYangoSettings(data)).catch(console.error);
    api.getHeroSettings().then((data) => setHeroSettings(data)).catch(console.error);
    api.getTripMasterSettings().then((data) => setTripMasterSettings(data)).catch(console.error);
  }, []);

  const handleSaveYango = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateSettings(yangoSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Paramètres Yango enregistrés',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Erreur lors de la sauvegarde Yango.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
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
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Paramètres Hero Cab enregistrés',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Erreur lors de la sauvegarde Hero.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTripMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateTripMasterSettings(tripMasterSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Paramètres Trip Master enregistrés',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Erreur lors de la sauvegarde Trip Master.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
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

      {activeTab === 'firebase' && (
        <FirebaseSettingsCard
          dbStats={dbStats}
          isSeeding={isSeeding}
          seedSuccessMsg={seedSuccessMsg}
          onManualSync={handleManualSync}
        />
      )}
    </div>
  );
};
