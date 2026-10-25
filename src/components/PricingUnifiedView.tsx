import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { City, Neighborhood, PricingCampaign, TripResult } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { YangoResponseInspectorModal } from './YangoResponseInspectorModal';
import { calculatePossiblePricingPairsCount, detectArrondissement } from '../utils/routeMatrix';
import {
  PricingStatsSummary,
  computePricingStats,
  getYangoPrice,
  getHeroPrice,
  cleanNeighborhoodName,
  getTripSurgeInfo
} from './pricing/pricingUtils';
import { usePricingCampaign } from './pricing/usePricingState';
import { PricingHeader } from './pricing/PricingHeader';
import { PricingQuickTester } from './pricing/PricingQuickTester';
import { PricingLiveTracker } from './pricing/PricingLiveTracker';
import { PricingMetricsCards } from './pricing/PricingMetricsCards';
import {
  PricingResultsFilterBar,
  TripJamsFilter,
  TripAdvantageFilter,
  TripDistanceFilter,
  TripShortageFilter
} from './pricing/PricingResultsFilterBar';
import { PricingResultsTable } from './pricing/PricingResultsTable';
import { PricingRecommendationModal } from './pricing/PricingRecommendationModal';
import { PricingArrondissementTester } from './pricing/PricingArrondissementTester';
import { PricingAirportView } from './pricing/PricingAirportView';
import { ArrondissementInfo } from './pricing/ArrondissementSelect2';
import { computeCampaignDuration } from '../utils/durationUtils';

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

  const currentCity = cities.find((c) => String(c.id) === String(selectedCityId)) || cities[0] || {
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
    () => (currentCity?.active ? neighborhoods.filter((n) => {
      const nbCityId = String(n.cityId ?? '');
      const cityId = String(currentCity?.id ?? '');
      const cityUuid = String(currentCity?.uuid ?? '');
      return n.active && (nbCityId === cityId || nbCityId === cityUuid);
    }) : []),
    [neighborhoods, currentCity?.id, currentCity?.uuid, currentCity?.active]
  );
  const totalCombinations = useMemo(
    () => calculatePossiblePricingPairsCount(cityActiveNeighborhoods),
    [cityActiveNeighborhoods]
  );

  const arrondissementOptions = useMemo<ArrondissementInfo[]>(() => {
    if (!currentCity?.active) return [];
    const map = new Map<string, { name: string; cityName: string; count: number }>();

    // Détection 100% dynamique des arrondissements et zones de la ville active (évolutif pour toute ville)

    // Quartiers actifs de la ville courante uniquement
    cityActiveNeighborhoods.forEach((nb) => {
      const arrName = detectArrondissement(nb);
      if (!map.has(arrName)) {
        map.set(arrName, { name: arrName, cityName: currentCity.name, count: 1 });
      } else {
        map.get(arrName)!.count += 1;
      }
    });

    const MAX_CALLS_PER_NB = 5;
    const result: ArrondissementInfo[] = [];
    map.forEach((item) => {
      const callsPerNb = Math.min(MAX_CALLS_PER_NB, Math.max(0, item.count - 1));
      const tripCount = item.count >= 2 ? item.count * callsPerNb : 0;
      result.push({
        name: item.name,
        cityName: item.cityName,
        neighborhoodsCount: item.count,
        tripCount,
        formattedLabel: `${item.name} (${tripCount} ${tripCount > 1 ? 'trajets' : 'trajet'} - ${item.cityName})`
      });
    });

    return result.sort((a, b) => {
      if (b.tripCount !== a.tripCount) return b.tripCount - a.tripCount;
      return a.name.localeCompare(b.name);
    });
  }, [currentCity, cityActiveNeighborhoods]);

  const [inspectedTrip, setInspectedTrip] = useState<TripResult | null>(null);
  const [activeTesterPanel, setActiveTesterPanel] = useState<'none' | 'single' | 'intra' | 'inter' | 'airport'>('none');
  const [quickOriginId, setQuickOriginId] = useState<string>(String(cityActiveNeighborhoods[0]?.id || ''));
  const [quickDestId, setQuickDestId] = useState<string>(String(cityActiveNeighborhoods[1]?.id || ''));
  const [isQuickTesting, setIsQuickTesting] = useState<boolean>(false);
  const [quickTestResult, setQuickTestResult] = useState<any>(null);
  const [launchingTarget, setLaunchingTarget] = useState<string | null>(null);
  const [liveCampaignOverride, setLiveCampaignOverride] = useState<PricingCampaign | null>(null);
  const [trips, setTrips] = useState<TripResult[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [startFilter, setStartFilter] = useState('');
  const [endFilter, setEndFilter] = useState('');
  const [arrondissementFilter, setArrondissementFilter] = useState('all');
  const [jamsFilter, setJamsFilter] = useState<TripJamsFilter>('all');
  const [advantageFilter, setAdvantageFilter] = useState<TripAdvantageFilter>('all');
  const [distanceFilter, setDistanceFilter] = useState<TripDistanceFilter>('all');
  const [shortageFilter, setShortageFilter] = useState<TripShortageFilter>('all');

  const handleResetTripFilters = () => {
    setStartFilter('');
    setEndFilter('');
    setArrondissementFilter('all');
    setJamsFilter('all');
    setAdvantageFilter('all');
    setDistanceFilter('all');
    setShortageFilter('all');
  };

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
  const runningCampaignIdRef = React.useRef<string | null>(null);
  const chunkAbortControllerRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    campaigns.forEach((camp) => {
      const prevStatus = previousCampaignStatusRef.current[camp.id];
      previousCampaignStatusRef.current[camp.id] = camp.status;

      // Détection de transition vers un état final
      if (prevStatus === 'in_progress' && (camp.status === 'completed' || camp.status === 'failed' || camp.status === 'cancelled')) {
        const campIdStr = String(camp.id);
        if (!alertedCampaignsRef.current.has(campIdStr)) {
          alertedCampaignsRef.current.add(campIdStr);

          if (camp.status === 'completed') {
            const completedPairs = camp.completedPairs || camp.totalPairs || 0;
            const durationFormatted = computeCampaignDuration(camp);
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
                    <div>• Durée totale d'exécution : <b>${durationFormatted}</b></div>
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

    let isMounted = true;
    setIsLoadingTrips(true);

    const fetchCurrentTrips = async () => {
      try {
        const data = await api.getCampaignResults(activeCampaignId);
        if (isMounted) {
          setTrips(data || []);
          setIsLoadingTrips(false);
        }
      } catch (err) {
        console.error('Error loading trips:', err);
        if (isMounted) setIsLoadingTrips(false);
      }
    };

    fetchCurrentTrips();

    const currentCamp = (liveCampaignOverride && String(liveCampaignOverride.id) === String(activeCampaignId))
      ? liveCampaignOverride
      : campaigns.find(c => String(c.id) === String(activeCampaignId));

    let pollInterval: NodeJS.Timeout | null = null;
    if (currentCamp?.status === 'in_progress') {
      pollInterval = setInterval(async () => {
        if (!isMounted) return;
        try {
          const [freshCamp, freshTrips] = await Promise.all([
            api.getCampaign(activeCampaignId),
            api.getCampaignResults(activeCampaignId).catch(() => [])
          ]);
          if (isMounted) {
            if (freshCamp) setLiveCampaignOverride(freshCamp);
            if (freshTrips && freshTrips.length > 0) setTrips(freshTrips);
            if (freshCamp && freshCamp.status !== 'in_progress' && pollInterval) {
              clearInterval(pollInterval);
              if (onRefresh) onRefresh();
            }
          }
        } catch {}
      }, 1500);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeCampaignId, campaigns, liveCampaignOverride?.status]);

  const handleLaunchWithOptions = async (options: {
    scopeMode: 'global' | 'intra' | 'inter' | 'airport';
    arrondissement?: string;
    originArrondissement?: string;
    destArrondissement?: string;
    sampleLimit?: number | 'all';
    comment?: string;
    timeSlotOverride?: string;
  }) => {
    cancelRequestedRef.current = false;
    const abortCtrl = new AbortController();
    chunkAbortControllerRef.current = abortCtrl;
    const targetKey = options.sampleLimit === 25 ? '25' : 'all';
    setLaunchingTarget(targetKey);
    try {
      const result = await api.startCampaign({
        cityId: String(currentCity.id),
        triggerType: 'manual',
        triggeredByUserId: user?.id ? String(user.id) : 'manual_user',
        triggeredByUserName: user?.name || 'Citrine Opérateur',
        triggeredByUserRole: user?.role || 'employe',
        selectedClasses: ['econom'],
        sampleLimit: options.sampleLimit,
        scopeMode: options.scopeMode,
        arrondissement: options.arrondissement,
        originArrondissement: options.originArrondissement,
        destArrondissement: options.destArrondissement,
        comment: options.comment,
        timeSlotOverride: options.timeSlotOverride && options.timeSlotOverride !== 'auto' ? options.timeSlotOverride : undefined
      });

      if (result?.campaign) {
        const campaignId = String(result.campaign.id);
        runningCampaignIdRef.current = campaignId;
        onCampaignStarted(campaignId);
        handleCampaignChange(campaignId);
        setLiveCampaignOverride(result.campaign);
        setTrips([]);
        setActiveTesterPanel('none');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Polling temps réel depuis le serveur qui gère l'exécution complète en arrière-plan
        while (!cancelRequestedRef.current) {
          await new Promise(r => setTimeout(r, 1500));
          if (cancelRequestedRef.current) break;

          try {
            const [campData, tripsData] = await Promise.all([
              api.getCampaign(campaignId),
              api.getCampaignResults(campaignId).catch(() => [])
            ]);

            if (campData) {
              setLiveCampaignOverride(campData);
              if (tripsData && tripsData.length > 0) {
                setTrips(tripsData);
              }
              if (campData.status === 'completed' || campData.status === 'cancelled') {
                if (onRefresh) await onRefresh();
                break;
              }
            }
          } catch (pollErr) {
            console.warn('[PricingUnifiedView] Erreur polling progression:', pollErr);
          }
        }
      }
    } catch (err: any) {
      if (!cancelRequestedRef.current) {
        Swal.fire({ icon: 'error', title: 'Erreur', text: err?.message || 'Erreur de démarrage' });
      }
    } finally {
      runningCampaignIdRef.current = null;
      chunkAbortControllerRef.current = null;
      setLaunchingTarget(null);
    }
  };

  const handleLaunch = async (overrideLimit: number | 'all') => {
    const isSample = overrideLimit === 25;
    const confirm = await Swal.fire({
      title: isSample ? 'Lancer un test rapide ?' : 'Lancer la tarification complète ?',
      html: `
        <div style="text-align: left; font-size: 12px; color: #334155;">
          <p style="margin-bottom: 8px; color: #475569; line-height: 1.5;">
            ${isSample ? 'Un échantillon de 25 trajets va être calculé pour cette ville.' : `L'ensemble des trajets (${totalCombinations}) va être calculé.`}
          </p>
          <p style="margin: 0; color: #475569; line-height: 1.5;">
            Le créneau horaire sera détecté automatiquement selon l'heure du relevé.
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui, lancer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#1F4F4A'
    });
    if (!confirm.isConfirmed) return;

    handleLaunchWithOptions({
      scopeMode: 'global',
      sampleLimit: overrideLimit
    });
  };

  const handleRestartCampaign = async () => {
    if (!displayedCampaign) return;
    const confirm = await Swal.fire({
      title: 'Relancer cette campagne ?',
      text: `Voulez-vous relancer la campagne "${displayedCampaign.cityName}" sans en créer une nouvelle ?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui, relancer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#1F4F4A'
    });
    if (!confirm.isConfirmed) return;

    cancelRequestedRef.current = false;
    const abortCtrl = new AbortController();
    chunkAbortControllerRef.current = abortCtrl;
    const targetKey = String(displayedCampaign.id);
    setLaunchingTarget(targetKey);
    try {
      const result = await api.startCampaign({
        restartCampaignId: displayedCampaign.id,
        cityId: String(displayedCampaign.cityId || currentCity.id),
        triggerType: 'manual',
        triggeredByUserId: user?.id ? String(user.id) : displayedCampaign.triggeredByUserId || 'manual_user',
        triggeredByUserName: user?.name || displayedCampaign.triggeredByUserName || 'Citrine Opérateur',
        triggeredByUserRole: user?.role || displayedCampaign.triggeredByUserRole || 'employe',
        selectedClasses: displayedCampaign.selectedClasses || ['econom'],
        sampleLimit: displayedCampaign.sampleLimit,
        scopeMode: displayedCampaign.scopeMode || 'global',
        arrondissement: displayedCampaign.arrondissement,
        originArrondissement: displayedCampaign.originArrondissement,
        destArrondissement: displayedCampaign.destArrondissement,
        comment: displayedCampaign.comment,
        timeSlotOverride: displayedCampaign.timeSlotOverride
      });

      if (result?.campaign) {
        const campaignId = String(result.campaign.id);
        runningCampaignIdRef.current = campaignId;
        onCampaignStarted(campaignId);
        handleCampaignChange(campaignId);
        setLiveCampaignOverride(result.campaign);
        setTrips([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Polling temps réel depuis le serveur qui gère l'exécution complète en arrière-plan
        while (!cancelRequestedRef.current) {
          await new Promise(r => setTimeout(r, 1500));
          if (cancelRequestedRef.current) break;

          try {
            const [campData, tripsData] = await Promise.all([
              api.getCampaign(campaignId),
              api.getCampaignResults(campaignId).catch(() => [])
            ]);

            if (campData) {
              setLiveCampaignOverride(campData);
              if (tripsData && tripsData.length > 0) {
                setTrips(tripsData);
              }
              if (campData.status === 'completed' || campData.status === 'cancelled') {
                if (onRefresh) await onRefresh();
                break;
              }
            }
          } catch (pollErr) {
            console.warn('[PricingUnifiedView] Erreur polling relance:', pollErr);
          }
        }
      }
    } catch (err: any) {
      if (!cancelRequestedRef.current) {
        Swal.fire({ icon: 'error', title: 'Erreur', text: err?.message || 'Erreur de relance' });
      }
    } finally {
      runningCampaignIdRef.current = null;
      chunkAbortControllerRef.current = null;
      setLaunchingTarget(null);
    }
  };

  const handleCancelCampaign = async () => {
    // 1. Coupe immédiatement la boucle locale de lots en 0ms
    cancelRequestedRef.current = true;
    setIsCancelling(true);

    // 2. Abort immédiat du fetch réseau en cours
    try {
      chunkAbortControllerRef.current?.abort();
    } catch {}

    // 3. Déterminer l'ID cible fiable
    const targetId = runningCampaignIdRef.current || displayedCampaign?.id || activeCampaignId;

    // 4. Mettre à jour l'UI locale immédiatement en 0ms
    setLiveCampaignOverride(prev => prev ? { ...prev, status: 'cancelled' } : null);

    // 5. Notifie le serveur d'annuler en mémoire vive
    if (targetId) {
      try {
        await api.cancelCampaign(targetId);
      } catch (err: any) {
        console.warn('[Cancel] Notification serveur:', err?.message);
      }
    }

    setIsCancelling(false);
    if (onRefresh) onRefresh();
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

  const neighborhoodNames = useMemo(
    () => Array.from(new Set(cityActiveNeighborhoods.map((n) => cleanNeighborhoodName(n.name)))).sort(),
    [cityActiveNeighborhoods]
  );

  const neighborhoodArrMap = useMemo(() => {
    const map = new Map<string, string>();
    cityActiveNeighborhoods.forEach((n) => {
      const arr = detectArrondissement(n);
      map.set(cleanNeighborhoodName(n.name), arr);
      map.set(n.name, arr);
    });
    return map;
  }, [cityActiveNeighborhoods]);

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const orig = cleanNeighborhoodName(t.origin || t.startNeighborhoodName);
      const dest = cleanNeighborhoodName(t.destination || t.endNeighborhoodName);

      // 0. Arrondissement (départ ou arrivée)
      if (arrondissementFilter && arrondissementFilter !== 'all') {
        const origArr = neighborhoodArrMap.get(orig) || '';
        const destArr = neighborhoodArrMap.get(dest) || '';
        if (origArr !== arrondissementFilter && destArr !== arrondissementFilter) {
          return false;
        }
      }

      // 1. Quartier départ
      if (startFilter && orig !== startFilter && !orig?.includes(startFilter)) return false;

      // 2. Quartier arrivée
      if (endFilter && dest !== endFilter && !dest?.includes(endFilter)) return false;

      // 3. Trafic / Ajustement tarifaire déterministe sur le trajet
      const surge = getTripSurgeInfo(t);
      if (jamsFilter === 'with_jams' && !surge.isSurge) return false;
      if (jamsFilter === 'without_jams' && surge.isSurge) return false;

      // 4. Compétitivité tarifaire
      const yEco = getYangoPrice(t, 'econom');
      const hEco = getHeroPrice(t, 'eco');
      if (advantageFilter === 'hero') {
        if (!hEco || !yEco || hEco >= yEco) return false;
      } else if (advantageFilter === 'yango') {
        if (!hEco || !yEco || yEco >= hEco) return false;
      } else if (advantageFilter === 'equal') {
        if (!hEco || !yEco || hEco !== yEco) return false;
      }

      // 5. Distance
      const dist = t.distanceKm || 0;
      if (distanceFilter === 'short' && dist > 3) return false;
      if (distanceFilter === 'medium' && (dist <= 3 || dist > 7)) return false;
      if (distanceFilter === 'long' && dist <= 7) return false;

      // 6. Tension & Disponibilité Chauffeurs Yango (Pénurie)
      if (shortageFilter === 'shortage' && !t.yangoUnavailable) return false;
      if (shortageFilter === 'available' && t.yangoUnavailable) return false;

      return true;
    });
  }, [trips, arrondissementFilter, neighborhoodArrMap, startFilter, endFilter, jamsFilter, advantageFilter, distanceFilter, shortageFilter]);

  const { campaignNeighborhoods, matrixData } = useMemo(() => {
    const set = new Set<string>();
    const map: Record<string, Record<string, TripResult>> = {};

    trips.forEach((t) => {
      const orig = cleanNeighborhoodName(t.origin || t.startNeighborhoodName);
      const dest = cleanNeighborhoodName(t.destination || t.endNeighborhoodName);
      if (!orig || !dest || orig === '—' || dest === '—') return;

      set.add(orig);
      set.add(dest);

      if (!map[orig]) map[orig] = {};
      map[orig][dest] = t;
    });

    const list = Array.from(set).sort();
    return {
      campaignNeighborhoods: list.length > 0 ? list : neighborhoodNames,
      matrixData: map
    };
  }, [trips, neighborhoodNames]);

  const isTripFiltered =
    (arrondissementFilter && arrondissementFilter !== 'all') ||
    Boolean(startFilter) ||
    Boolean(endFilter) ||
    jamsFilter !== 'all' ||
    advantageFilter !== 'all' ||
    distanceFilter !== 'all' ||
    shortageFilter !== 'all';

  const stats: PricingStatsSummary = useMemo(
    () => computePricingStats(isTripFiltered ? filteredTrips : trips),
    [isTripFiltered, filteredTrips, trips]
  );

  return (
    <div className="space-y-4">
      {/* 1. LES CARDS TOUT EN HAUT */}
      <PricingMetricsCards
        stats={stats}
        currencySymbol={currentCity.currencySymbol || 'FCFA'}
        isFiltered={isTripFiltered}
        totalUnfilteredTrips={trips.length}
        onResetFilters={handleResetTripFilters}
      />

      {/* 2. PUIS LA BARRE DE NAVIGATION ET CIBLAGE RÉORGANISÉE */}
      <PricingHeader
        cities={cities}
        currentCity={currentCity}
        onSelectCityId={onSelectCityId}
        campaigns={cityCampaigns}
        activeCampaignId={activeCampaignId}
        onCampaignChange={handleCampaignChange}
        onRefresh={onRefresh}
        onDeleteCampaign={handleDeleteCampaign}
        activeTesterPanel={activeTesterPanel}
        onToggleTesterPanel={(panel) => setActiveTesterPanel(prev => prev === panel ? 'none' : panel)}
        totalCombinations={totalCombinations}
        launchingTarget={launchingTarget}
        onLaunch={handleLaunch}
        activeCampaign={displayedCampaign}
      />

      {/* 3. ET ENSUITE LA BARRE DE PROGRESSION */}
      {displayedCampaign && (
        <PricingLiveTracker
          campaign={displayedCampaign}
          isCancelling={isCancelling}
          onCancelCampaign={handleCancelCampaign}
          onRestartCampaign={handleRestartCampaign}
        />
      )}

      {/* 1. Panel Test Trajet Unique */}
      {activeTesterPanel === 'single' && (
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

      {/* 2 & 3. Panel 1 Arrondissement / 2 Arrondissements */}
      {(activeTesterPanel === 'intra' || activeTesterPanel === 'inter') && (
        <PricingArrondissementTester
          mode={activeTesterPanel}
          cityName={currentCity.name}
          arrondissementOptions={arrondissementOptions}
          isRunning={displayedCampaign?.status === 'in_progress'}
          onLaunchIntra={(arr, limit, comment) => {
            handleLaunchWithOptions({
              scopeMode: 'intra',
              arrondissement: arr,
              sampleLimit: limit,
              comment
            });
          }}
          onLaunchInter={(originArr, destArr, limit, comment) => {
            handleLaunchWithOptions({
              scopeMode: 'inter',
              originArrondissement: originArr,
              destArrondissement: destArr,
              sampleLimit: limit,
              comment
            });
          }}
        />
      )}

      {/* 4. Panel Destinations Aéroport */}
      {activeTesterPanel === 'airport' && (
        <PricingAirportView
          currentCity={currentCity}
          cityActiveNeighborhoods={cityActiveNeighborhoods}
          isRunning={displayedCampaign?.status === 'in_progress'}
          onLaunchAirport={(limit, comment) => {
            handleLaunchWithOptions({
              scopeMode: 'airport',
              sampleLimit: limit,
              comment
            });
          }}
        />
      )}

      <PricingResultsFilterBar
        neighborhoodNames={neighborhoodNames}
        arrondissements={arrondissementOptions.map(o => o.name)}
        arrondissementFilter={arrondissementFilter}
        onArrondissementFilterChange={setArrondissementFilter}
        startFilter={startFilter}
        onStartFilterChange={setStartFilter}
        endFilter={endFilter}
        onEndFilterChange={setEndFilter}
        jamsFilter={jamsFilter}
        onJamsFilterChange={setJamsFilter}
        advantageFilter={advantageFilter}
        onAdvantageFilterChange={setAdvantageFilter}
        distanceFilter={distanceFilter}
        onDistanceFilterChange={setDistanceFilter}
        shortageFilter={shortageFilter}
        onShortageFilterChange={setShortageFilter}
        activeCampaignId={activeCampaignId}
        totalTripsCount={trips.length}
        filteredTripsCount={filteredTrips.length}
        hasJamsInCampaign={trips.some(t => getTripSurgeInfo(t).isSurge)}
        hasShortageInCampaign={Boolean((displayedCampaign?.yangoShortageCount && displayedCampaign.yangoShortageCount > 0) || trips.some(t => t.yangoUnavailable))}
        onResetFilters={handleResetTripFilters}
        onOpenRecommendations={() => setIsRecommendationsOpen(true)}
      />

      <PricingResultsTable
        trips={filteredTrips}
        isLoading={isLoadingTrips}
        cityName={currentCity.name}
        isPricingRunning={displayedCampaign?.status === 'in_progress'}
        campaign={displayedCampaign || undefined}
        onInspectTrip={setInspectedTrip}
      />

      {inspectedTrip && (
        <YangoResponseInspectorModal trip={inspectedTrip} onClose={() => setInspectedTrip(null)} />
      )}

      {/* Modal Recommandations Hero Cab */}
      <PricingRecommendationModal
        isOpen={isRecommendationsOpen}
        onClose={() => setIsRecommendationsOpen(false)}
        trips={isTripFiltered ? filteredTrips : trips}
        cityName={currentCity.name}
      />
    </div>
  );
};
