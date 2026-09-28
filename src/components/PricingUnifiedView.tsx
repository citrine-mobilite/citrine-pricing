import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { City, Neighborhood, PricingCampaign, TripResult } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { YangoResponseInspectorModal } from './YangoResponseInspectorModal';
import { calculatePossibleBenchmarkPairsCount } from '../utils/routeMatrix';
import { PricingStatsSummary, computePricingStats } from './pricing/pricingUtils';
import { usePricingCampaign } from './pricing/usePricingState';
import { PricingHeader } from './pricing/PricingHeader';
import { PricingQuickTester } from './pricing/PricingQuickTester';
import { PricingLiveTracker } from './pricing/PricingLiveTracker';
import { PricingMetricsCards } from './pricing/PricingMetricsCards';
import { PricingResultsFilterBar } from './pricing/PricingResultsFilterBar';
import { PricingResultsTable } from './pricing/PricingResultsTable';

interface PricingUnifiedViewProps {
  cities: City[];
  neighborhoods: Neighborhood[];
  selectedCityId: string;
  onSelectCityId: (cityId: string) => void;
  selectedCampaignId?: string | null;
  onSelectCampaignId?: (campaignId: string) => void;
  campaigns: PricingCampaign[];
  onCampaignStarted: (campaignId: string) => void;
  onRefresh?: () => void;
}

