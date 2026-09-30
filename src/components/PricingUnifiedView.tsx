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
import { PricingRecommendationModal } from './pricing/PricingRecommendationModal';
import { ExecutiveReportModal } from './ExecutiveReportModal';

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
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(false);
  const [isExecutiveReportOpen, setIsExecutiveReportOpen] = useState(false);

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
  const [launchingTarget, setLaunchingTarget] = useState<string | null>(null);
  const [liveCampaignOverride, setLiveCampaignOverride] = useState<PricingCampaign | null>(null);
  const [trips, setTrips] = useState<TripResult[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [startFilter, setStartFilter] = useState('');
  const [endFilter, setEndFilter] = useState('');

  const displayedCampaign = useMemo(() => {
    if (liveCampaignOverride && liveCampaignOverride.id === activeCampaignId) {
      return liveCampaignOverride;
    }
    return activeCampaign;
  }, [liveCampaignOverride, activeCampaign, activeCampaignId]);

  // Suivi de l'état des campagnes pour déclencher le SweetAlert Récapitulatif
  const alertedCampaignsRef = React.useRef<Set<string>>(new Set());
  const previousCampaignStatusRef = React.useRef<Record<string, string>>({});
  const cancelRequestedRef = React.useRef<boolean>(false);

  useEffect(() => {
    campaigns.forEach((camp) => {
      const prevStatus = previousCampaignStatusRef.current[camp.id];
      previousCampaignStatusRef.current[camp.id] = camp.status;

      // Détection de transition vers un état final
      if (prevStatus === 'in_progress' && (camp.status === 'completed' || camp.status === 'failed' || camp.status === 'cancelled')) {
        if (!alertedCampaignsRef.current.has(camp.id)) {
          alertedCampaignsRef.current.add(camp.id);

          if (camp.status === 'completed') {
            const completedPairs = camp.completedPairs || camp.totalPairs || 0;
            const durationSec = camp.durationSeconds || 0;
            const heroAvg = camp.heroStats?.avgPrice || 0;
            const yangoAvg = camp.avgPrice || 0;
            const heroCheaper = camp.deltaStats?.heroCheaperCount || 0;
            const yangoCheaper = camp.deltaStats?.yangoCheaperCount || 0;
            const avgDelta = camp.deltaStats?.avgDeltaFcfa || 0;

            Swal.fire({
              title: '<span style="color: #1F4F4A; font-weight: 700; font-size: 20px;">Relevé de Pricing Terminé !</span>',
              html: `
                <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6; margin-top: 8px;">
                  <div style="background: #F0FDF4; border: 1px solid #BBF7D0; padding: 12px; border-radius: 12px; margin-bottom: 12px;">
                    <div style="font-weight: 600; color: #166534; margin-bottom: 4px;">✅ Synthèse de la campagne (${camp.cityName})</div>
                    <div>• <b>${completedPairs}</b> trajets tarifés avec succès</div>
                    <div>• Durée totale d'exécution : <b>${durationSec}s</b></div>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px; border-radius: 10px; text-align: center;">
                      <div style="font-size: 11px; color: #64748B; font-weight: 600;">MOYENNE HERO CAB</div>
                      <div style="font-size: 16px; font-weight: 700; color: #1F4F4A; margin-top: 2px;">
                        ${heroAvg > 0 ? `${heroAvg.toLocaleString('fr-FR')} FCFA` : '—'}
                      </div>
                    </div>
                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px; border-radius: 10px; text-align: center;">
                      <div style="font-size: 11px; color: #64748B; font-weight: 600;">MOYENNE YANGO</div>
                      <div style="font-size: 16px; font-weight: 700; color: #D97706; margin-top: 2px;">
                        ${yangoAvg > 0 ? `${yangoAvg.toLocaleString('fr-FR')} FCFA` : '—'}
                      </div>
                    </div>
                  </div>

                  <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 12px; border-radius: 10px; font-size: 12px;">
                    <div>🏆 <b>Hero Cab plus avantageux :</b> ${heroCheaper} trajet(s)</div>
                    <div>⚡ <b>Yango plus avantageux :</b> ${yangoCheaper} trajet(s)</div>
                    ${avgDelta > 0 ? `<div style="margin-top: 4px; color: #0284C7;">📊 Écart moyen constaté : <b>${avgDelta.toLocaleString('fr-FR')} FCFA</b></div>` : ''}
                  </div>
                </div>
              `,
              icon: 'success',
              confirmButtonText: 'Consulter les résultats',
              confirmButtonColor: '#1F4F4A',
              customClass: {
                popup: 'rounded-2xl shadow-2xl'
              }
            });
          } else if (camp.status === 'failed') {
            Swal.fire({
              title: 'Échec du Relevé de Tarification',
              text: camp.errorMessage || 'Le calcul des tarifs a échoué ou aucun prix n’a pu être obtenu.',
              icon: 'error',
              confirmButtonColor: '#EF4444',
              confirmButtonText: 'Compris'
            });
          } else if (camp.status === 'cancelled') {
            Swal.fire({
              title: 'Campagne Interrompue',
              text: 'La tarification a été arrêtée à la demande de l’utilisateur.',
              icon: 'info',
              confirmButtonColor: '#64748B',
              confirmButtonText: 'Fermer'
            });
          }
        }
      }
    });
  }, [campaigns]);

  useEffect(() => {
    if (!activeCampaignId) {
      setTrips([]);
      return;
    }
    const currentCamp = (liveCampaignOverride && liveCampaignOverride.id === activeCampaignId)
      ? liveCampaignOverride
      : campaigns.find(c => c.id === activeCampaignId);

    if (currentCamp?.status === 'in_progress') {
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
  }, [activeCampaignId, campaigns, liveCampaignOverride]);

  const handleLaunch = async (overrideLimit: number | 'all') => {
    if (totalCombinations === 0) return;
    cancelRequestedRef.current = false;
    const targetKey = overrideLimit === 'all' ? 'all' : String(overrideLimit);
    setLaunchingTarget(targetKey);
    try {
      const result = await api.startCampaign({
        cityId: currentCity.id,
        triggerType: 'manual',
        triggeredByUserId: user?.id || 'manual_user',
        triggeredByUserName: (user?.name && !user.name.toLowerCase().includes('landry')) ? user.name : 'Admin Citrine',
        selectedClasses: ['econom'],
        sampleLimit: overrideLimit
      });

      if (result?.campaign) {
        onCampaignStarted(result.campaign.id);
        handleCampaignChange(result.campaign.id);
        setLiveCampaignOverride(result.campaign);
        setTrips([]);

        const campaignId = result.campaign.id;
        const totalChunks = result.totalChunks || 1;

        // Exécution séquentielle fluide et stable des lots (1 lot à la fois pour éviter tout goulot d'étranglement API)
        for (let chunkIdx = 1; chunkIdx <= totalChunks; chunkIdx++) {
          if (cancelRequestedRef.current) {
            console.log('[Campaign] Annulation demandée, arrêt immédiat de la boucle de lots.');
            break;
          }
          try {
            const chunkRes = await api.processCampaignChunk(campaignId, chunkIdx);
            if (chunkRes.campaign) {
              setLiveCampaignOverride(chunkRes.campaign);
            }
          } catch (chunkErr) {
            console.warn(`Erreur sur le lot ${chunkIdx}:`, chunkErr);
          }
        }

        // Finalisation globale de la campagne (uniquement si non annulée)
        if (!cancelRequestedRef.current) {
          const finalRes = await api.finalizeCampaign(campaignId);
          if (finalRes?.campaign) {
            setLiveCampaignOverride(finalRes.campaign);
          }
          const finalTrips = await api.getCampaignResults(campaignId);
          setTrips(finalTrips || []);
          if (onRefresh) await onRefresh();
        }
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Erreur', text: err?.message || 'Erreur de démarrage' });
    } finally {
      setLaunchingTarget(null);
    }
  };

  const handleCancelCampaign = async () => {
    if (!activeCampaignId) return;
    // 1. Coupe immédiatement la boucle locale de lots en 0ms
    cancelRequestedRef.current = true;
    setIsCancelling(true);

    // 2. Notifie le serveur d'annuler en mémoire (ne dépend plus de Firestore)
    try {
      await api.cancelCampaign(activeCampaignId);
    } catch (err: any) {
      console.warn('[Cancel] Notification serveur:', err?.message);
    } finally {
      setIsCancelling(false);
      if (onRefresh) onRefresh();
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
      Swal.fire({
        icon: 'error',
        title: 'Erreur lors du test',
        text: err.message || 'Impossible de calculer le tarif pour ce trajet.',
        confirmButtonColor: '#1F4F4A'
      });
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
      const orig = t.origin || t.startNeighborhoodName;
      const dest = t.destination || t.endNeighborhoodName;
      if (startFilter && orig !== startFilter && !orig?.includes(startFilter)) return false;
      if (endFilter && dest !== endFilter && !dest?.includes(endFilter)) return false;
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
        onRefresh={onRefresh}
        showSingleTester={showSingleTester}
        onToggleSingleTester={() => setShowSingleTester(!showSingleTester)}
        totalCombinations={totalCombinations}
        launchingTarget={launchingTarget}
        onLaunch={handleLaunch}
        activeCampaign={displayedCampaign}
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

      {displayedCampaign && (
        <PricingLiveTracker
          campaign={displayedCampaign}
          isCancelling={isCancelling}
          onCancelCampaign={handleCancelCampaign}
          onRestartCampaign={() => handleLaunch(displayedCampaign.sampleLimit || 'all')}
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
        onOpenRecommendations={() => setIsRecommendationsOpen(true)}
        onOpenExecutiveReport={() => setIsExecutiveReportOpen(true)}
      />

      <PricingResultsTable
        trips={filteredTrips}
        isLoading={isLoadingTrips}
        cityName={currentCity.name}
        isPricingRunning={displayedCampaign?.status === 'in_progress'}
        onInspectTrip={setInspectedTrip}
      />

      {inspectedTrip && (
        <YangoResponseInspectorModal trip={inspectedTrip} onClose={() => setInspectedTrip(null)} />
      )}

      {/* Modal Recommandations Hero Cab */}
      <PricingRecommendationModal
        isOpen={isRecommendationsOpen}
        onClose={() => setIsRecommendationsOpen(false)}
        trips={trips}
        cityName={currentCity.name}
      />

      {/* Modal Fiche Synthèse Exécutive PDF 1 page */}
      {displayedCampaign && (
        <ExecutiveReportModal
          isOpen={isExecutiveReportOpen}
          onClose={() => setIsExecutiveReportOpen(false)}
          campaign={displayedCampaign}
          trips={trips}
        />
      )}
    </div>
  );
};
