import React, { useEffect, useState, useMemo } from 'react';
import { PricingCampaign, TripResult } from '../types';
import { api } from '../services/api';
import { DataTable, Column } from './DataTable';
import { TripResultsHeader } from './trips/TripResultsHeader';
import { TripMetricsGrid } from './trips/TripMetricsGrid';
import { TripMatrixView } from './trips/TripMatrixView';

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

  const neighborhoodsList = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      set.add(t.startNeighborhoodName);
      set.add(t.endNeighborhoodName);
    });
    return Array.from(set).sort();
  }, [trips]);

  const stats = useMemo(() => {
    if (trips.length === 0) return { min: 0, max: 0, avg: 0, avgKm: 0, maxTrip: null, minTrip: null };
    const prices = trips.map((t) => t.price).filter(p => p > 0);
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const avgKm = Number(
      (trips.reduce((a, b) => a + (b.distanceKm || 0), 0) / (trips.length || 1)).toFixed(1)
    );
    const maxTrip = trips.find((t) => t.price === max);
    const minTrip = trips.find((t) => t.price === min);

    return { min, max, avg, avgKm, maxTrip, minTrip };
  }, [trips]);

  const matrixData = useMemo(() => {
    const map: Record<string, Record<string, TripResult>> = {};
    neighborhoodsList.forEach((o) => {
      map[o] = {};
    });
    trips.forEach((t) => {
      if (map[t.startNeighborhoodName]) {
        map[t.startNeighborhoodName][t.endNeighborhoodName] = t;
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
      key: 'startNeighborhoodName',
      label: 'Départ',
      sortable: true,
      render: (t) => <span className="font-semibold text-slate-900">{t.startNeighborhoodName}</span>
    },
    {
      key: 'endNeighborhoodName',
      label: 'Destination',
      sortable: true,
      render: (t) => <span className="font-semibold text-slate-900">{t.endNeighborhoodName}</span>
    },
    {
      key: 'distanceKm',
      label: 'Distance',
      sortable: true,
      align: 'right',
      render: (t) => <span className="font-mono text-xs">{t.distanceKm} km</span>
    },
    {
      key: 'durationMinutes',
      label: 'Durée',
      sortable: true,
      align: 'right',
      render: (t) => <span className="font-mono text-xs">{t.durationMinutes} min</span>
    },
    {
      key: 'price',
      label: 'Prix Yango',
      sortable: true,
      align: 'right',
      render: (t) => (
        <span className="font-mono font-bold text-slate-900">
          {t.price?.toLocaleString('fr-FR')} FCFA
        </span>
      )
    },
    {
      key: 'priceHero',
      label: 'Prix Hero Cab',
      sortable: true,
      align: 'right',
      render: (t) => (
        <span className="font-mono font-bold text-teal-700">
          {t.priceHero ? `${t.priceHero.toLocaleString('fr-FR')} FCFA` : '—'}
        </span>
      )
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
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {t.cheaperProvider === 'hero' ? 'Hero Cab' : 'Yango'}
        </span>
      )
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
        onExportCsv={handleExportCsv}
      />

      <TripMetricsGrid stats={stats} currencySymbol="FCFA" />

      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={trips}
          isLoading={isLoading}
          searchPlaceholder="Rechercher par départ ou arrivée..."
          searchKeys={['startNeighborhoodName', 'endNeighborhoodName']}
          exportFileName={`trajets_${currentCampaign?.cityName?.toLowerCase() || 'vtc'}`}
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
