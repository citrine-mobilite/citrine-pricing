import React, { useState, useEffect, useMemo } from 'react';
import { City, Neighborhood, PricingCampaign, TripResult } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CAMEROON_SLOTS } from '../data/seedData';
import { DataTable, Column } from './DataTable';
import { YangoResponseInspectorModal } from './YangoResponseInspectorModal';
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
  ChevronDown
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
}

export const PricingUnifiedView: React.FC<PricingUnifiedViewProps> = ({
  cities,
  neighborhoods,
  selectedCityId,
  onSelectCityId,
  selectedCampaignId: propSelectedCampaignId,
  onSelectCampaignId,
  campaigns,
  onCampaignStarted
}) => {
  const { user } = useAuth();

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

  // Keep internal state in sync with parent prop or available campaigns
  useEffect(() => {
    if (propSelectedCampaignId && campaigns.some((c) => c.id === propSelectedCampaignId)) {
      setInternalCampaignId(propSelectedCampaignId);
    } else if (!campaigns.some((c) => c.id === internalCampaignId)) {
      const nextId = cityCampaigns[0]?.id || campaigns[0]?.id || '';
      setInternalCampaignId(nextId);
      if (onSelectCampaignId && nextId) {
        onSelectCampaignId(nextId);
      }
    }
  }, [propSelectedCampaignId, campaigns, cityCampaigns, internalCampaignId, onSelectCampaignId]);

  const activeCampaignId = internalCampaignId;

  // Active campaign object
  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId);

  // Sync selectedCityId if activeCampaign has a different city
  useEffect(() => {
    if (activeCampaign && activeCampaign.cityId !== selectedCityId) {
      onSelectCityId(activeCampaign.cityId);
    }
  }, [activeCampaign, selectedCityId, onSelectCityId]);

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

  // Current selected city
  const currentCity = cities.find((c) => c.id === selectedCityId) || cities[0];

  // Active neighborhoods in selected city
  const cityActiveNeighborhoods = useMemo(
    () => neighborhoods.filter((n) => n.cityId === currentCity?.id && n.active),
    [neighborhoods, currentCity?.id]
  );

  const totalCombinations =
    cityActiveNeighborhoods.length > 1
      ? cityActiveNeighborhoods.length * (cityActiveNeighborhoods.length - 1)
      : 0;

  // Time slot
  const [selectedSlot, setSelectedSlot] = useState<string>('now');

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
    const fetchTrips = () => {
      api
        .getCampaignResults(activeCampaignId)
        .then((data) => {
          if (isMounted) setTrips(data);
        })
        .catch((err) => console.error('Error loading trips:', err));
    };

    setIsLoadingTrips(true);
    fetchTrips();
    setIsLoadingTrips(false);

    // Polling actif toutes les 2 secondes si la campagne est en cours d'exécution
    const activeCamp = campaigns.find(c => c.id === activeCampaignId);
    let intervalId: any = null;
    if (activeCamp?.status === 'in_progress') {
      intervalId = setInterval(() => {
        fetchTrips();
      }, 2000);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeCampaignId, campaigns]);

  // Launch pricing handler (executes Yango and Hero in parallel)
  const handleLaunch = async (overrideLimit: number | 'all') => {
    if (totalCombinations === 0) {
      setLaunchError(
        'Il faut au minimum 2 quartiers actifs dans cette ville pour générer des combinaisons.'
      );
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
        onCampaignStarted(result.campaign.id);
        handleCampaignChange(result.campaign.id);
      }
    } catch (err: any) {
      setLaunchError(err.message || 'Erreur lors du lancement du pricing en parallèle.');
    } finally {
      setLaunchingTarget(null);
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
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Tarification & Benchmark Multi-Classes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Collecte simultanée des prix <strong>Yango</strong> (4 classes) et <strong>Hero Cab</strong> (2 classes) pour {currentCity.name}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowSingleTester(!showSingleTester)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-slate-500" />
            <span>{showSingleTester ? 'Masquer test direct' : 'Tester un trajet'}</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Setup & Execution Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Controls: City, Slot, Sample Count */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* City Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCityId}
                onChange={(e) => onSelectCityId(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time slot */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="now">Instantané (Maintenant)</option>
                {CAMEROON_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    Créneau {slot}
                  </option>
                ))}
              </select>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-6 w-px bg-slate-200" />

            {/* Choix d'exécution : 2 options exclusives (Test 25 trajets OU Campagne Complète) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                key="25"
                onClick={() => setSampleChoice('25')}
                className={`px-3 py-1 font-medium rounded-md transition cursor-pointer whitespace-nowrap ${
                  sampleChoice === '25'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Test Rapide (25 trajets)
              </button>
              <button
                key="all"
                onClick={() => setSampleChoice('all')}
                className={`px-3 py-1 font-medium rounded-md transition cursor-pointer whitespace-nowrap ${
                  sampleChoice === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Campagne Complète ({totalCombinations.toLocaleString('fr-FR')} trajets)
              </button>
            </div>

          </div>

          {/* Execution Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Button 1: Test sample (25) */}
            <button
              onClick={() => handleLaunch(25)}
              disabled={launchingTarget !== null || totalCombinations === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 shadow-2xs transition disabled:opacity-40 cursor-pointer"
              title="Lancer un test rapide sur un échantillon de 25 trajets"
            >
              {launchingTarget === '25' ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{launchingTarget === '25' ? 'Lancement test (25)...' : 'Test Rapide (25 trajets)'}</span>
            </button>

            {/* Button 2: Launch for ALL combinations */}
            <button
              onClick={() => handleLaunch('all')}
              disabled={launchingTarget !== null || totalCombinations === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#183F3B] shadow-2xs transition disabled:opacity-40 cursor-pointer"
              title={`Lancer la tarification complète sur l'ensemble des ${totalCombinations.toLocaleString('fr-FR')} combinaisons de ${currentCity.name}`}
            >
              {launchingTarget === 'all' ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>
                {launchingTarget === 'all'
                  ? 'Collecte en cours (TOUT)...'
                  : `Lancer pour TOUS (${totalCombinations.toLocaleString('fr-FR')} trajets)`}
              </span>
            </button>
          </div>

        </div>

        {launchError && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
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
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-xs font-semibold text-slate-900">Yango (4 Classes)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{stats.yango.eco.count} trajets</span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-3 text-center">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Éco</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {stats.yango.eco.avg > 0 ? `${stats.yango.eco.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Confort</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {stats.yango.confort.avg > 0 ? `${stats.yango.confort.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Confort+</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {stats.yango.confortPlus.avg > 0 ? `${stats.yango.confortPlus.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Moto</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {stats.yango.moto.avg > 0 ? `${stats.yango.moto.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Hero Cab 2 Classes Overview */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <span className="text-xs font-semibold text-slate-900">Hero Cab (2 Classes)</span>
            </div>
            <span className="text-[11px] text-teal-700 font-medium">
              {stats.heroWins > 0 ? `${stats.heroWins} fois moins cher` : 'Tarifs relevés'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 text-center">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Éco (Standard)</div>
              <div className="text-sm font-bold text-teal-800 mt-0.5">
                {stats.hero.eco.avg > 0 ? `${stats.hero.eco.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Confort (Berline)</div>
              <div className="text-sm font-bold text-teal-800 mt-0.5">
                {stats.hero.confort.avg > 0 ? `${stats.hero.confort.avg.toLocaleString('fr-FR')} F` : '—'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 5. Active Campaign Banner & Selection Tabs */}
      <div className="space-y-3">
        
        {/* Campaign Banner Header */}
        {activeCampaign ? (
          <div className="bg-[#1F4F4A]/5 border border-[#3D8B85]/20 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {activeCampaign.isTestSample ? (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100/90 px-2.5 py-1 rounded-md border border-amber-300/80">
                    ⚡ Test Rapide ({activeCampaign.totalPairs} trajets)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-[#1F4F4A] bg-[#3D8B85]/15 px-2.5 py-1 rounded-md border border-[#3D8B85]/30">
                    🚀 Campagne Globale ({activeCampaign.totalPairs.toLocaleString('fr-FR')} trajets)
                  </span>
                )}
                <span className="font-bold text-slate-900 text-sm">{activeCampaign.cityName}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600 font-mono">
                  {new Date(activeCampaign.startedAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Affichage exclusif des {trips.length} relevés de la campagne{' '}
                <strong className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{activeCampaign.id}</strong>{' '}
                déclenchée par {activeCampaign.triggeredByUserName || 'Système'}.
              </p>
            </div>

            {/* Direct Quick Switch Pills between campaigns of this city */}
            {cityCampaigns.length > 1 && (
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200/90 shrink-0 self-start md:self-auto overflow-x-auto">
                {cityCampaigns.map((c) => {
                  const isActive = c.id === activeCampaignId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleCampaignChange(c.id)}
                      className={`px-3 py-1.5 text-xs rounded-md font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-[#1F4F4A] text-white font-semibold shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span>{c.isTestSample ? '⚡ Test' : '🚀 Globale'}</span>
                      <span className="text-[10px] opacity-80 font-mono">
                        ({new Date(c.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800">
            Aucune campagne sélectionnée. Veuillez en choisir une ou lancer un pricing ci-dessus.
          </div>
        )}

        {/* Sub-bar: Campaign picker, View Mode Switcher, and Neighborhood Filters */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          
          {/* Row 1: Campaign Selector & View Mode Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            
            {/* Campaign Select */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Campagne :
              </label>
              <select
                value={activeCampaignId}
                onChange={(e) => handleCampaignChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3D8B85]/30 focus:border-[#3D8B85] cursor-pointer w-full sm:w-auto max-w-full sm:max-w-md"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.isTestSample ? '⚡ TEST RAPIDE' : '🚀 CAMPAGNE GLOBALE'} • {c.cityName} ({c.completedPairs} trajets) - {new Date(c.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </option>
                ))}
              </select>
            </div>

            {/* Segmented Mode Switcher */}
            <div className="flex items-center bg-slate-100/90 p-1 rounded-lg text-xs overflow-x-auto max-w-full">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 font-medium rounded-md transition whitespace-nowrap cursor-pointer ${
                  viewMode === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vue Complète (6 classes)
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

          {/* Row 2: Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Filtrer les trajets :</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 w-full sm:w-48">
                <span className="text-[11px] text-slate-400 shrink-0">Départ :</span>
                <select
                  value={startFilter}
                  onChange={(e) => setStartFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer w-full"
                >
                  <option value="">Tous</option>
                  {neighborhoodNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 w-full sm:w-48">
                <span className="text-[11px] text-slate-400 shrink-0">Arrivée :</span>
                <select
                  value={endFilter}
                  onChange={(e) => setEndFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer w-full"
                >
                  <option value="">Tous</option>
                  {neighborhoodNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