export const PricingUnifiedView: React.FC<PricingUnifiedViewProps> = ({
  cities,
  neighborhoods,
  selectedCityId,
  onSelectCityId,
  selectedCampaignId: propSelectedCampaignId,
  onSelectCampaignId,
  campaigns,
  onCampaignStarted,
  onRefresh
}) => {
  const { user } = useAuth();
  const [isCancelling, setIsCancelling] = useState(false);

  const {
    cityCampaigns,
    activeCampaignId,
    activeCampaign,
    handleCampaignChange,
    handleDeleteCampaign
  } = usePricingCampaign(
    campaigns,
    selectedCityId,
    propSelectedCampaignId,
    onSelectCampaignId,
    onSelectCityId,
    onRefresh
  );

  const currentCity = cities.find((c) => c.id === selectedCityId) || cities[0] || {
    id: selectedCityId || 'city_douala',
    name: 'Douala',
    country: 'Cameroun',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    active: true,
    center: { lat: 4.0511, lng: 9.7679 },
    autoSchedule: { enabled: false, slots: [] }
  };
  const cityActiveNeighborhoods = useMemo(
    () => neighborhoods.filter((n) => n.cityId === currentCity?.id && n.active),
    [neighborhoods, currentCity?.id]
  );
  const totalCombinations = useMemo(
    () => calculatePossibleBenchmarkPairsCount(cityActiveNeighborhoods),
    [cityActiveNeighborhoods]
  );

  const [inspectedTrip, setInspectedTrip] = useState<TripResult | null>(null);
  const [showSingleTester, setShowSingleTester] = useState<boolean>(false);
  const [quickOriginId, setQuickOriginId] = useState<string>(cityActiveNeighborhoods[0]?.id || '');
  const [quickDestId, setQuickDestId] = useState<string>(cityActiveNeighborhoods[1]?.id || '');
  const [isQuickTesting, setIsQuickTesting] = useState<boolean>(false);
  const [quickTestResult, setQuickTestResult] = useState<any>(null);
  const [launchingTarget, setLaunchingTarget] = useState<'25' | 'all' | null>(null);
  const [trips, setTrips] = useState<TripResult[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [startFilter, setStartFilter] = useState('');
  const [endFilter, setEndFilter] = useState('');

  useEffect(() => {
    if (!activeCampaignId) {
      setTrips([]);
      return;
    }
    const currentCamp = campaigns.find(c => c.id === activeCampaignId);
    if (currentCamp?.status === 'in_progress') {
      setTrips([]);
      setIsLoadingTrips(false);
      return;
    }

    let isMounted = true;
    setIsLoadingTrips(true);
    api.getCampaignResults(activeCampaignId)
      .then((data) => {
        if (!isMounted) return;
        setTrips(data || []);
        setIsLoadingTrips(false);
      })
      .catch((err) => {
        console.error('Error loading trips:', err);
        if (isMounted) setIsLoadingTrips(false);
      });

    return () => { isMounted = false; };
  }, [activeCampaignId, campaigns]);

  const handleLaunch = async (overrideLimit: number | 'all') => {
    if (totalCombinations === 0) return;
    const targetKey = overrideLimit === 'all' ? 'all' : '25';
    setLaunchingTarget(targetKey);
    try {
      const result = await api.startCampaign({
        cityId: currentCity.id,
        triggerType: 'manual',
        triggeredByUserId: user?.id || 'manual_user',
        triggeredByUserName: user?.name || user?.email || 'Opérateur',
        selectedClasses: ['econom'],
        sampleLimit: overrideLimit
      });
      if (result?.campaign) {
        onCampaignStarted(result.campaign.id);
        handleCampaignChange(result.campaign.id);
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Erreur', text: err?.message || 'Erreur de démarrage' });
    } finally {
      setLaunchingTarget(null);
    }
  };

  const handleCancelCampaign = async () => {
    if (!activeCampaignId) return;
    setIsCancelling(true);
    try {
      await api.cancelCampaign(activeCampaignId);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRunQuickTest = async () => {
    const origin = cityActiveNeighborhoods.find((n) => n.id === quickOriginId);
    const dest = cityActiveNeighborhoods.find((n) => n.id === quickDestId);
    if (!origin || !dest) return;
    setIsQuickTesting(true);
    setQuickTestResult(null);
    try {
      const res = await api.testSingleRoute({
        startLat: origin.lat,
        startLng: origin.lng,
        endLat: dest.lat,
        endLng: dest.lng,
        startName: origin.name,
        endName: dest.name,
        tariffClass: 'econom',
        cityCurrency: currentCity.currency
      });
      setQuickTestResult(res);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du test.');
    } finally {
      setIsQuickTesting(false);
    }
  };

  const stats: PricingStatsSummary = useMemo(() => computePricingStats(trips), [trips]);
  const neighborhoodNames = useMemo(
    () => Array.from(new Set(cityActiveNeighborhoods.map((n) => n.name))).sort(),
    [cityActiveNeighborhoods]
  );
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (startFilter && t.startNeighborhoodName !== startFilter) return false;
      if (endFilter && t.endNeighborhoodName !== endFilter) return false;
      return true;
    });
  }, [trips, startFilter, endFilter]);

  return (
    <div className="space-y-4">
      <PricingHeader
        cities={cities}
        currentCity={currentCity}
        onSelectCityId={onSelectCityId}
        campaigns={cityCampaigns}
        activeCampaignId={activeCampaignId}
        onCampaignChange={handleCampaignChange}
        onDeleteCampaign={handleDeleteCampaign}
        onRefresh={onRefresh}
        showSingleTester={showSingleTester}
        onToggleSingleTester={() => setShowSingleTester(!showSingleTester)}
        totalCombinations={totalCombinations}
        launchingTarget={launchingTarget}
        onLaunch={handleLaunch}
        activeCampaign={activeCampaign}
      />

      {showSingleTester && (
        <PricingQuickTester
          cityActiveNeighborhoods={cityActiveNeighborhoods}
          quickOriginId={quickOriginId}
          onQuickOriginChange={setQuickOriginId}
          quickDestId={quickDestId}
          onQuickDestChange={setQuickDestId}
          isQuickTesting={isQuickTesting}
          onRunQuickTest={handleRunQuickTest}
          quickTestResult={quickTestResult}
          onInspectResult={() => quickTestResult && setInspectedTrip(quickTestResult)}
        />
      )}

      {activeCampaign && (
        <PricingLiveTracker
          campaign={activeCampaign}
          isCancelling={isCancelling}
          onCancelCampaign={handleCancelCampaign}
        />
      )}

      <PricingMetricsCards stats={stats} currencySymbol={currentCity.currencySymbol || 'FCFA'} />

      <PricingResultsFilterBar
        neighborhoodNames={neighborhoodNames}
        startFilter={startFilter}
        onStartFilterChange={setStartFilter}
        endFilter={endFilter}
        onEndFilterChange={setEndFilter}
        activeCampaignId={activeCampaignId}
        totalTripsCount={trips.length}
      />

      <PricingResultsTable
        trips={filteredTrips}
        isLoading={isLoadingTrips}
        cityName={currentCity.name}
        isPricingRunning={activeCampaign?.status === 'in_progress'}
        onInspectTrip={setInspectedTrip}
      />

      {inspectedTrip && (
        <YangoResponseInspectorModal trip={inspectedTrip} onClose={() => setInspectedTrip(null)} />
      )}
    </div>
  );
};
