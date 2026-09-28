import React from 'react';
import { PricingCampaign } from '../../types';
import { Activity, StopCircle, Clock, AlertCircle } from 'lucide-react';

interface PricingLiveTrackerProps {
  campaign: PricingCampaign;
  isCancelling: boolean;
  onCancelCampaign: () => void;
}

export const PricingLiveTracker: React.FC<PricingLiveTrackerProps> = ({
  campaign,
  isCancelling,
  onCancelCampaign
}) => {
  const isRunning = campaign.status === 'in_progress';
  const progressPercent =
    campaign.totalPairs > 0
      ? Math.min(100, Math.round(((campaign.completedPairs || 0) / campaign.totalPairs) * 100))
      : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Top row: Status, Title, Stop Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            {isRunning && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isRunning ? 'bg-emerald-500' : campaign.status === 'completed' ? 'bg-teal-600' : 'bg-rose-500'
              }`}
            />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900">
                {isRunning
                  ? 'Exécution Parallèle en cours'
                  : campaign.status === 'completed'
                  ? 'Campagne terminée'
                  : 'Campagne arrêtée'}
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                ({campaign.cityName})
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Traitement automatique par lots de 100 trajets
            </p>
          </div>
        </div>

        {isRunning && (
          <button
            onClick={onCancelCampaign}
            disabled={isCancelling}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <StopCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>{isCancelling ? 'Arrêt en cours...' : 'Arrêter immédiatement'}</span>
          </button>
        )}
      </div>

      {/* Progress Bar & Indicators */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              {campaign.completedPairs || 0} / {campaign.totalPairs} trajets traités
            </span>
            {campaign.totalBatches && (
              <span className="text-[11px] text-slate-400">
                (Lot {campaign.completedBatches || 0} / {campaign.totalBatches})
              </span>
            )}
          </div>
          <span className="font-bold text-[#1F4F4A]">{progressPercent}%</span>
        </div>

        {/* Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isRunning
                ? 'bg-gradient-to-r from-orange-500 via-amber-400 to-sky-400'
                : campaign.status === 'completed'
                ? 'bg-gradient-to-r from-orange-500 via-amber-400 to-sky-400'
                : 'bg-rose-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
