import React, { useState, useMemo } from 'react';
import { Navigation, ArrowRight, Play, Info } from 'lucide-react';
import { ArrondissementSelect2, ArrondissementInfo } from './ArrondissementSelect2';

interface PricingArrondissementTesterProps {
  mode: 'intra' | 'inter';
  cityName: string;
  arrondissements?: string[];
  arrondissementOptions: ArrondissementInfo[];
  isRunning: boolean;
  onLaunchIntra: (arrondissement: string, limit: number | 'all') => void;
  onLaunchInter: (originArr: string, destArr: string, limit: number | 'all') => void;
}

export const PricingArrondissementTester: React.FC<PricingArrondissementTesterProps> = ({
  mode,
  cityName,
  arrondissements = [],
  arrondissementOptions,
  isRunning,
  onLaunchIntra,
  onLaunchInter
}) => {
  // Use options if provided, otherwise fallback to simple list
  const effectiveOptions: ArrondissementInfo[] = useMemo(() => {
    if (arrondissementOptions && arrondissementOptions.length > 0) {
      return arrondissementOptions;
    }
    return arrondissements.map((arr) => ({
      name: arr,
      cityName,
      tripCount: 0,
      neighborhoodsCount: 0,
      formattedLabel: `${arr} (0 trajet - ${cityName})`
    }));
  }, [arrondissementOptions, arrondissements, cityName]);

  const defaultFirst = effectiveOptions[0]?.name || '';
  const defaultSecond = effectiveOptions[1]?.name || effectiveOptions[0]?.name || '';

  const [selectedArr, setSelectedArr] = useState<string>(defaultFirst);
  const [originArr, setOriginArr] = useState<string>(defaultFirst);
  const [destArr, setDestArr] = useState<string>(defaultSecond);

  // Stats for selected arrondissements
  const selectedInfo = useMemo(() => {
    return effectiveOptions.find((opt) => opt.name === selectedArr);
  }, [effectiveOptions, selectedArr]);

  const originInfo = useMemo(() => {
    return effectiveOptions.find((opt) => opt.name === originArr);
  }, [effectiveOptions, originArr]);

  const destInfo = useMemo(() => {
    return effectiveOptions.find((opt) => opt.name === destArr);
  }, [effectiveOptions, destArr]);

  // Inter-corridor potential trips (chaque quartier est appelé au maximum 5 fois)
  const interTripsCount = useMemo(() => {
    if (!originInfo || !destInfo) return 0;
    const count = originInfo.neighborhoodsCount * Math.min(5, destInfo.neighborhoodsCount);
    return Math.min(count, 300);
  }, [originInfo, destInfo]);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all space-y-3">
      {/* Panel Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          {mode === 'intra' ? (
            <>
              <Navigation className="w-3.5 h-3.5 text-teal-700" />
              <span>
                Pricing Intra-Arrondissement : Tester tous les trajets internes d'un seul arrondissement
              </span>
            </>
          ) : (
            <>
              <ArrowRight className="w-3.5 h-3.5 text-blue-700" />
              <span>
                Pricing Inter-Arrondissements : Corridor direct d'un arrondissement A vers B
              </span>
            </>
          )}
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">Ville : {cityName}</span>
      </div>

      {/* Panel Form Controls with Select2 */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        {mode === 'intra' ? (
          <div className="sm:col-span-8">
            <ArrondissementSelect2
              id="intra-arr-select2"
              label="Sélecteur d'Arrondissement (Recherche intégrée)"
              value={selectedArr}
              onChange={setSelectedArr}
              options={effectiveOptions}
              disabled={isRunning}
            />
          </div>
        ) : (
          <>
            <div className="sm:col-span-4">
              <ArrondissementSelect2
                id="inter-origin-select2"
                label="Arrondissement Départ A (Recherche intégrée)"
                value={originArr}
                onChange={setOriginArr}
                options={effectiveOptions}
                disabled={isRunning}
              />
            </div>

            <div className="hidden sm:flex sm:col-span-1 justify-center pb-2.5 text-slate-400">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="sm:col-span-4">
              <ArrondissementSelect2
                id="inter-dest-select2"
                label="Arrondissement Destination B (Recherche intégrée)"
                value={destArr}
                onChange={setDestArr}
                options={effectiveOptions}
                disabled={isRunning}
              />
            </div>
          </>
        )}

        {/* Launch Button */}
        <div className={mode === 'intra' ? 'sm:col-span-4 flex justify-end' : 'sm:col-span-3 flex justify-end'}>
          <button
            onClick={() => {
              if (mode === 'intra') onLaunchIntra(selectedArr, 'all');
              else onLaunchInter(originArr, destArr, 'all');
            }}
            disabled={isRunning}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#1F4F4A] hover:bg-[#183F3B] rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white shrink-0" />
            <span>{isRunning ? 'Démarrage...' : 'Lancer la tarification'}</span>
          </button>
        </div>
      </div>

      {/* Informative Summary Pill */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
        <Info className="w-3.5 h-3.5 text-teal-700 shrink-0" />
        {mode === 'intra' && selectedInfo && (
          <span>
            Arrondissement sélectionné : <strong className="text-slate-800">{selectedInfo.name}</strong> avec{' '}
            <strong className="text-teal-800">{selectedInfo.neighborhoodsCount} quartiers</strong> (soit{' '}
            <strong className="text-teal-800">{selectedInfo.tripCount} trajets</strong>, max 5 appels par quartier dans {selectedInfo.cityName}).
          </span>
        )}
        {mode === 'inter' && originInfo && destInfo && (
          <span>
            Corridor inter-arrondissements : de <strong className="text-slate-800">{originInfo.name}</strong> ({originInfo.neighborhoodsCount} quartiers) vers{' '}
            <strong className="text-slate-800">{destInfo.name}</strong> ({destInfo.neighborhoodsCount} quartiers) &rarr;{' '}
            <strong className="text-teal-800">{interTripsCount} trajets configurés</strong> (max 5 appels par quartier).
          </span>
        )}
      </div>
    </div>
  );
};
