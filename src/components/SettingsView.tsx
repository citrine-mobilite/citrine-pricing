import React, { useState, useEffect } from 'react';
import { HeroSettings, TripMasterSettings, YangoSettings } from '../types';
import { api } from '../services/api';
import { SettingsTabsHeader } from './settings/SettingsTabsHeader';
import { YangoSettingsCard } from './settings/YangoSettingsCard';
import { HeroSettingsCard } from './settings/HeroSettingsCard';
import { TripMasterSettingsCard } from './settings/TripMasterSettingsCard';
import { SupabaseSettingsCard } from './settings/SupabaseSettingsCard';
import { AdminProfileSettingsCard } from './settings/AdminProfileSettingsCard';
import Swal from 'sweetalert2';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'yango' | 'hero' | 'tripmaster' | 'supabase' | 'admin'>('supabase');
  const [supabaseStats, setSupabaseStats] = useState({
    userCount: 4,
    cityCount: 1,
    neighborhoodCount: 183,
    campaignCount: 2,
    tripsCount: 817,
    shortagesCount: 157
  });

  const refreshSupabaseStats = () => {
    api.getSupabaseStats()
      .then((res) => {
        if (res?.stats) {
          setSupabaseStats({
            userCount: res.stats.userCount,
            cityCount: res.stats.cityCount,
            neighborhoodCount: res.stats.neighborhoodCount,
            campaignCount: res.stats.campaignCount,
            tripsCount: res.stats.tripsCount,
            shortagesCount: res.stats.shortagesCount
          });
        }
      })
      .catch(() => {
        api.getCities().then(c => setSupabaseStats(prev => ({ ...prev, cityCount: c.length }))).catch(() => {});
        api.getCampaigns().then(c => setSupabaseStats(prev => ({ ...prev, campaignCount: c.length }))).catch(() => {});
        api.getUsers().then(u => setSupabaseStats(prev => ({ ...prev, userCount: u.length }))).catch(() => {});
      });
  };

  useEffect(() => {
    refreshSupabaseStats();
  }, []);

  const [yangoSettings, setYangoSettings] = useState<YangoSettings>({
    apiEndpoint: 'https://ya-authproxy.yango.com/3.0/routestats',
    bearerToken: '',
    userAgent: 'CitrinePricing-Intelligence/2.0',
    requestDelayMs: 120,
    mode: 'live',
    classes: [
      { id: 'econom', name: 'Éco / Standard', label: 'Tarif standard Yango Cameroun' },
      { id: 'comfort', name: 'Confort', label: 'Véhicules climatisés récents' }
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

      {activeTab === 'supabase' && (
        <SupabaseSettingsCard
          stats={supabaseStats}
          onRefreshStats={refreshSupabaseStats}
        />
      )}

      {activeTab === 'admin' && (
        <AdminProfileSettingsCard />
      )}
    </div>
  );
};
