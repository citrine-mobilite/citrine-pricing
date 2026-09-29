import React, { useMemo } from 'react';
import { TripResult } from '../../types';
import { DataTable, Column } from '../DataTable';
import { Code } from 'lucide-react';
import {
  cleanNeighborhoodName,
  renderCellPrice,
  getYangoPrice,
  getHeroPrice,
  getTripMasterPrice
} from './pricingUtils';

interface PricingResultsTableProps {
  trips: TripResult[];
  isLoading: boolean;
  cityName: string;
  isPricingRunning: boolean;
  onInspectTrip: (trip: TripResult) => void;
}

export const PricingResultsTable: React.FC<PricingResultsTableProps> = ({
  trips,
  isLoading,
  cityName,
  isPricingRunning,
  onInspectTrip
}) => {
  const normalizedTrips = useMemo(() => {
    return trips.map((t) => {
      const yEco = getYangoPrice(t, 'econom');
      const yConf = getYangoPrice(t, 'business');
      const yConfPlus = getYangoPrice(t, 'comfortplus');
      const yMoto = getYangoPrice(t, 'moto');

      const hEco = getHeroPrice(t, 'eco');
      const hConf = getHeroPrice(t, 'confort');
      const hSuv = getHeroPrice(t, 'suv');
      const hPerKm = getHeroPrice(t, 'perkm');

      const tmEco = getTripMasterPrice(t, 'eco');
      const tmConf = getTripMasterPrice(t, 'confort');
      const tmMoto = getTripMasterPrice(t, 'moto');

      return {
        ...t,
        yango_eco: yEco ?? undefined,
        yango_confort: yConf ?? undefined,
        yango_confort_plus: yConfPlus ?? undefined,
        yango_moto: yMoto ?? undefined,
        hero_eco: hEco ?? undefined,
        hero_confort: hConf ?? undefined,
        hero_suv: hSuv ?? undefined,
        hero_per_km: hPerKm ?? undefined,
        tripmaster_eco: tmEco ?? undefined,
        tripmaster_confort: tmConf ?? undefined,
        tripmaster_moto: tmMoto ?? undefined
      };
    });
  }, [trips]);

  const columns: Column<TripResult>[] = useMemo(() => [
    {
      key: 'startNeighborhoodName',
      label: 'Départ',
      sortable: true,
      render: (t) => (
        <span className="font-medium text-slate-900 block truncate max-w-[130px]">
          {cleanNeighborhoodName(t.startNeighborhoodName)}
        </span>
      ),
      exportValue: (t) => cleanNeighborhoodName(t.startNeighborhoodName)
    },
    {
      key: 'endNeighborhoodName',
      label: 'Destination',
      sortable: true,
      render: (t) => (
        <span className="font-medium text-slate-900 block truncate max-w-[130px]">
          {cleanNeighborhoodName(t.endNeighborhoodName)}
        </span>
      ),
      exportValue: (t) => cleanNeighborhoodName(t.endNeighborhoodName)
    },
    {
      key: 'distanceKm',
      label: 'Dist.',
      sortable: true,
      align: 'right',
      render: (t) => <span className="font-mono text-slate-500 text-xs">{t.distanceKm} km</span>,
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
      key: 'yango_confort_plus',
      label: 'Yango Confort+',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getYangoPrice(t, 'comfortplus'), 'yango'),
      exportValue: (t) => getYangoPrice(t, 'comfortplus') || ''
    },
    {
      key: 'yango_moto',
      label: 'Yango Moto',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getYangoPrice(t, 'moto'), 'yango'),
      exportValue: (t) => getYangoPrice(t, 'moto') || ''
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
      key: 'hero_suv',
      label: 'Hero SUV',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getHeroPrice(t, 'suv'), 'hero'),
      exportValue: (t) => getHeroPrice(t, 'suv') || ''
    },
    {
      key: 'hero_per_km',
      label: 'Hero PerKm',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getHeroPrice(t, 'perkm'), 'hero'),
      exportValue: (t) => getHeroPrice(t, 'perkm') || ''
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
      key: 'source',
      label: 'Détails',
      align: 'center',
      render: (t) => (
        <button
          onClick={() => onInspectTrip(t)}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
      )
    }
  ], [onInspectTrip]);

  return (
    <DataTable
      columns={columns}
      data={normalizedTrips}
      isLoading={isLoading}
      hasGroupedHeaders
      pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000, 999999]}
      defaultPageSize={25}
      exportFileName={`pricing_${cityName.toLowerCase()}_${trips.length}_trajets`}
      emptyMessage={
        isPricingRunning
          ? 'Tarification en cours... Les trajets apparaîtront dès la fin du calcul.'
          : 'Aucun trajet disponible.'
      }
    />
  );
};
