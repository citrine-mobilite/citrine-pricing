import React, { useState, useEffect, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';
import { City, Neighborhood, PricingCampaign, TripResult } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from './DataTable';
import { YangoResponseInspectorModal } from './YangoResponseInspectorModal';
import { INITIAL_CITIES } from '../data/seedData';
import {
  Play,
  RotateCw,
  Building2,
  Clock,
  ArrowRight,
  AlertCircle,
  Code,
  Zap,
  Award,
  Layers,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  StopCircle,
  Activity,
  CheckCircle2,
  Check
} from 'lucide-react';

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

  // Active city campaigns
  const cityCampaigns = useMemo(
    () => campaigns.filter((c) => c.cityId === selectedCityId),
    [campaigns, selectedCityId]
  );

  // Determine active campaign ID
  const [internalCampaignId, setInternalCampaignId] = useState<string>(() => {
    if (propSelectedCampaignId && campaigns.some((c) => c.id === propSelectedCampaignId)) {
      return propSelectedCampaignId;
    }
    return cityCampaigns[0]?.id || campaigns[0]?.id || '';
  });

  // Keep internal state in sync with parent prop or available campaigns for current city
  useEffect(() => {
    if (propSelectedCampaignId) {
      setInternalCampaignId(propSelectedCampaignId);
    } else {
      const activeForCity = campaigns.filter(c => c.cityId === selectedCityId);
      if (activeForCity.length > 0) {
        if (!activeForCity.some(c => c.id === internalCampaignId)) {
          setInternalCampaignId(activeForCity[0].id);
        }
      }
    }
  }, [propSelectedCampaignId, campaigns, selectedCityId, internalCampaignId]);

  const activeCampaignId = internalCampaignId;

  // Active campaign object
  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId);

  const handleCampaignChange = (newCampaignId: string) => {
    setInternalCampaignId(newCampaignId);
    if (onSelectCampaignId) {
      onSelectCampaignId(newCampaignId);
    }
    const targetCamp = campaigns.find((c) => c.id === newCampaignId);
    if (targetCamp && targetCamp.cityId !== selectedCityId) {
      onSelectCityId(targetCamp.cityId);
    }
  };

  // Current selected city with resilient fallback
  const fallbackCity: City = INITIAL_CITIES[0] || {
    id: 'city_douala',
    name: 'Douala',
    country: 'Cameroun',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    active: true,
    center: { lat: 4.0511, lng: 9.7679 },
    autoSchedule: { enabled: false, slots: [] }
  };
  const currentCity = cities.find((c) => c.id === selectedCityId) || cities[0] || fallbackCity;

  // Active neighborhoods in selected city
  const cityActiveNeighborhoods = useMemo(
    () => neighborhoods.filter((n) => n.cityId === currentCity?.id && n.active),
    [neighborhoods, currentCity?.id]
  );

  const totalCombinations =
    cityActiveNeighborhoods.length > 1
      ? cityActiveNeighborhoods.length * (cityActiveNeighborhoods.length - 1)
      : 0;

  // Sample Size Selector : Soit Test Rapide (25 trajets) soit Campagne Complète (tous les trajets)
  const [sampleChoice, setSampleChoice] = useState<'25' | 'all'>('25');

  // View mode tab
  const [viewMode, setViewMode] = useState<'all' | 'yango' | 'hero' | 'eco_compare' | 'confort_compare'>('all');

  // Inspector Modal State
  const [inspectedTrip, setInspectedTrip] = useState<TripResult | null>(null);

  // Single Route Quick Test Drawer/Box
  const [showSingleTester, setShowSingleTester] = useState<boolean>(false);
  const [quickOriginId, setQuickOriginId] = useState<string>(cityActiveNeighborhoods[0]?.id || '');
  const [quickDestId, setQuickDestId] = useState<string>(cityActiveNeighborhoods[1]?.id || '');
  const [isQuickTesting, setIsQuickTesting] = useState<boolean>(false);
  const [quickTestResult, setQuickTestResult] = useState<any>(null);

  // Launch State (dédié par bouton : '25' ou 'all')
  const [launchingTarget, setLaunchingTarget] = useState<'25' | 'all' | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Table Data State
  const [trips, setTrips] = useState<TripResult[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);

  // Filter state for table
  const [startFilter, setStartFilter] = useState('');
  const [endFilter, setEndFilter] = useState('');

  // Effective count of pairs to run
  const effectiveSampleCount =
    sampleChoice === 'all'
      ? totalCombinations
      : Math.min(totalCombinations, parseInt(sampleChoice, 10));

  // Keep quick test origin/dest up to date
  useEffect(() => {
    if (cityActiveNeighborhoods.length >= 2) {
      if (!cityActiveNeighborhoods.some((n) => n.id === quickOriginId)) {
        setQuickOriginId(cityActiveNeighborhoods[0].id);
      }
      if (!cityActiveNeighborhoods.some((n) => n.id === quickDestId)) {
        setQuickDestId(cityActiveNeighborhoods[1].id);
      }
    }
  }, [cityActiveNeighborhoods, quickOriginId, quickDestId]);

  // Load trips when activeCampaignId changes & live poll when campaign is in_progress
  useEffect(() => {
    if (!activeCampaignId) {
      setTrips([]);
      return;
    }

    let isMounted = true;
    const fetchTrips = (isInitial = false) => {
      api
        .getCampaignResults(activeCampaignId)
        .then((data) => {
          if (!isMounted) return;
          if (isInitial) {
            setTrips(data || []);
          } else {
            setTrips((prevTrips) => {
              if (!data || data.length === 0) return prevTrips;
              const prevIds = new Set(prevTrips.map((t) => t.id));
              const newItems = data.filter((t) => !prevIds.has(t.id));

              if (newItems.length === 0) {
                return prevTrips; // Conservé à l'identique : Aucun re-render React du tableau
              }

              // Ajout incrémental au sommet du tableau sans réinitialiser l'existant
              return [...newItems, ...prevTrips];
            });
          }
          setIsLoadingTrips(false);
        })
        .catch((err) => {
          console.error('Error loading trips:', err);
          if (isMounted) setIsLoadingTrips(false);
        });
    };

    setIsLoadingTrips(true);
    fetchTrips(true);

    // Polling actif toutes les 400ms si la campagne est en cours d'exécution
    const activeCamp = campaigns.find(c => c.id === activeCampaignId);
    let intervalId: any = null;
    if (activeCamp?.status === 'in_progress') {
      intervalId = setInterval(() => {
        fetchTrips(false);
      }, 400);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeCampaignId, campaigns]);

  // Track status transitions to display SweetAlert2 on completion or failure
  const prevCampaignStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!activeCampaignId) return;
    const currentCamp = campaigns.find((c) => c.id === activeCampaignId);
    if (!currentCamp) return;

    const prevStatus = prevCampaignStatusRef.current[activeCampaignId];
    const currentStatus = currentCamp.status;
    prevCampaignStatusRef.current[activeCampaignId] = currentStatus;

    // Transition from in_progress to completed or failed
    if (prevStatus === 'in_progress' && (currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'cancelled')) {
      if (onRefresh) onRefresh();
      if (currentStatus === 'completed') {
        Swal.fire({
          icon: 'success',
          title: 'Tarification terminée avec succès !',
          html: `
            <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #1e293b;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                <p style="margin: 0; font-weight: 700; color: #166534;">✅ Collecte comparative terminée</p>
              </div>
              <p style="margin-bottom: 5px;"><strong>Ville :</strong> ${currentCamp.cityName}</p>
              <p style="margin-bottom: 5px;"><strong>Trajets analysés :</strong> ${currentCamp.completedPairs} / ${currentCamp.totalPairs}</p>
              <p style="margin-bottom: 5px;"><strong>Prix moyen Yango :</strong> ${(currentCamp.avgPrice || 0).toLocaleString('fr-FR')} FCFA</p>
              <p style="margin-bottom: 5px;"><strong>Prix moyen HERO Cab :</strong> ${(currentCamp.heroStats?.avgPrice || 0).toLocaleString('fr-FR')} FCFA</p>
              <p style="margin-bottom: 5px;"><strong>Chauffeurs HERO dispos :</strong> ${currentCamp.heroStats?.avgDriversCount || 0} par secteur</p>
              <p style="margin-bottom: 0;"><strong>Temps d'exécution :</strong> ${currentCamp.durationSeconds || 1} seconde(s)</p>
            </div>
          `,
          confirmButtonColor: '#1F4F4A',
          confirmButtonText: 'Consulter les résultats'
        });
      } else if (currentStatus === 'failed') {
        Swal.fire({
          icon: 'error',
          title: 'Échec de la tarification',
          html: `
            <div style="text-align: left; font-size: 13px; line-height: 1.5; color: #1e293b;">
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                <p style="margin: 0; font-weight: 700; color: #991b1b;">❌ La tarification a échoué</p>
              </div>
              <p style="margin-bottom: 8px;"><strong>Cause :</strong> ${(currentCamp as any).errorMessage || currentCamp.lastError || 'Impossible de joindre les serveurs de tarification ou données introuvables.'}</p>
              <p style="margin-bottom: 0; color: #64748b; font-size: 12px;">Vérifiez vos paramètres API ou les coordonnées des quartiers.</p>
            </div>
          `,
          confirmButtonColor: '#DC2626',
          confirmButtonText: 'Compris'
        });
      }
    }
  }, [campaigns, activeCampaignId]);

  // Launch pricing handler (executes Yango and Hero in parallel)
  const handleLaunch = async (overrideLimit: number | 'all') => {
    if (totalCombinations === 0) {
      setLaunchError(
        'Il faut au minimum 2 quartiers actifs dans cette ville pour générer des combinaisons.'
      );
      Swal.fire({
        icon: 'warning',
        title: 'Quartiers insuffisants',
        text: 'Il faut au minimum 2 quartiers actifs dans cette ville pour générer des combinaisons.',
        confirmButtonColor: '#1F4F4A'
      });
      return;
    }

    const targetKey = overrideLimit === 'all' ? 'all' : '25';
    setLaunchingTarget(targetKey);
    setLaunchError(null);
    setSampleChoice(targetKey);

    try {
      const result = await api.startCampaign({
        cityId: currentCity.id,
        triggerType: 'manual',
        triggeredByUserId: user?.id || 'manual_user',
        triggeredByUserName: user?.name || user?.email || 'Opérateur',
        selectedClasses: ['econom'],
        sampleLimit: overrideLimit
      });

      if (result && result.campaign) {
        // Enregistrer le statut initial pour la détection
        prevCampaignStatusRef.current[result.campaign.id] = 'in_progress';
        onCampaignStarted(result.campaign.id);
        handleCampaignChange(result.campaign.id);
      }
    } catch (err: any) {
      const msg = err.message || 'Erreur lors du lancement du pricing en parallèle.';
      setLaunchError(msg);
      Swal.fire({
        icon: 'error',
        title: 'Erreur au démarrage',
        text: msg,
        confirmButtonColor: '#DC2626'
      });
    } finally {
      setLaunchingTarget(null);
    }
  };

  const handleCancelCampaign = async (campaignIdToCancel?: string) => {
    const targetId = campaignIdToCancel || activeCampaignId;
    if (!targetId) return;
    setIsCancelling(true);
    try {
      await api.cancelCampaign(targetId);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Erreur lors de l’interruption:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  // Quick single route test execution (Yango & Hero Cab in parallel)
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
        tariffClass: 'econom',
        cityCurrency: currentCity.currency
      });

      setQuickTestResult(res);

      const tempTrip: TripResult = {
        id: `test_quick_${Date.now()}`,
        campaignId: 'quick_test',
        cityId: currentCity.id,
        cityName: currentCity.name,
        startNeighborhoodId: origin.id,
        startNeighborhoodName: origin.name,
        startCoordinates: [origin.lat, origin.lng],
        endNeighborhoodId: dest.id,
        endNeighborhoodName: dest.name,
        endCoordinates: [dest.lat, dest.lng],
        distanceMeters: res.distanceMeters,
        distanceKm: res.distanceKm,
        durationSeconds: res.durationSeconds,
        durationMinutes: res.durationMinutes,
        tariffClass: 'econom',
        price: res.price,
        priceFormatted: res.priceFormatted,
        currency: currentCity.currency,
        pricePerKm: res.pricePerKm,
        waitingTimeMinutes: res.waitingTimeMinutes,

        classes: res.classes,
        availableClasses: res.availableClasses,
        priceEconom: res.priceEconom || res.yango?.priceEconom,
        priceConfort: res.priceConfort || res.yango?.priceConfort,
        priceConfortPlus: res.priceConfortPlus || res.yango?.priceConfortPlus,
        priceMoto: res.priceMoto || res.yango?.priceMoto,

        heroQuote: res.hero || res.heroQuote,
        priceHero: res.priceHero || res.hero?.price,
        priceHeroStandard: res.priceHeroStandard || res.hero?.priceStandard,
        priceHeroConfort: res.priceHeroConfort || res.hero?.priceConfort,
        heroDriversCount: res.heroDriversCount || res.hero?.availableDriversCount,
        heroClosestDriverDistanceKm: res.heroClosestDriverDistanceKm || res.hero?.closestDriverDistanceKm,
        deltaPriceYangoVsHero: res.deltaPriceYangoVsHero,
        cheaperProvider: res.cheaperProvider,

        source: res.source,
        status: 'success',
        rawResponse: res.rawResponse,
        requestPayload: res.requestPayload,
        httpStatus: res.httpStatus,
        apiCallDetails: {
          endpoint: 'Yango & Hero Cab APIs (Parallèle)',
          sentAt: new Date().toISOString(),
          latencyMs: res.latencyMs,
          httpStatus: res.httpStatus,
          requestBody: res.requestPayload,
          rawResponseBody: res.rawResponse,
          source: res.source
        }
      };
      setInspectedTrip(tempTrip);
      setTrips((prev) => [tempTrip, ...prev.filter((t) => t.id !== tempTrip.id)]);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du test direct.');
    } finally {
      setIsQuickTesting(false);
    }
  };

  // Statistics calculation
  const stats = useMemo(() => {
    const yEco: number[] = [];
    const yConf: number[] = [];
    const yConfPlus: number[] = [];
    const yMoto: number[] = [];
    const hEco: number[] = [];
    const hConf: number[] = [];
    let yangoWins = 0;
    let heroWins = 0;

    trips.forEach((t) => {
      const pYE = t.priceEconom || t.classes?.econom?.price || (t.tariffClass === 'econom' ? t.price : 0);
      const pYC = t.priceConfort || t.classes?.business?.price || t.classes?.comfort?.price || 0;
      const pYCP = t.priceConfortPlus || t.classes?.comfortplus?.price || 0;
      const pYM = t.priceMoto || t.classes?.moto?.price || 0;

      const pHE = t.priceHeroStandard || t.heroQuote?.priceStandard || t.priceHero || 0;
      const pHC = t.priceHeroConfort || t.heroQuote?.priceConfort || 0;

      if (pYE > 0) yEco.push(pYE);
      if (pYC > 0) yConf.push(pYC);
      if (pYCP > 0) yConfPlus.push(pYCP);
      if (pYM > 0) yMoto.push(pYM);

      if (pHE > 0) hEco.push(pHE);
      if (pHC > 0) hConf.push(pHC);

      if (t.cheaperProvider === 'hero') heroWins++;
      else if (t.cheaperProvider === 'yango') yangoWins++;
    });

    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    const min = (arr: number[]) => (arr.length ? Math.min(...arr) : 0);

    return {
      yango: {
        eco: { avg: avg(yEco), min: min(yEco), count: yEco.length },
        confort: { avg: avg(yConf), min: min(yConf), count: yConf.length },
        confortPlus: { avg: avg(yConfPlus), min: min(yConfPlus), count: yConfPlus.length },
        moto: { avg: avg(yMoto), min: min(yMoto), count: yMoto.length }
      },
      hero: {
        eco: { avg: avg(hEco), min: min(hEco), count: hEco.length },
        confort: { avg: avg(hConf), min: min(hConf), count: hConf.length }
      },
      yangoWins,
      heroWins,
      totalTrips: trips.length
    };
  }, [trips]);

  // Distinct neighborhood names for filter dropdowns
  const neighborhoodNames = useMemo(() => {
    return Array.from(new Set(cityActiveNeighborhoods.map((n) => n.name))).sort();
  }, [cityActiveNeighborhoods]);

  // Filtered trips
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (startFilter && t.startNeighborhoodName !== startFilter) return false;
      if (endFilter && t.endNeighborhoodName !== endFilter) return false;
      return true;
    });
  }, [trips, startFilter, endFilter]);

  // Price cell helper
  const renderCellPrice = (price: number | null | undefined, accent?: 'yango' | 'hero') => {
    if (!price || price <= 0 || isNaN(price)) {
      return <span className="text-slate-300 font-mono text-[11px]">—</span>;
    }
    const color = accent === 'hero' ? 'text-teal-700 font-bold' : 'text-slate-900 font-bold';
    return (
      <span className={`font-mono text-xs ${color}`}>
        {price.toLocaleString('fr-FR')} <span className="text-[10px] text-slate-400 font-normal">F</span>
      </span>
    );
  };

  // Dynamic Table Columns
  const columns: Column<TripResult>[] = useMemo(() => {
    const baseCols: Column<TripResult>[] = [
      {
        key: 'startNeighborhoodName',
        label: 'Départ',
        sortable: true,
        render: (t) => <span className="font-medium text-slate-900">{t.startNeighborhoodName}</span>
      },
      {
        key: 'endNeighborhoodName',
        label: 'Destination',
        sortable: true,
        render: (t) => <span className="font-medium text-slate-900">{t.endNeighborhoodName}</span>
      },
      {
        key: 'distanceKm',
        label: 'Dist.',
        sortable: true,
        align: 'right',
        render: (t) => <span className="font-mono text-slate-500 text-xs">{t.distanceKm} km</span>,
        exportValue: (t) => `${t.distanceKm} km`
      }
    ];

    if (viewMode === 'all') {
      return [
        ...baseCols,
        {
          key: 'priceEconom',
          label: 'Y. Éco',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceEconom || t.classes?.econom?.price || (t.tariffClass === 'econom' ? t.price : null)),
          exportValue: (t) => `${t.priceEconom || t.classes?.econom?.price || t.price || 'Non disponible'}`
        },
        {
          key: 'priceConfort',
          label: 'Y. Confort',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceConfort || t.classes?.business?.price || t.classes?.comfort?.price),
          exportValue: (t) => `${t.priceConfort || 'Non disponible'}`
        },
        {
          key: 'priceConfortPlus',
          label: 'Y. Confort+',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceConfortPlus || t.classes?.comfortplus?.price),
          exportValue: (t) => `${t.priceConfortPlus || 'Non disponible'}`
        },
        {
          key: 'priceMoto',
          label: 'Y. Moto',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceMoto || t.classes?.moto?.price),
          exportValue: (t) => `${t.priceMoto || 'Non disponible'}`
        },
        {
          key: 'priceHeroStandard',
          label: 'H. De Base',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceHeroStandard || t.heroQuote?.priceStandard || t.priceHero, 'hero'),
          exportValue: (t) => `${t.priceHeroStandard || t.priceHero || 'Non disponible'}`
        },
        {
          key: 'priceHeroConfort',
          label: 'H. Luxueux',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceHeroConfort || t.heroQuote?.priceConfort, 'hero'),
          exportValue: (t) => `${t.priceHeroConfort || 'Non disponible'}`
        },
        {
          key: 'cheaperProvider',
          label: 'Meilleur Prix',
          sortable: true,
          align: 'center',
          render: (t) => {
            const pY = t.priceEconom || t.price || 0;
            const pH = t.priceHeroStandard || t.priceHero || 0;
            if (pY <= 0 || pH <= 0) return <span className="text-slate-300">—</span>;
            const delta = Math.abs(pY - pH);
            if (pH < pY) {
              return <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Hero (-{delta} F)</span>;
            }
            if (pY < pH) {
              return <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">Yango (-{delta} F)</span>;
            }
            return <span className="text-[11px] text-slate-400">Égalité</span>;
          }
        },
        {
          key: 'source',
          label: 'Détails',
          align: 'center',
          render: (t) => (
            <button
              onClick={() => setInspectedTrip(t)}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
              title="Voir réponses JSON"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )
        }
      ];
    }

    if (viewMode === 'yango') {
      return [
        ...baseCols,
        {
          key: 'priceEconom',
          label: 'Éco (Standard)',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceEconom || t.classes?.econom?.price)
        },
        {
          key: 'priceConfort',
          label: 'Confort (Berline)',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceConfort || t.classes?.business?.price)
        },
        {
          key: 'priceConfortPlus',
          label: 'Confort+ (Premium)',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceConfortPlus || t.classes?.comfortplus?.price)
        },
        {
          key: 'priceMoto',
          label: 'Moto (Deux-roues)',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceMoto || t.classes?.moto?.price)
        },
        {
          key: 'durationMinutes',
          label: 'Durée',
          sortable: true,
          align: 'right',
          render: (t) => <span className="font-mono text-slate-500 text-xs">{t.durationMinutes} min</span>
        },
        {
          key: 'source',
          label: 'JSON',
          align: 'center',
          render: (t) => (
            <button
              onClick={() => setInspectedTrip(t)}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )
        }
      ];
    }

    if (viewMode === 'eco_compare') {
      return [
        ...baseCols,
        {
          key: 'priceEconom',
          label: 'Yango Éco',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceEconom || t.classes?.econom?.price)
        },
        {
          key: 'priceHeroStandard',
          label: 'Hero Cab Éco',
          sortable: true,
          align: 'right',
          render: (t) => renderCellPrice(t.priceHeroStandard || t.heroQuote?.priceStandard || t.priceHero, 'hero')
        },
        {
          key: 'deltaPriceYangoVsHero',
          label: 'Écart (Yango - Hero)',
          sortable: true,
          align: 'right',
          render: (t) => {
            const delta = t.deltaPriceYangoVsHero ?? ((t.priceEconom || t.price || 0) - (t.priceHeroStandard || t.priceHero || 0));
            const color = delta > 0 ? 'text-teal-700 font-semibold' : (delta < 0 ? 'text-rose-700 font-semibold' : 'text-slate-400');
            const sign = delta > 0 ? `+${delta}` : `${delta}`;
            return <span className={`font-mono text-xs ${color}`}>{sign} F</span>;
          }
        },
        {
          key: 'cheaperProvider',
          label: 'Meilleur Tarif',
          sortable: true,
          align: 'center',
          render: (t) => {
            if (t.cheaperProvider === 'hero') return <span className="font-semibold text-teal-700 text-xs">Hero Cab</span>;
            if (t.cheaperProvider === 'yango') return <span className="font-semibold text-rose-700 text-xs">Yango</span>;
            return <span className="text-slate-400 text-xs">Égalité</span>;
          }
        },
        {
          key: 'source',
          label: 'Détails',
          align: 'center',
          render: (t) => (
            <button
              onClick={() => setInspectedTrip(t)}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )
        }
      ];
    }

    // Default: Confort compare / Hero
    return [
      ...baseCols,
      {
        key: 'priceConfort',
        label: 'Yango Confort',
        sortable: true,
        align: 'right',
        render: (t) => renderCellPrice(t.priceConfort || t.classes?.business?.price)
      },
      {
        key: 'priceHeroConfort',
        label: 'Hero Cab Confort',
        sortable: true,
        align: 'right',
        render: (t) => renderCellPrice(t.priceHeroConfort || t.heroQuote?.priceConfort, 'hero')
      },
      {
        key: 'source',
        label: 'Détails',
        align: 'center',
        render: (t) => (
          <button
            onClick={() => setInspectedTrip(t)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        )
      }
    ];
  }, [viewMode]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* 1. Header & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Tarification & Benchmark Multi-Classes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Analyse comparative des tarifs de transport urbain pour {currentCity?.name || 'Douala'}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowSingleTester(!showSingleTester)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer ${
              showSingleTester
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-xs'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${showSingleTester ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>{showSingleTester ? 'Masquer le test direct' : 'Tester un trajet direct'}</span>
          </button>
        </div>
      </div>

      {/* Inactive City Notice */}
      {!currentCity?.active && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300/80 text-amber-900 text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <div className="flex-1">
            <span className="font-bold">Ville désactivée :</span> La ville <strong>{currentCity?.name}</strong> est actuellement inactive. La tarification est verrouillée. Activez cette ville dans l'onglet <strong>Villes</strong> pour lancer des relevés de prix.
          </div>
        </div>
      )}

      {/* 2. Unified Setup & Execution Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Controls: City Selector & Sample Choice Switch */}
          <div className="flex flex-wrap items-center gap-3">
            {/* City Selector */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400 font-medium">Ville :</span>
              <select
                value={selectedCityId}
                onChange={(e) => onSelectCityId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                {(cities.length > 0 ? cities : INITIAL_CITIES).map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name} {!city.active ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Scope info indicator */}
            <div className="text-xs text-slate-500 font-medium hidden sm:block">
              <span>{cityActiveNeighborhoods.length} quartiers actifs</span>
              <span className="mx-1.5 text-slate-300">•</span>
              <span>{totalCombinations.toLocaleString('fr-FR')} paires possibles</span>
            </div>
          </div>

          {/* Explicit Dual Launch Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleLaunch(25)}
              disabled={launchingTarget !== null || !currentCity?.active || totalCombinations === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-800 bg-amber-50 hover:bg-amber-100/80 border border-amber-300/70 shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title={!currentCity?.active ? 'Ville désactivée' : 'Lancer un test sur un échantillon rapide de 25 trajets'}
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Test Rapide (25 trajets)</span>
            </button>

            <button
              onClick={() => handleLaunch('all')}
              disabled={launchingTarget !== null || !currentCity?.active || totalCombinations === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#183F3B] shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title={!currentCity?.active ? 'Ville désactivée' : `Lancer la collecte complète de tous les ${totalCombinations} trajets`}
            >
              {launchingTarget === 'all' ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current text-white" />
              )}
              <span>Campagne Complète ({totalCombinations.toLocaleString('fr-FR')} trajets)</span>
            </button>
          </div>

        </div>

        {/* Live Execution Progress Bar Banner with 24/25 Counter */}
        {(activeCampaign?.status === 'in_progress' || launchingTarget !== null) && (
          <div className="mt-4 pt-4 border-t border-amber-200/80 bg-amber-50/70 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-4 sm:p-5 rounded-b-xl space-y-2.5 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-amber-700 animate-spin" />
                <span className="text-xs font-bold text-slate-900">
                  Collecte des tarifs en direct pour {activeCampaign?.cityName || currentCity.name}
                </span>
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                  Parallèle Yango & Hero
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {Math.max(activeCampaign?.completedPairs || 0, trips.length)} / {activeCampaign?.totalPairs || (sampleChoice === 'all' ? totalCombinations : 25)} destinations pricées ({Math.min(100, Math.round((Math.max(activeCampaign?.completedPairs || 0, trips.length) / (activeCampaign?.totalPairs || (sampleChoice === 'all' ? totalCombinations : 25) || 1)) * 100))}%)
                </span>
                {activeCampaignId && (
                  <button
                    onClick={() => handleCancelCampaign(activeCampaignId)}
                    disabled={isCancelling}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-800 hover:underline cursor-pointer"
                  >
                    Arrêter
                  </button>
                )}
              </div>
            </div>

            {/* Visual Animated Progress Bar */}
            <div className="space-y-1">
              <div className="w-full h-2.5 bg-amber-200/70 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-600 transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (Math.max(activeCampaign?.completedPairs || 0, trips.length) /
                          (activeCampaign?.totalPairs || (sampleChoice === 'all' ? totalCombinations : 25) || 1)) *
                          100
                      )
                    )}%`
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {launchError && (
          <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{launchError}</span>
          </div>
        )}
      </div>

      {/* 3. Instant Single Route Tester (Clean Modal/Drawer) */}
      {showSingleTester && (
        <div className="bg-slate-900 text-white rounded-xl p-5 space-y-4 shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold">Test Direct d'un Trajet (Relevé Parallèle)</h3>
            </div>
            <span className="text-[11px] text-slate-400">Interroge simultanément Yango & Hero Cab</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-[11px] text-slate-300 font-medium mb-1">Départ (Origine)</label>
              <select
                value={quickOriginId}
                onChange={(e) => setQuickOriginId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                {cityActiveNeighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-300 font-medium mb-1">Arrivée (Destination)</label>
              <select
                value={quickDestId}
                onChange={(e) => setQuickDestId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                {cityActiveNeighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunQuickTest}
              disabled={isQuickTesting || quickOriginId === quickDestId}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 transition cursor-pointer"
            >
              {isQuickTesting ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isQuickTesting ? 'Calcul en cours...' : 'Calculer les 6 prix'}</span>
            </button>
          </div>

          {quickTestResult && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Trajet de <strong>{quickTestResult.distanceKm} km</strong> (~{quickTestResult.durationMinutes} min)</span>
                {quickTestResult.cheaperProvider && (
                  <span className="text-emerald-400 font-medium">
                    🏆 {quickTestResult.cheaperProvider === 'hero' ? 'Hero Cab est moins cher en Éco' : (quickTestResult.cheaperProvider === 'yango' ? 'Yango est moins cher en Éco' : 'Tarifs identiques')}
                    {quickTestResult.deltaPriceYangoVsHero ? ` (Écart: ${Math.abs(quickTestResult.deltaPriceYangoVsHero)} F)` : ''}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  <div className="text-[10px] text-slate-400">🔴 Yango Éco</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {quickTestResult.priceEconom ? `${quickTestResult.priceEconom.toLocaleString('fr-FR')} F` : '—'}
                  </div>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  <div className="text-[10px] text-slate-400">🔴 Yango Confort</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {quickTestResult.priceConfort ? `${quickTestResult.priceConfort.toLocaleString('fr-FR')} F` : '—'}
                  </div>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  <div className="text-[10px] text-slate-400">🔴 Yango Confort+</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {quickTestResult.priceConfortPlus ? `${quickTestResult.priceConfortPlus.toLocaleString('fr-FR')} F` : '—'}
                  </div>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  <div className="text-[10px] text-slate-400">🔴 Yango Moto</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {quickTestResult.priceMoto ? `${quickTestResult.priceMoto.toLocaleString('fr-FR')} F` : '—'}
                  </div>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-teal-500/40">
                  <div className="text-[10px] text-teal-300">🔵 Hero Cab Éco</div>
                  <div className="text-sm font-bold text-teal-200 mt-1">
                    {quickTestResult.priceHeroStandard ? `${quickTestResult.priceHeroStandard.toLocaleString('fr-FR')} F` : '—'}
                  </div>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-teal-500/40">
                  <div className="text-[10px] text-teal-300">🔵 Hero Confort</div>
                  <div className="text-sm font-bold text-teal-200 mt-1">
                    {quickTestResult.priceHeroConfort ? `${quickTestResult.priceHeroConfort.toLocaleString('fr-FR')} F` : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Executive Dual-Provider Synthesis Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Yango 4 Classes Overview */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Moyennes Yango (4 Classes)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{stats.yango.eco.count} trajets relevés</span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-4 text-center divide-x divide-slate-100">
            <div className="px-1">
              <div className="text-[11px] text-slate-500 font-medium">Éco</div>
              <div className="text-sm sm:text-base font-bold text-slate-900 mt-1 font-mono">
                {stats.yango.eco.avg > 0 ? `${stats.yango.eco.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
            <div className="px-1">
              <div className="text-[11px] text-slate-500 font-medium">Confort</div>
              <div className="text-sm sm:text-base font-bold text-slate-900 mt-1 font-mono">
                {stats.yango.confort.avg > 0 ? `${stats.yango.confort.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
            <div className="px-1">
              <div className="text-[11px] text-slate-500 font-medium">Confort+</div>
              <div className="text-sm sm:text-base font-bold text-slate-900 mt-1 font-mono">
                {stats.yango.confortPlus.avg > 0 ? `${stats.yango.confortPlus.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
            <div className="px-1">
              <div className="text-[11px] text-slate-500 font-medium">Moto</div>
              <div className="text-sm sm:text-base font-bold text-slate-900 mt-1 font-mono">
                {stats.yango.moto.avg > 0 ? `${stats.yango.moto.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Hero Cab 2 Classes Overview */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1F4F4A] shrink-0" />
              <span className="text-xs font-bold text-[#1F4F4A] uppercase tracking-wide">Moyennes Hero Cab (2 Classes)</span>
            </div>
            <span className="text-[11px] font-semibold text-[#1F4F4A] bg-[#F0FAFA] px-2 py-0.5 rounded border border-[#3D8B85]/20">
              {stats.heroWins > 0 ? `${stats.heroWins} fois plus compétitif` : 'Tarifs relevés'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 text-center divide-x divide-slate-100">
            <div className="px-2">
              <div className="text-[11px] text-slate-500 font-medium">Éco (Standard)</div>
              <div className="text-sm sm:text-base font-bold text-[#1F4F4A] mt-1 font-mono">
                {stats.hero.eco.avg > 0 ? `${stats.hero.eco.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
            <div className="px-2">
              <div className="text-[11px] text-slate-500 font-medium">Confort (Berline)</div>
              <div className="text-sm sm:text-base font-bold text-[#1F4F4A] mt-1 font-mono">
                {stats.hero.confort.avg > 0 ? `${stats.hero.confort.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 5. Active Campaign Banner & Selection Tabs */}
      <div className="space-y-4">
        
        {/* Campaign Banner Header */}
        {activeCampaign ? (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
            
            {/* Top row: Title, status indicator & cancel button */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    {activeCampaign.isTestSample
                      ? `Relevé Test Rapide (${activeCampaign.totalPairs} trajets)`
                      : `Campagne Globale (${activeCampaign.totalPairs.toLocaleString('fr-FR')} trajets)`}
                  </h2>
                  {activeCampaign.status === 'in_progress' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                      <RotateCw className="w-3 h-3 animate-spin text-amber-600" />
                      En cours d'exécution ({trips.length} / {activeCampaign.totalPairs})
                    </span>
                  )}
                  {activeCampaign.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Terminée ({trips.length} relevés)
                    </span>
                  )}
                  {activeCampaign.status === 'cancelled' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                      <StopCircle className="w-3.5 h-3.5 text-rose-600" />
                      Interrompue
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <span className="font-semibold text-slate-800">{activeCampaign.cityName}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>
                    {new Date(activeCampaign.startedAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>Lancé par {activeCampaign.triggeredByUserName || 'Système'}</span>
                </div>
              </div>

              {activeCampaign.status === 'in_progress' && (
                <button
                  onClick={() => handleCancelCampaign(activeCampaign.id)}
                  disabled={isCancelling}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-xs transition cursor-pointer shrink-0"
                  title="Stopper immédiatement toutes les requêtes de cette campagne"
                >
                  <StopCircle className={`w-4 h-4 ${isCancelling ? 'animate-spin' : ''}`} />
                  <span>{isCancelling ? 'Arrêt...' : 'Arrêter immédiatement'}</span>
                </button>
              )}
            </div>

            {/* Visual Live Progress Bar inside Campaign Card */}
            {activeCampaign.status === 'in_progress' && (
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                    <span className="font-bold text-slate-900">
                      Progression de la tarification :
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">
                    {Math.max(activeCampaign.completedPairs || 0, trips.length)} / {activeCampaign.totalPairs} destinations pricées ({Math.min(100, Math.round((Math.max(activeCampaign.completedPairs || 0, trips.length) / (activeCampaign.totalPairs || 1)) * 100))}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-amber-200/70 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-600 transition-all duration-300 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (Math.max(activeCampaign.completedPairs || 0, trips.length) /
                            (activeCampaign.totalPairs || 1)) *
                            100
                        )
                      )}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Bottom row: Campaign Select and View Mode Switcher */}
            <div className="pt-3.5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Campagne active :
                </label>
                <select
                  value={activeCampaignId}
                  onChange={(e) => handleCampaignChange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#3D8B85] cursor-pointer max-w-full sm:max-w-md"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.isTestSample ? '⚡ TEST RAPIDE' : '🚀 GLOBALE'} • {c.cityName} ({c.completedPairs || c.totalPairs} trajets) — {new Date(c.startedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </option>
                  ))}
                </select>
              </div>

              {/* Segmented Mode Switcher */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs self-start lg:self-auto">
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1.5 font-medium rounded-md transition whitespace-nowrap cursor-pointer ${
                    viewMode === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Toutes les classes (6)
                </button>
                <button
                  onClick={() => setViewMode('eco_compare')}
                  className={`px-3 py-1.5 font-medium rounded-md transition whitespace-nowrap cursor-pointer ${
                    viewMode === 'eco_compare'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Comparatif Éco
                </button>
                <button
                  onClick={() => setViewMode('yango')}
                  className={`px-3 py-1.5 font-medium rounded-md transition whitespace-nowrap cursor-pointer ${
                    viewMode === 'yango'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Yango Seul (4 classes)
                </button>
              </div>
            </div>

          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-800">
            Aucune campagne sélectionnée. Veuillez en choisir une ou lancer un pricing ci-dessus.
          </div>
        )}

        {/* Table Filters Sub-bar */}
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Filtrer les trajets :</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 w-full sm:w-48">
              <span className="text-[11px] text-slate-400 shrink-0">Départ :</span>
              <select
                value={startFilter}
                onChange={(e) => setStartFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer w-full"
              >
                <option value="">Tous les quartiers</option>
                {neighborhoodNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 w-full sm:w-48">
              <span className="text-[11px] text-slate-400 shrink-0">Arrivée :</span>
              <select
                value={endFilter}
                onChange={(e) => setEndFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer w-full"
              >
                <option value="">Tous les quartiers</option>
                {neighborhoodNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {(startFilter || endFilter) && (
              <button
                type="button"
                onClick={() => {
                  setStartFilter('');
                  setEndFilter('');
                }}
                className="text-xs text-[#3D8B85] hover:text-[#1F4F4A] font-semibold px-2 py-1 cursor-pointer whitespace-nowrap"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Crisp Data Table */}
        <DataTable
          columns={columns}
          data={filteredTrips}
          searchPlaceholder="Filtrer par quartier..."
          searchKeys={['startNeighborhoodName', 'endNeighborhoodName']}
          exportFileName={`pricing_${currentCity?.name?.toLowerCase() || 'city'}_${activeCampaign?.isTestSample ? 'test' : 'globale'}_${new Date().toISOString().slice(0, 10)}`}
          exportTitle={`Relevé Multi-Classes - ${activeCampaign?.cityName || 'Ville'} (${activeCampaign?.isTestSample ? 'Test Rapide' : 'Campagne Globale'})`}
          exportSubtitle={`${filteredTrips.length} trajets répertoriés`}
          pageSizeOptions={[25, 50, 100, 250, 500]}
          defaultPageSize={25}
          isLoading={isLoadingTrips}
          emptyMessage="Aucun relevé pour cette campagne. Cliquez sur « Lancer la tarification » pour exécuter la collecte en direct."
        />

      </div>

      {/* Inspector Modal */}
      {inspectedTrip && (
        <YangoResponseInspectorModal
          trip={inspectedTrip}
          onClose={() => setInspectedTrip(null)}
        />
      )}

    </div>
  );
};
