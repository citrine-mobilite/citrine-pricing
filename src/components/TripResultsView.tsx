import React, { useEffect, useState, useMemo } from 'react';
import { PricingCampaign, TripResult } from '../types';
import { api } from '../services/api';
import { DataTable, Column } from './DataTable';
import { TripResultsHeader } from './trips/TripResultsHeader';
import { TripMetricsGrid } from './trips/TripMetricsGrid';
import { formatCampaignFileName } from '../utils/exportUtils';
import {
  cleanNeighborhoodName,
  renderCellPrice,
  getYangoPrice,
  getHeroPrice,
  getTripMasterPrice
} from './pricing/pricingUtils';
import {
  PricingResultsFilterBar,
  TripJamsFilter,
  TripAdvantageFilter,
  TripDistanceFilter,
  TripShortageFilter
} from './pricing/PricingResultsFilterBar';

interface TripResultsViewProps {
  campaigns: PricingCampaign[];
  selectedCampaignId: string | null;
  onSelectCampaignId: (id: string) => void;
}

export const TripResultsView: React.FC<TripResultsViewProps> = ({
  campaigns,
  selectedCampaignId,
  onSelectCampaignId
}) => {
  const [trips, setTrips] = useState<TripResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startFilter, setStartFilter] = useState('');
  const [endFilter, setEndFilter] = useState('');
  const [jamsFilter, setJamsFilter] = useState<TripJamsFilter>('all');
  const [advantageFilter, setAdvantageFilter] = useState<TripAdvantageFilter>('all');
  const [distanceFilter, setDistanceFilter] = useState<TripDistanceFilter>('all');
  const [shortageFilter, setShortageFilter] = useState<TripShortageFilter>('all');

  const handleResetFilters = () => {
    setStartFilter('');
    setEndFilter('');
    setJamsFilter('all');
    setAdvantageFilter('all');
    setDistanceFilter('all');
    setShortageFilter('all');
  };

  const currentCampaign =
    campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];

  useEffect(() => {
    if (!currentCampaign) return;
    setIsLoading(true);
    api
      .getCampaignResults(currentCampaign.id)
      .then((data) => setTrips(data || []))
      .catch((err) => console.error('Error fetching trips:', err))
      .finally(() => setIsLoading(false));
  }, [currentCampaign?.id]);

  const neighborhoodNames = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      const orig = cleanNeighborhoodName(t.origin || t.startNeighborhoodName);
      const dest = cleanNeighborhoodName(t.destination || t.endNeighborhoodName);
      if (orig) set.add(orig);
      if (dest) set.add(dest);
    });
    return Array.from(set).sort();
  }, [trips]);

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const orig = cleanNeighborhoodName(t.origin || t.startNeighborhoodName);
      const dest = cleanNeighborhoodName(t.destination || t.endNeighborhoodName);
      if (startFilter && orig !== startFilter && !orig?.includes(startFilter)) return false;
      if (endFilter && dest !== endFilter && !dest?.includes(endFilter)) return false;

      if (jamsFilter === 'with_jams' && !t.jams) return false;
      if (jamsFilter === 'without_jams' && t.jams) return false;

      const yEco = getYangoPrice(t, 'econom');
      const hEco = getHeroPrice(t, 'eco');
      if (advantageFilter === 'hero') {
        if (!hEco || !yEco || hEco >= yEco) return false;
      } else if (advantageFilter === 'yango') {
        if (!hEco || !yEco || yEco >= hEco) return false;
      } else if (advantageFilter === 'equal') {
        if (!hEco || !yEco || hEco !== yEco) return false;
      }

      const dist = t.distanceKm || 0;
      if (distanceFilter === 'short' && dist > 3) return false;
      if (distanceFilter === 'medium' && (dist <= 3 || dist > 7)) return false;
      if (distanceFilter === 'long' && dist <= 7) return false;

      // Tension & Pénurie Yango
      if (shortageFilter === 'shortage' && !t.yangoUnavailable) return false;
      if (shortageFilter === 'available' && t.yangoUnavailable) return false;

      return true;
    });
  }, [trips, startFilter, endFilter, jamsFilter, advantageFilter, distanceFilter, shortageFilter]);

  const normalizedTrips = useMemo(() => {
    return filteredTrips.map((t) => {
      const yEco = getYangoPrice(t, 'econom');
      const yConf = getYangoPrice(t, 'business');
      const hEco = getHeroPrice(t, 'eco');
      const hConf = getHeroPrice(t, 'confort');
      const tmEco = getTripMasterPrice(t, 'eco');
      const tmConf = getTripMasterPrice(t, 'confort');
      const tmMoto = getTripMasterPrice(t, 'moto');

      return {
        ...t,
        yango_eco: yEco ?? undefined,
        yango_confort: yConf ?? undefined,
        hero_eco: hEco ?? undefined,
        hero_confort: hConf ?? undefined,
        tripmaster_eco: tmEco ?? undefined,
        tripmaster_confort: tmConf ?? undefined,
        tripmaster_moto: tmMoto ?? undefined
      };
    });
  }, [filteredTrips]);

  const stats = useMemo(() => {
    if (trips.length === 0) return { min: 0, max: 0, avg: 0, avgKm: 0, maxTrip: null, minTrip: null };
    const prices = trips.map((t) => t.price || getYangoPrice(t, 'econom') || getHeroPrice(t, 'eco') || 0).filter(p => p > 0);
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const avgKm = Number(
      (trips.reduce((a, b) => a + (b.distanceKm || 0), 0) / (trips.length || 1)).toFixed(1)
    );
    const maxTrip = trips.find((t) => (t.price || getYangoPrice(t, 'econom') || 0) === max);
    const minTrip = trips.find((t) => (t.price || getYangoPrice(t, 'econom') || 0) === min);

    return { min, max, avg, avgKm, maxTrip, minTrip };
  }, [trips]);

  const columns: Column<TripResult>[] = useMemo(() => [
    {
      key: 'origin',
      label: 'Départ',
      sortable: true,
      render: (t) => <span className="font-semibold text-slate-900">{cleanNeighborhoodName(t.origin || t.startNeighborhoodName)}</span>,
      exportValue: (t) => cleanNeighborhoodName(t.origin || t.startNeighborhoodName)
    },
    {
      key: 'destination',
      label: 'Destination',
      sortable: true,
      render: (t) => <span className="font-semibold text-slate-900">{cleanNeighborhoodName(t.destination || t.endNeighborhoodName)}</span>,
      exportValue: (t) => cleanNeighborhoodName(t.destination || t.endNeighborhoodName)
    },
    {
      key: 'distanceKm',
      label: 'Dist.',
      sortable: true,
      align: 'right',
      render: (t) => (
        <div className="flex flex-col items-end">
          <span className="font-mono text-xs font-medium text-slate-700">{t.distanceKm} km</span>
          {t.jams && (
            <span
              className="mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-900 border border-amber-300 whitespace-nowrap"
              title="Heure de pointe / Trafic dense Yango (jams: true)"
            >
              🚗 Jams
            </span>
          )}
        </div>
      ),
      exportValue: (t) => `${t.distanceKm} km${t.jams ? ' (Jams)' : ''}`
    },
    {
      key: 'yango_eco',
      label: 'Yango Éco',
      sortable: true,
      align: 'right',
      render: (t) => (
        <div className="flex flex-col items-end">
          {renderCellPrice(getYangoPrice(t, 'econom'), 'yango')}
          {t.yangoUnavailable ? (
            <span
              className="mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-900 border border-purple-300 whitespace-nowrap"
              title="Pénurie Yango : aucun chauffeur disponible sur cette zone"
            >
              ⚠️ Pénurie
            </span>
          ) : t.waitingTimeMinutes && t.waitingTimeMinutes > 5 ? (
            <span
              className="mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-600 whitespace-nowrap"
              title={`Attente estimée : ~${t.waitingTimeMinutes} min`}
            >
              ⏱️ {t.waitingTimeMinutes}m
            </span>
          ) : null}
        </div>
      ),
      exportValue: (t) => getYangoPrice(t, 'econom') || ''
    },
    {
      key: 'yango_confort',
      label: 'Yango Confort',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getYangoPrice(t, 'business'), 'yango'),
      exportValue: (t) => getYangoPrice(t, 'business') || ''
    },
    {
      key: 'hero_eco',
      label: 'Hero Éco',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getHeroPrice(t, 'eco'), 'hero'),
      exportValue: (t) => getHeroPrice(t, 'eco') || ''
    },
    {
      key: 'hero_confort',
      label: 'Hero Confort',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getHeroPrice(t, 'confort'), 'hero'),
      exportValue: (t) => getHeroPrice(t, 'confort') || ''
    },
    {
      key: 'tripmaster_eco',
      label: 'TM Éco',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getTripMasterPrice(t, 'eco'), 'tripmaster'),
      exportValue: (t) => getTripMasterPrice(t, 'eco') || ''
    },
    {
      key: 'tripmaster_confort',
      label: 'TM Confort',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getTripMasterPrice(t, 'confort'), 'tripmaster'),
      exportValue: (t) => getTripMasterPrice(t, 'confort') || ''
    },
    {
      key: 'tripmaster_moto',
      label: 'TM Moto',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getTripMasterPrice(t, 'moto'), 'tripmaster'),
      exportValue: (t) => getTripMasterPrice(t, 'moto') || ''
    },
    {
      key: 'cheaperProvider',
      label: 'Moins Cher',
      sortable: true,
      render: (t) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            t.cheaperProvider === 'hero'
              ? 'bg-teal-100 text-teal-800'
              : t.cheaperProvider === 'tripmaster'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {t.cheaperProvider === 'hero' ? 'Hero Cab' : t.cheaperProvider === 'tripmaster' ? 'Trip Master' : 'Yango'}
        </span>
      ),
      exportValue: (t) => t.cheaperProvider || 'yango'
    }
  ], []);

  return (
    <div className="space-y-4">
      <TripResultsHeader
        campaigns={campaigns}
        currentCampaign={currentCampaign}
        onSelectCampaignId={onSelectCampaignId}
      />

      <TripMetricsGrid stats={stats} currencySymbol="FCFA" />

      <PricingResultsFilterBar
        neighborhoodNames={neighborhoodNames}
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
        totalTripsCount={trips.length}
        filteredTripsCount={filteredTrips.length}
        hasJamsInCampaign={Boolean(currentCampaign?.hasJamsCount && currentCampaign.hasJamsCount > 0)}
        hasShortageInCampaign={Boolean(currentCampaign?.yangoShortageCount && currentCampaign.yangoShortageCount > 0)}
        onResetFilters={handleResetFilters}
      />

      <DataTable
        columns={columns}
        data={normalizedTrips}
        isLoading={isLoading}
        rowClassName={(t) =>
          t.jams
            ? 'bg-amber-50/90 hover:bg-amber-100/90 border-l-4 border-l-amber-500 text-amber-950 font-medium'
            : 'hover:bg-slate-50/60'
        }
        pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000, 999999]}
        defaultPageSize={25}
        searchPlaceholder="Rechercher par départ ou arrivée..."
        searchKeys={['startNeighborhoodName', 'endNeighborhoodName']}
        exportFileName={formatCampaignFileName(currentCampaign?.cityName, currentCampaign?.startedAt)}
      />
    </div>
  );
};
