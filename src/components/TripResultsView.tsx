import React, { useEffect, useState, useMemo } from 'react';
import { PricingCampaign, TripResult } from '../types';
import { api } from '../services/api';
import { DataTable, Column } from './DataTable';
import { TripResultsHeader } from './trips/TripResultsHeader';
import { TripMetricsGrid } from './trips/TripMetricsGrid';
import { TripMatrixView } from './trips/TripMatrixView';
import { formatCampaignFileName } from '../utils/exportUtils';
import {
  cleanNeighborhoodName,
  renderCellPrice,
  getYangoPrice,
  getHeroPrice,
  getTripMasterPrice
} from './pricing/pricingUtils';

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
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('table');
  const [trips, setTrips] = useState<TripResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const normalizedTrips = useMemo(() => {
    return trips.map((t) => {
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
  }, [trips]);

  const neighborhoodsList = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      set.add(cleanNeighborhoodName(t.origin || t.startNeighborhoodName));
      set.add(cleanNeighborhoodName(t.destination || t.endNeighborhoodName));
    });
    return Array.from(set).sort();
  }, [trips]);

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

  const matrixData = useMemo(() => {
    const map: Record<string, Record<string, TripResult>> = {};
    neighborhoodsList.forEach((o) => {
      map[o] = {};
    });
    trips.forEach((t) => {
      const start = cleanNeighborhoodName(t.origin || t.startNeighborhoodName);
      const end = cleanNeighborhoodName(t.destination || t.endNeighborhoodName);
      if (map[start]) {
        map[start][end] = t;
      }
    });
    return map;
  }, [neighborhoodsList, trips]);

  const handleExportCsv = () => {
    if (!currentCampaign) return;
    window.location.href = api.getExportCsvUrl(currentCampaign.id);
  };

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
      render: (t) => <span className="font-mono text-xs">{t.distanceKm} km</span>,
      exportValue: (t) => `${t.distanceKm} km`
    },
    {
      key: 'yango_eco',
      label: 'Yango Éco',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getYangoPrice(t, 'econom'), 'yango'),
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
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <TripMetricsGrid stats={stats} currencySymbol="FCFA" />

      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={normalizedTrips}
          isLoading={isLoading}
          pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000, 999999]}
          defaultPageSize={25}
          searchPlaceholder="Rechercher par départ ou arrivée..."
          searchKeys={['startNeighborhoodName', 'endNeighborhoodName']}
          exportFileName={formatCampaignFileName(currentCampaign?.cityName, currentCampaign?.startedAt)}
        />
      ) : (
        <TripMatrixView
          neighborhoodsList={neighborhoodsList}
          matrixData={matrixData}
          minPrice={stats.min}
          maxPrice={stats.max}
          currencySymbol="FCFA"
        />
      )}
    </div>
  );
};
