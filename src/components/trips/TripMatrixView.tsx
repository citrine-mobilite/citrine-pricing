import React from 'react';
import { TripResult } from '../../types';

interface TripMatrixViewProps {
  neighborhoodsList: string[];
  matrixData: Record<string, Record<string, TripResult>>;
  minPrice: number;
  maxPrice: number;
  currencySymbol: string;
}

export const TripMatrixView: React.FC<TripMatrixViewProps> = ({
  neighborhoodsList,
  matrixData,
  minPrice,
  maxPrice,
  currencySymbol
}) => {
  const getHeatmapColor = (price: number) => {
    if (!maxPrice || !minPrice || maxPrice === minPrice) return 'bg-slate-100 text-slate-800';
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    if (ratio < 0.3) return 'bg-emerald-50 text-emerald-800 border border-emerald-200/60';
    if (ratio < 0.65) return 'bg-amber-50 text-amber-800 border border-amber-200/60';
    return 'bg-rose-50 text-rose-800 border border-rose-200/60 font-semibold';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-900">
          Matrice d'Interconnexion Tarifaire (Origine \ Destination)
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300" /> &lt; 30%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300" /> 30-65%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-rose-100 border border-rose-300" /> &gt; 65%
          </span>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-[11px] text-slate-700 border-collapse">
          <thead className="sticky top-0 bg-slate-50 shadow-xs z-10">
            <tr>
              <th className="py-2.5 px-3 border border-slate-200 bg-slate-100 text-left font-bold text-slate-800">
                Départ \ Arrivée
              </th>
              {neighborhoodsList.map((dest) => (
                <th
                  key={dest}
                  className="py-2.5 px-2 border border-slate-200 text-center font-semibold text-slate-700 max-w-[90px] truncate"
                  title={dest}
                >
                  {dest}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {neighborhoodsList.map((orig) => (
              <tr key={orig} className="hover:bg-slate-50/50">
                <td className="py-2 px-3 border border-slate-200 font-bold bg-slate-50/80 text-slate-900 truncate max-w-[120px]">
                  {orig}
                </td>
                {neighborhoodsList.map((dest) => {
                  const trip = matrixData[orig]?.[dest];
                  if (orig === dest) {
                    return (
                      <td key={dest} className="py-2 px-2 border border-slate-200 text-center bg-slate-100/60 text-slate-400">
                        —
                      </td>
                    );
                  }
                  if (!trip) {
                    return (
                      <td key={dest} className="py-2 px-2 border border-slate-200 text-center text-slate-300">
                        N/A
                      </td>
                    );
                  }
                  const tripPrice = trip.price || trip.prices?.yango?.eco || trip.prices?.heroCab?.eco || 0;
                  return (
                    <td
                      key={dest}
                      className={`py-2 px-2 border text-center font-mono ${getHeatmapColor(tripPrice)}`}
                      title={`${orig} ➔ ${dest} (${trip.distanceKm} km, ${trip.durationMinutes} min)`}
                    >
                      {tripPrice.toLocaleString('fr-FR')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
