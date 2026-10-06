import React from 'react';
import { City } from '../../types';
import { X, Play, Sparkles, ArrowRight } from 'lucide-react';

interface CityLaunchChoiceModalProps {
  city: (City & { possiblePairs?: number; activeNeighborhoodsCount?: number }) | null;
  onClose: () => void;
  onChoice: (cityId: string, mode: 'navigate' | 'sample_25' | 'full') => void;
  isStartingCampaign: boolean;
}

export const CityLaunchChoiceModal: React.FC<CityLaunchChoiceModalProps> = ({
  city,
  onClose,
  onChoice,
  isStartingCampaign
}) => {
  if (!city) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A]">
            <Play className="w-5 h-5 fill-[#1F4F4A]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Lancer Pricing : {city.name}
            </h2>
            <p className="text-xs text-slate-500">
              {city.activeNeighborhoodsCount || 0} quartiers actifs • {(city.possiblePairs || 0).toLocaleString('fr-FR')} trajets
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {/* Quick 25 Sample */}
          <button
            onClick={() => onChoice(city.id, 'sample_25')}
            disabled={isStartingCampaign}
            className="w-full p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-left transition flex items-center justify-between cursor-pointer group"
          >
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-800">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Test Rapide (25 trajets)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Vérification rapide instantanée des APIs en parallèle
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition" />
          </button>

          {/* Full Benchmark */}
          <button
            onClick={() => onChoice(city.id, 'full')}
            disabled={isStartingCampaign}
            className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition flex items-center justify-between cursor-pointer group"
          >
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                <Play className="w-4 h-4 text-[#1F4F4A]" />
                <span>Campagne Complète ({(city.possiblePairs || 0).toLocaleString('fr-FR')} trajets)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tarification intégrale découpée en lots de 100 trajets
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </button>

          {/* Just Open View */}
          <button
            onClick={() => onChoice(city.id, 'navigate')}
            className="w-full py-2 text-center text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            Ouvrir simplement le tableau de bord
          </button>
        </div>
      </div>
    </div>
  );
};
