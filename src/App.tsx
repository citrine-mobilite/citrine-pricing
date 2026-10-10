import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { PricingUnifiedView } from './components/PricingUnifiedView';
import { CampaignsView } from './components/CampaignsView';
import { TemporalComparisonView } from './components/TemporalComparisonView';
import { CitiesView } from './components/CitiesView';
import { NeighborhoodsView } from './components/NeighborhoodsView';
import { HistoryView } from './components/HistoryView';
import { UsersView } from './components/UsersView';
import { SettingsView } from './components/SettingsView';
import { ProfileView } from './components/ProfileView';
import { QuotaNoticeBanner } from './components/QuotaNoticeBanner';
import { LoginPage } from './components/LoginPage';
import { HeroLogo } from './components/HeroLogo';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { api } from './services/api';
import { City, Neighborhood, PricingCampaign, User } from './types';
import { RotateCw } from 'lucide-react';

function AppContent() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Core Data States loaded dynamically from database
  const [cities, setCities] = useState<City[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [campaigns, setCampaigns] = useState<PricingCampaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected Entities
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Campaign selection helper: updates both selectedCampaignId and selectedCityId
  const handleSelectCampaign = useCallback((campaignId: string) => {
    setSelectedCampaignId(campaignId);
    const targetCampaign = campaigns.find((c) => String(c.id) === String(campaignId));
    if (targetCampaign) {
      setSelectedCityId(String(targetCampaign.cityId));
    }
    setActiveTab('pricing');
  }, [campaigns]);

  // Fetch all core datasets
  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      const [citiesData, campaignsData, usersData] = await Promise.all([
        api.getCities(forceRefresh),
        api.getCampaigns(),
        api.getUsers().catch(() => [])
      ]);

      if (citiesData && citiesData.length > 0) {
        setCities(citiesData);
        setSelectedCityId((prev) => (citiesData.some((c) => String(c.id) === String(prev)) ? prev : String(citiesData[0].id)));
      }

      if (campaignsData && campaignsData.length > 0) {
        setCampaigns(campaignsData);
        setSelectedCampaignId((prev) => (prev && campaignsData.some((c) => String(c.id) === String(prev)) ? prev : String(campaignsData[0].id)));
      } else {
        setCampaigns([]);
        setSelectedCampaignId(null);
      }

      if (usersData && usersData.length > 0) {
        setUsers(usersData);
      }

      // Fetch neighborhoods for all cities
      if (citiesData && citiesData.length > 0) {
        const nbsPromises = citiesData.map((c) => api.getNeighborhoods(String(c.id), forceRefresh));
        const nbsResults = await Promise.all(nbsPromises);
        const allNbs = nbsResults.flat();
        if (allNbs && allNbs.length > 0) {
          setNeighborhoods(allNbs);
        }
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchData();
    }
  }, [isAuthenticated, user, fetchData]);

  // Soft background sync for campaigns when one is running (every 10s max, without hammering Vercel)
  useEffect(() => {
    if (!isAuthenticated) return;
    const activeCamps = campaigns.filter((c) => c.status === 'in_progress');
    if (activeCamps.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const updatedCampaigns = await api.getCampaigns();
        setCampaigns(updatedCampaigns);
      } catch (err) {
        console.error('Error refreshing campaign list:', err);
      }
    }, 10000); // 10s interval instead of 1s to save 90% Vercel quota

    return () => clearInterval(interval);
  }, [isAuthenticated, campaigns]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center space-y-3">
        <HeroLogo size="xl" showSubtitle={true} className="animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  const activeCampaigns = campaigns.filter((c) => c.status === 'in_progress');

  // Enriched cities for CitiesView
  const enrichedCities = cities.map((c) => {
    const cityNbs = neighborhoods.filter((n) => n.cityId === c.id);
    const activeNbs = cityNbs.filter((n) => n.active);
    const count = activeNbs.length;
    return {
      ...c,
      neighborhoodsCount: cityNbs.length,
      activeNeighborhoodsCount: count,
      possiblePairs: count > 1 ? count * (count - 1) : 0
    };
  });

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800 flex font-sans antialiased selection:bg-amber-500/20 selection:text-amber-900">
      
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCampaignCount={activeCampaigns.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Navbar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Global Quota Notice Banner (Passive Exception Catch) */}
        <QuotaNoticeBanner />

        {/* Content Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-2.5">
                <RotateCw className="w-6 h-6 text-amber-600 animate-spin" />
                <span className="text-xs text-slate-500 font-medium">
                  Chargement des données Citrine Pricing...
                </span>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardView
                    cities={cities}
                    campaigns={campaigns}
                    neighborhoods={neighborhoods}
                    onNavigate={setActiveTab}
                    onSelectCampaign={handleSelectCampaign}
                    onRefresh={handleRefresh}
                    onLaunchCity={(cityId) => {
                      setSelectedCityId(cityId);
                      setActiveTab('pricing');
                    }}
                  />
                )}

                {activeTab === 'pricing' && (
                  <PricingUnifiedView
                    cities={cities}
                    neighborhoods={neighborhoods}
                    selectedCityId={selectedCityId}
                    onSelectCityId={setSelectedCityId}
                    selectedCampaignId={selectedCampaignId}
                    onSelectCampaignId={setSelectedCampaignId}
                    campaigns={campaigns}
                    onRefresh={handleRefresh}
                    onCampaignStarted={(campId) => {
                      setSelectedCampaignId(campId);
                    }}
                  />
                )}

                {activeTab === 'campaigns' && (
                  <CampaignsView
                    campaigns={campaigns}
                    onSelectCampaign={handleSelectCampaign}
                    onNavigate={setActiveTab}
                    onRefresh={handleRefresh}
                  />
                )}

                {activeTab === 'temporal' && (
                  <TemporalComparisonView
                    campaigns={campaigns}
                    cities={enrichedCities}
                    neighborhoods={neighborhoods}
                    onSelectCampaign={handleSelectCampaign}
                  />
                )}

                {activeTab === 'cities' && (
                  <CitiesView
                    cities={enrichedCities}
                    onRefresh={handleRefresh}
                    onSelectCityNeighborhoods={(cityId) => {
                      setSelectedCityId(cityId);
                      setActiveTab('neighborhoods');
                    }}
                    onLaunchPricingForCity={(cityId) => {
                      setSelectedCityId(cityId);
                      setActiveTab('pricing');
                    }}
                  />
                )}

                {activeTab === 'neighborhoods' && (
                  <NeighborhoodsView
                    cities={cities}
                    neighborhoods={neighborhoods}
                    selectedCityId={selectedCityId}
                    onSelectCityId={setSelectedCityId}
                    onRefresh={handleRefresh}
                    onLaunchPricingForCity={(cityId) => {
                      setSelectedCityId(cityId);
                      setActiveTab('pricing');
                    }}
                  />
                )}

                {activeTab === 'history' && (
                  <HistoryView
                    campaigns={campaigns}
                    cities={cities}
                    onSelectCampaign={handleSelectCampaign}
                    onNavigate={setActiveTab}
                    onRefresh={fetchData}
                  />
                )}

                {activeTab === 'profile' && (
                  <ProfileView
                    campaigns={campaigns}
                    onSelectCampaign={handleSelectCampaign}
                    onNavigate={setActiveTab}
                    onRefresh={fetchData}
                  />
                )}

                {activeTab === 'users' && user?.role === 'admin' && (
                  <UsersView
                    users={users}
                    onRefresh={fetchData}
                  />
                )}

                {activeTab === 'settings' && user?.role === 'admin' && (
                  <SettingsView />
                )}
              </>
            )}

          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (PWA friendly) */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeCampaignCount={activeCampaigns.length}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          isPricingRunning={activeCampaigns.length > 0}
        />

        {/* Offline indicator */}
        <OfflineIndicator />

      </div>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
