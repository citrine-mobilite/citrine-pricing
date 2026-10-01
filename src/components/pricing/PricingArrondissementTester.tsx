import React, { useState } from 'react';
import { Navigation, ArrowRight, Play } from 'lucide-react';

interface PricingArrondissementTesterProps {
  mode: 'intra' | 'inter';
  cityName: string;
  arrondissements: string[];
  isRunning: boolean;
  onLaunchIntra: (arrondissement: string, limit: number | 'all') => void;
  onLaunchInter: (originArr: string, destArr: string, limit: number | 'all') => void;
}

export const PricingArrondissementTester: React.FC<PricingArrondissementTesterProps> = ({
  mode,
  cityName,
  arrondissements,
  isRunning,
  onLaunchIntra,
  onLaunchInter
}) => {
  const [selectedArr, setSelectedArr] = useState<string>(arrondissements[0] || 'Douala 1er');
  const [originArr, setOriginArr] = useState<string>(arrondissements[0] || 'Douala 1er');
  const [destArr, setDestArr] = useState<string>(arrondissements[2] || arrondissements[1] || 'Douala 3e');

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all space-y-3">
      {/* Panel Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          {mode === 'intra' ? (
            <>
              <Navigation className="w-3.5 h-3.5 text-teal-700" />
              <span>Pricing Intra-Arrondissement : Tester tous les trajets d'un seul arrondissement (~70 trajets)</span>
            </>
          ) : (
            <>
              <ArrowRight className="w-3.5 h-3.5 text-blue-700" />
              <span>Pricing Inter-Arrondissements : Corridor d'un arrondissement A vers B (max 300 destinations)</span>
            </>
          )}
        </h3>
        <span className="text-[11px] text-slate-500">Ville : {cityName}</span>
      </div>

      {/* Panel Form Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        {mode === 'intra' ? (
          <div className="sm:col-span-8">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Sélecteur d'Arrondissement
            </label>
            <select
              value={selectedArr}
              onChange={(e) => setSelectedArr(e.target.value)}
              className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1F4F4A]"
            >
              {arrondissements.map((arr) => (
                <option key={arr} value={arr}>{arr}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Arrondissement de Départ (A)
              </label>
              <select
                value={originArr}
                onChange={(e) => setOriginArr(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1F4F4A]"
              >
                {arrondissements.map((arr) => (
                  <option key={arr} value={arr}>{arr}</option>
                ))}
              </select>
            </div>

            <div className="hidden sm:flex sm:col-span-1 justify-center pb-2.5 text-slate-400">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Arrondissement de Destination (B)
              </label>
              <select
                value={destArr}
                onChange={(e) => setDestArr(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1F4F4A]"
              >
                {arrondissements.map((arr) => (
                  <option key={arr} value={arr}>{arr}</option>
                ))}
              </select>
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
    </div>
  );
};
