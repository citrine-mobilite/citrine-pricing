import React, { useState } from 'react';
import { Plane, Navigation, MapPin, AlertCircle } from 'lucide-react';
import { City, Neighborhood } from '../../types';

interface PricingAirportViewProps {
  currentCity: City;
  cityActiveNeighborhoods: Neighborhood[];
  isRunning: boolean;
  onLaunchAirport: (limit: number | 'all', comment?: string) => void;
}

export const PricingAirportView: React.FC<PricingAirportViewProps> = ({
  currentCity,
  cityActiveNeighborhoods,
  isRunning,
  onLaunchAirport
}) => {
  const [sampleLimit, setSampleLimit] = useState<number | 'all'>('all');
  const [comment, setComment] = useState<string>('Pricing Destinations Aéroport');

  // Coordonnées aéroportuaires enregistrées en base de données pour la ville
  const cityAirport = currentCity.airport;
  const hasAirportInDb = Boolean(cityAirport && cityAirport.lat && cityAirport.lng);

  // Fallback quartier éventuel si non configuré
  const fallbackAirportNb = cityActiveNeighborhoods.find(n =>
    n.zoneType === 'airport' ||
    n.name.toLowerCase().includes('aérop') ||
    n.name.toLowerCase().includes('aerop') ||
    n.name.toLowerCase().includes('nsimalen')
  );

  const airportTargetName = cityAirport?.name || fallbackAirportNb?.name || (
    currentCity.name.toLowerCase().includes('yaound')
      ? 'Aéroport International de Yaoundé-Nsimalen'
      : 'Aéroport International de Douala'
  );

  const otherNeighborhoods = cityActiveNeighborhoods.filter(n =>
    !fallbackAirportNb || String(n.id) !== String(fallbackAirportNb.id)
  );

  const totalPossibleTrips = otherNeighborhoods.length;
  const effectiveTripsCount = sampleLimit === 'all'
    ? totalPossibleTrips
    : Math.min(sampleLimit, totalPossibleTrips);

  const isConfigured = hasAirportInDb || Boolean(fallbackAirportNb);

  const handleLaunch = () => {
    onLaunchAirport(sampleLimit, comment.trim() || undefined);
  };

  return (
    <div className="bg-white rounded-xl border border-sky-200/90 p-5 shadow-xs bg-gradient-to-br from-sky-50/40 via-white to-teal-50/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-sky-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-700 flex items-center justify-center shrink-0">
            <Plane className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Pricing Aéroport — {currentCity.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                Type : airport
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Campagne de tarification systématique de tous les quartiers actifs vers l'aéroport ({airportTargetName})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700">Aéroport en base :</span>
          {isConfigured ? (
            <span className="px-2.5 py-1 rounded-lg font-bold bg-sky-100/70 text-sky-900 border border-sky-200 flex items-center gap-1.5 font-mono">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              <span>{airportTargetName}</span>
              {cityAirport && (
                <span className="text-[10px] text-sky-700 font-normal">
                  ({cityAirport.lat}, {cityAirport.lng})
                </span>
              )}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Non configuré (onglet Villes)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
        {/* Paramètre 1: Volume */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            Périmètre du pricing :
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setSampleLimit(25)}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                sampleLimit === 25
                  ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              25 Trajets
            </button>
            <button
              type="button"
              onClick={() => setSampleLimit(50)}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                sampleLimit === 50
                  ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              50 Trajets
            </button>
            <button
              type="button"
              onClick={() => setSampleLimit('all')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                sampleLimit === 'all'
                  ? 'bg-[#1F4F4A] text-white border-[#1F4F4A] shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tous ({totalPossibleTrips})
            </button>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {effectiveTripsCount} quartiers actifs vers l'aéroport
          </div>
        </div>

        {/* Paramètre 2: Direction */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            Direction du relevé :
          </label>
          <div className="bg-sky-50/60 border border-sky-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-sky-900 font-semibold">
            <Navigation className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Tous les quartiers → Aéroport (Aller simple)</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Chaque quartier actif est le point de départ vers l'aéroport
          </div>
        </div>

        {/* Paramètre 3: Commentaire & Observation */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            Observation / Contexte :
          </label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex: Pricing vol de nuit, heure de pointe..."
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <div className="text-[11px] text-slate-400">
            Archivé dans les métadonnées de la campagne
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-sky-100">
        <div className="text-xs text-slate-600 flex items-center gap-1.5">
          <span className="font-bold text-slate-900">{effectiveTripsCount}</span> trajets seront tarifés vers l'aéroport de {currentCity.name}
        </div>

        <button
          onClick={handleLaunch}
          disabled={isRunning || !isConfigured || effectiveTripsCount === 0}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl transition shadow-xs cursor-pointer active:scale-95"
        >
          <Plane className="w-4 h-4" />
          <span>Lancer le Pricing Aéroport ({effectiveTripsCount} trajets)</span>
        </button>
      </div>
    </div>
  );
};
