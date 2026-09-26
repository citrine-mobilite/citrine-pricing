import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { PricingUnifiedView } from './components/PricingUnifiedView';
import { CampaignsView } from './components/CampaignsView';
import { CitiesView } from './components/CitiesView';
import { NeighborhoodsView } from './components/NeighborhoodsView';
import { HistoryView } from './components/HistoryView';
import { UsersView } from './components/UsersView';
import { SettingsView } from './components/SettingsView';
import { LoginModal } from './components/LoginModal';
import { api } from './services/api';
import { City, Neighborhood, PricingCampaign, User } from './types';
import { INITIAL_CITIES, INITIAL_NEIGHBORHOODS, INITIAL_USERS } from './data/seedData';
import { RotateCw } from 'lucide-react';

function AppContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Core Data States initialized with reliable seed defaults
  const [cities, setCities] = useState<City[]>(INITIAL_CITIES);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>(INITIAL_NEIGHBORHOODS);
  const [campaigns, setCampaigns] = useState<PricingCampaign[]>([]);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Selected Entities
  const [selectedCityId, setSelectedCityId] = useState<string>('city_douala');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Campaign selection helper: updates both selectedCampaignId and selectedCityId
  const handleSelectCampaign = useCallback((campaignId: string) => {
    setSelectedCampaignId(campaignId);
    const targetCampaign = campaigns.find((c) => c.id === campaignId);
    if (targetCampaign) {
      setSelectedCityId(targetCampaign.cityId);
    }
    setActiveTab('pricing');
  }, [campaigns]);

  // Fetch all core datasets
  const fetchData = useCallback(async () => {
    try {
      const [citiesData, campaignsData, usersData] = await Promise.all([
        api.getCities(),
        api.getCampaigns(),
        api.getUsers().catch(() => [])
      ]);

      if (citiesData && citiesData.length > 0) {
        setCities(citiesData);
        setSelectedCityId((prev) => (citiesData.some((c) => c.id === prev) ? prev : citiesData[0].id));
      }

      if (campaignsData) {
        setCampaigns(campaignsData);
        if (campaignsData.length > 0) {
          setSelectedCampaignId((prev) => (prev && campaignsData.some((c) => c.id === prev) ? prev : campaignsData[0].id));
        }
      }

      if (usersData && usersData.length > 0) {
        setUsers(usersData);
      }

      // Fetch neighborhoods for all cities
      if (citiesData && citiesData.length > 0) {
        const nbsPromises = citiesData.map((c) => api.getNeighborhoods(c.id));
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live polling for running campaigns so UI never hangs or spins indefinitely
  useEffect(() => {
    const hasActiveCampaign = campaigns.some((c) => c.status === 'in_progress');
    if (!hasActiveCampaign) return;

    const interval = setInterval(async () => {
      try {
        const updatedCampaigns = await api.getCampaigns();
        setCampaigns(updatedCampaigns);
      } catch (err) {
        console.error('Error polling active campaigns:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [campaigns]);

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

        {/* Content Workspace */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
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
                    onNavigate={setActiveTab}
                    onSelectCampaign={handleSelectCampaign}
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
                    onRefresh={fetchData}
                    onCampaignStarted={(campId) => {
                      setSelectedCampaignId(campId);
                      fetchData();
                    }}
                  />
                )}

                {activeTab === 'campaigns' && (
                  <CampaignsView
                    campaigns={campaigns}
                    onSelectCampaign={handleSelectCampaign}
                    onNavigate={setActiveTab}
                    onRefresh={fetchData}
                  />
                )}

                {activeTab === 'cities' && (
                  <CitiesView
                    cities={enrichedCities}
                    onRefresh={fetchData}
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
                    onRefresh={fetchData}
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

                {activeTab === 'users' && (
                  <UsersView
                    users={users}
                    onRefresh={fetchData}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsView />
                )}
              </>
            )}

          </div>
        </main>

      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

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
