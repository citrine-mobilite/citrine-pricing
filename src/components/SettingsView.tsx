import React, { useState, useEffect } from 'react';
import { HeroSettings, TripMasterSettings, YangoSettings } from '../types';
import { api } from '../services/api';
import { SettingsTabsHeader } from './settings/SettingsTabsHeader';
import { YangoSettingsCard } from './settings/YangoSettingsCard';
import { HeroSettingsCard } from './settings/HeroSettingsCard';
import { TripMasterSettingsCard } from './settings/TripMasterSettingsCard';
import { SupabaseSettingsCard } from './settings/SupabaseSettingsCard';
import Swal from 'sweetalert2';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'yango' | 'hero' | 'tripmaster' | 'supabase'>('yango');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Settings states conformes aux types exacts
  const [yangoSettings, setYangoSettings] = useState<YangoSettings>({
    apiEndpoint: 'https://ya-authproxy.taxi.yandex.net/routestats',
    bearerToken: '',
    userAgent: 'yandex-taxi/5.33.0.12345 Android/12',
    requestDelayMs: 250,
    mode: 'live',
    enabled: true,
    classes: [
      { id: 'econom', name: 'Éco', label: 'Éco standard' },
      { id: 'comfortplus', name: 'Confort+', label: 'Confort supérieur' },
      { id: 'moto', name: 'Moto', label: 'Deux roues' }
    ]
  });

  const [heroSettings, setHeroSettings] = useState<HeroSettings>({
    apiEndpoint: 'https://admin.herocab.pro/api',
    email: '',
    password: '',
    requestDelayMs: 300,
    mode: 'live',
    enabled: true,
    classes: [
      { id: 'standard', name: 'Standard', label: 'Véhicule standard' },
      { id: 'confort', name: 'Confort', label: 'Véhicule climatisé' }
    ]
  });

  const [tripMasterSettings, setTripMasterSettings] = useState<TripMasterSettings>({
    distanceEndpoint: 'https://backend.tripmaster.cm/api/distance',
    searchVehicleEndpoint: 'https://backend.tripmaster.cm/api/vehicles/search',
    requestDelayMs: 300,
    mode: 'live',
    enabled: true
  });

  useEffect(() => {
    // Load existing settings
    Promise.all([
      api.getSettings().catch(() => null),
      api.getHeroSettings().catch(() => null),
      api.getTripMasterSettings().catch(() => null)
    ]).then(([yango, hero, tm]) => {
      if (yango) setYangoSettings(yango);
      if (hero) setHeroSettings(hero);
      if (tm) setTripMasterSettings(tm);
    });
  }, []);

  const handleSaveYango = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateSettings(yangoSettings);
      setSaveSuccess(true);
      Swal.fire({
        title: 'Paramètres enregistrés !',
        text: 'Les réglages de la passerelle Yango ont été mis à jour.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Impossible d’enregistrer les réglages Yango.',
        icon: 'error'
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
      Swal.fire({
        title: 'Paramètres Hero enregistrés !',
        text: 'Les barèmes tarifaires Hero Cab Pro ont été sauvegardés.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Impossible d’enregistrer les réglages Hero Cab Pro.',
        icon: 'error'
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
      Swal.fire({
        title: 'Paramètres Trip Master enregistrés !',
        text: 'Les barèmes tarifaires Trip Master ont été sauvegardés.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Impossible d’enregistrer les réglages Trip Master.',
        icon: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
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

      {activeTab === 'supabase' && (
        <SupabaseSettingsCard />
      )}
    </div>
  );
};
