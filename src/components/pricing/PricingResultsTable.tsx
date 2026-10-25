import React, { useMemo, useState } from 'react';
import { PricingCampaign, TripResult } from '../../types';
import { DataTable, Column } from '../DataTable';
import { Code, LayoutGrid, Table, ArrowRight, TrendingDown, ChevronLeft, ChevronRight, AlertTriangle, Zap } from 'lucide-react';
import {
  cleanNeighborhoodName,
  renderCellPrice,
  getYangoPrice,
  getHeroPrice,
  getTripMasterPrice,
  getTripSurgeInfo
} from './pricingUtils';

interface PricingResultsTableProps {
  trips: TripResult[];
  isLoading: boolean;
  cityName: string;
  isPricingRunning: boolean;
  campaign?: PricingCampaign;
  onInspectTrip: (trip: TripResult) => void;
}

export const PricingResultsTable: React.FC<PricingResultsTableProps> = ({
  trips,
  isLoading,
  cityName,
  isPricingRunning,
  campaign,
  onInspectTrip
}) => {
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');
  const [mobilePage, setMobilePage] = useState(1);
  const [tableFilter, setTableFilter] = useState<'all' | 'shortage' | 'tension'>('all');
  const MOBILE_PAGE_SIZE = 15;

  const shortageCount = useMemo(() => trips.filter(t => t.yangoUnavailable).length, [trips]);
  const tensionCount = useMemo(() => trips.filter(t => getTripSurgeInfo(t).isSurge || t.jams).length, [trips]);

  const filteredTrips = useMemo(() => {
    if (tableFilter === 'shortage') return trips.filter(t => t.yangoUnavailable);
    if (tableFilter === 'tension') return trips.filter(t => getTripSurgeInfo(t).isSurge || t.jams);
    return trips;
  }, [trips, tableFilter]);

  const normalizedTrips = useMemo(() => {
    return filteredTrips.map((t) => {
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
  }, [filteredTrips]);

  const totalMobilePages = Math.ceil(normalizedTrips.length / MOBILE_PAGE_SIZE) || 1;
  const currentMobileTrips = useMemo(() => {
    const start = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    return normalizedTrips.slice(start, start + MOBILE_PAGE_SIZE);
  }, [normalizedTrips, mobilePage]);

  const progressPercent = useMemo(() => {
    if (!campaign || !campaign.totalPairs || campaign.totalPairs <= 0) return 0;
    return Math.min(100, Math.round(((campaign.completedPairs || 0) / campaign.totalPairs) * 100));
  }, [campaign]);

  const batchProgressPercent = useMemo(() => {
    if (!campaign || !campaign.totalBatches || campaign.totalBatches <= 0) return progressPercent;
    return Math.min(100, Math.round(((campaign.completedBatches || 0) / campaign.totalBatches) * 100));
  }, [campaign, progressPercent]);

  const columns: Column<TripResult>[] = useMemo(() => [
    {
      key: 'ref',
      label: 'Réf.',
      sortable: false,
      align: 'center',
      width: '50px',
      render: (_t: TripResult, index: number) => (
        <span className="font-mono text-[11px] text-slate-500 font-bold">
          #{index + 1}
        </span>
      ),
      exportValue: (_t: TripResult) => 'Réf'
    },
    {
      key: 'origin',
      label: 'Départ',
      sortable: true,
      render: (t) => (
        <span className="font-medium text-slate-900 block truncate max-w-[130px]">
          {cleanNeighborhoodName(t.origin || t.startNeighborhoodName)}
        </span>
      ),
      exportValue: (t) => cleanNeighborhoodName(t.origin || t.startNeighborhoodName)
    },
    {
      key: 'destination',
      label: 'Destination',
      sortable: true,
      render: (t) => (
        <span className="font-medium text-slate-900 block truncate max-w-[130px]">
          {cleanNeighborhoodName(t.destination || t.endNeighborhoodName)}
        </span>
      ),
      exportValue: (t) => cleanNeighborhoodName(t.destination || t.endNeighborhoodName)
    },
    {
      key: 'distanceKm',
      label: 'Dist.',
      sortable: true,
      align: 'right',
      render: (t) => {
        const surge = getTripSurgeInfo(t);
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-slate-800 text-xs font-semibold">{t.distanceKm} km</span>
            {surge.isSurge && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shadow-2xs inline-flex items-center gap-0.5"
                title={`Forte demande / Tarif ajusté ROUGE constatée (+${surge.surgePct}% vs tarif de référence)`}
              >
                🔥 Ajusté +{surge.surgePct}%
              </span>
            )}
          </div>
        );
      },
      exportValue: (t) => {
        const surge = getTripSurgeInfo(t);
        return `${t.distanceKm} km${surge.isSurge ? ` (Ajusté +${surge.surgePct}%)` : ''}`;
      }
    },
    {
      key: 'yango_eco',
      label: 'ROUGE Éco',
      sortable: true,
      align: 'right',
      render: (t) => (
        <div className="flex flex-col items-end">
          {t.yangoUnavailable ? (
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-900 border border-purple-300 whitespace-nowrap shadow-2xs inline-flex items-center gap-0.5"
              title="Pénurie de véhicules : aucun chauffeur disponible"
            >
              ⚠️ Pénurie
            </span>
          ) : (
            renderCellPrice(getYangoPrice(t, 'econom'), 'yango')
          )}
          {!t.yangoUnavailable && t.waitingTimeMinutes && t.waitingTimeMinutes > 5 ? (
            <span
              className="mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-600 whitespace-nowrap"
              title={`Attente estimée : ~${t.waitingTimeMinutes} min`}
            >
              ⏱️ {t.waitingTimeMinutes}m
            </span>
          ) : null}
        </div>
      ),
      exportValue: (t) => `${getYangoPrice(t, 'econom') || ''}${t.yangoUnavailable ? ' (Pénurie de véhicules)' : ''}`
    },
    {
      key: 'yango_confort',
      label: 'ROUGE Conf.',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getYangoPrice(t, 'business'), 'yango'),
      exportValue: (t) => getYangoPrice(t, 'business') || ''
    },
    {
      key: 'yango_confort_plus',
      label: 'ROUGE C+',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getYangoPrice(t, 'comfortplus'), 'yango'),
      exportValue: (t) => getYangoPrice(t, 'comfortplus') || ''
    },
    {
      key: 'yango_moto',
      label: 'ROUGE Moto',
      sortable: true,
      align: 'right',
      render: (t) => renderCellPrice(getYangoPrice(t, 'moto'), 'yango'),
      exportValue: (t) => getYangoPrice(t, 'moto') || ''
    },
    {
      key: 'hero_eco',
      label: 'Hero Standard',
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
    <div className="space-y-3">
      {/* Filtres Rapides : Trajets en Pénurie & Trajets en Tension */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-700 mr-1">Filtrer l'affichage :</span>

          <button
            type="button"
            onClick={() => setTableFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tableFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tous ({trips.length})
          </button>

          {/* Trajets en Pénurie - Gardé affiché */}
          <button
            type="button"
            onClick={() => setTableFilter(prev => prev === 'shortage' ? 'all' : 'shortage')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
              tableFilter === 'shortage'
                ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
                : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
            }`}
            title="Afficher uniquement les trajets en pénurie (aucun véhicule ROUGE)"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Trajets en pénurie ({shortageCount})</span>
          </button>

          {/* Trajets en Tension - Mentionné à partir de maintenant */}
          <button
            type="button"
            onClick={() => setTableFilter(prev => prev === 'tension' ? 'all' : 'tension')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
              tableFilter === 'tension'
                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                : 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
            }`}
            title="Afficher uniquement les trajets en tension (forte demande & tarif ajusté ROUGE)"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Trajets en tension ({tensionCount})</span>
          </button>
        </div>

        {tableFilter !== 'all' && (
          <span className="text-xs font-semibold text-slate-500">
            {filteredTrips.length} trajet(s) filtré(s)
          </span>
        )}
      </div>

      {/* Mobile View Toggle Switch (Cards vs Table) */}
      <div className="md:hidden flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <span className="text-xs font-semibold text-slate-600">
          Affichage ({normalizedTrips.length} trajets)
        </span>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          <button
            onClick={() => setMobileView('cards')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              mobileView === 'cards'
                ? 'bg-white text-[#1F4F4A] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Cartes</span>
          </button>
          <button
            onClick={() => setMobileView('table')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              mobileView === 'table'
                ? 'bg-white text-[#1F4F4A] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Tableau</span>
          </button>
        </div>
      </div>

      {/* Mobile Cards View */}
      {mobileView === 'cards' && (
        <div className="md:hidden space-y-2.5">
          {isLoading || isPricingRunning ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2.5">
              <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-[#1F4F4A] animate-spin" />
              <span>Tarification en cours... Le tableau sera rempli à la fin du pricing ou lorsque vous arrêterez la campagne.</span>
            </div>
          ) : currentMobileTrips.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              {isPricingRunning
                ? 'Tarification en cours... Les trajets apparaîtront dès la fin du calcul.'
                : 'Aucun trajet disponible.'}
            </div>
          ) : (
            <>
              {currentMobileTrips.map((t) => {
                const yEco = getYangoPrice(t, 'econom');
                const hEco = getHeroPrice(t, 'eco');
                const tmEco = getTripMasterPrice(t, 'eco');

                const orig = cleanNeighborhoodName(t.origin || t.startNeighborhoodName);
                const dest = cleanNeighborhoodName(t.destination || t.endNeighborhoodName);
                const isHeroCheaper = hEco && yEco ? hEco < yEco : false;
                const isYangoCheaper = hEco && yEco ? yEco < hEco : false;
                const surge = getTripSurgeInfo(t);

                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border p-3.5 shadow-2xs space-y-2.5 transition ${
                      t.yangoUnavailable
                        ? 'bg-purple-50/90 border-purple-300 ring-1 ring-purple-300/60'
                        : surge.isSurge
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-white border-slate-200/90'
                    }`}
                  >
                    {/* Route Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <span className="font-mono text-[10px] font-bold text-[#1F4F4A] bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded shrink-0">
                            #{t.id}
                          </span>
                          <span className="truncate">{orig}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{dest}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-600">
                          <span className="font-semibold">{t.distanceKm} km</span>
                          {t.durationMinutes && (
                            <>
                              <span>·</span>
                              <span>~{t.durationMinutes} min</span>
                            </>
                          )}
                          {surge.isSurge && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-950 border border-amber-400">
                              🔥 Ajusté +{surge.surgePct}%
                            </span>
                          )}
                          {t.yangoUnavailable && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200 text-purple-950 border border-purple-400">
                              ⚠️ Pénurie de véhicules
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onInspectTrip(t)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg shrink-0"
                        title="Détails JSON"
                      >
                        <Code className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Pricing Comparison Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                      {/* Yango */}
                      <div className={`p-2 rounded-lg border ${
                        t.yangoUnavailable
                          ? 'bg-purple-50 border-purple-200'
                          : isYangoCheaper
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-slate-50/60 border-slate-100'
                      }`}>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ROUGE</div>
                        {t.yangoUnavailable ? (
                          <div className="text-xs font-bold text-purple-900 mt-0.5">
                            ⚠️ Pénurie
                          </div>
                        ) : (
                          <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                            {yEco ? `${yEco.toLocaleString('fr-FR')} F` : '—'}
                          </div>
                        )}
                        <div className="text-[9px] text-slate-400">Éco</div>
                      </div>

                      {/* Hero Cab */}
                      <div className={`p-2 rounded-lg border ${
                        isHeroCheaper ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50/60 border-slate-100'
                      }`}>
                        <div className="text-[10px] font-bold text-[#1F4F4A] uppercase tracking-wider">Hero Cab</div>
                        <div className="text-xs font-extrabold text-[#1F4F4A] mt-0.5">
                          {hEco ? `${hEco.toLocaleString('fr-FR')} F` : '—'}
                        </div>
                        <div className="text-[9px] text-slate-400">Standard</div>
                      </div>

                      {/* Trip Master */}
                      <div className="p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trip Master</div>
                        <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                          {tmEco ? `${tmEco.toLocaleString('fr-FR')} F` : '—'}
                        </div>
                        <div className="text-[9px] text-slate-400">Éco</div>
                      </div>
                    </div>

                    {/* Advantage indicator */}
                    {yEco && hEco && yEco !== hEco && (
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-500">Écart tarifaire :</span>
                        <span className={`font-bold flex items-center gap-1 ${
                          isHeroCheaper ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          <TrendingDown className="w-3 h-3" />
                          {isHeroCheaper ? 'Hero Cab ' : 'ROUGE '} moins cher de {Math.abs(yEco - hEco).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Mobile Pagination */}
              {totalMobilePages > 1 && (
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setMobilePage((p) => Math.max(1, p - 1))}
                    disabled={mobilePage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-slate-700">
                    Page {mobilePage} / {totalMobilePages}
                  </span>
                  <button
                    onClick={() => setMobilePage((p) => Math.min(totalMobilePages, p + 1))}
                    disabled={mobilePage === totalMobilePages}
                    className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Desktop Table View (or mobile if user chose table view) */}
      <div className={mobileView === 'cards' ? 'hidden md:block' : 'block'}>
        <DataTable
          columns={columns}
          data={isPricingRunning ? [] : normalizedTrips}
          isLoading={isPricingRunning || isLoading}
          hasGroupedHeaders
          rowClassName={(t) => {
            if (t.yangoUnavailable) {
              return 'bg-purple-50/70 hover:bg-purple-100/70 text-slate-900 font-medium transition-colors';
            }
            const surge = getTripSurgeInfo(t);
            if (surge.isSurge) {
              return 'bg-amber-50/40 hover:bg-amber-100/50 text-slate-900 transition-colors';
            }
            return 'hover:bg-slate-50/60 transition-colors';
          }}
          pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000, 999999]}
          defaultPageSize={25}
          exportFileName={`pricing_${cityName.toLowerCase()}_${trips.length}_trajets`}
          emptyMessage={
            isPricingRunning
              ? 'Tarification en cours... Les trajets apparaîtront dès la fin du calcul.'
              : 'Aucun trajet disponible.'
          }
        />
      </div>
    </div>
  );
};
