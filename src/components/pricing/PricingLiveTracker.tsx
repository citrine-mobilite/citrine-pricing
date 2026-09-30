import React from 'react';
import { PricingCampaign } from '../../types';
import { StopCircle, RotateCw } from 'lucide-react';

interface PricingLiveTrackerProps {
  campaign: PricingCampaign;
  isCancelling: boolean;
  onCancelCampaign: () => void;
  onRestartCampaign?: () => void;
}

export const PricingLiveTracker: React.FC<PricingLiveTrackerProps> = ({
  campaign,
  isCancelling,
  onCancelCampaign,
  onRestartCampaign
}) => {
  const isRunning = campaign.status === 'in_progress';
  const progressPercent =
    campaign.totalPairs > 0
      ? Math.min(100, Math.round(((campaign.completedPairs || 0) / campaign.totalPairs) * 100))
      : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Top row: Status, Title, Stop / Restart Buttons */}
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
              Traitement automatique par lots de 10 trajets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isRunning ? (
            <button
              onClick={onCancelCampaign}
              disabled={isCancelling}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50 cursor-pointer min-h-[44px] sm:min-h-0 w-full sm:w-auto active:scale-95 shadow-2xs"
            >
              <StopCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{isCancelling ? 'Arrêt immédiat en cours...' : 'Arrêter immédiatement'}</span>
            </button>
          ) : (
            campaign.status !== 'completed' && onRestartCampaign && (
              <button
                onClick={onRestartCampaign}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition cursor-pointer shadow-sm min-h-[44px] sm:min-h-0 w-full sm:w-auto active:scale-95"
                title="Relancer cette campagne de tarification"
              >
                <RotateCw className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Relancer la campagne</span>
              </button>
            )
          )}
        </div>
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
                ? 'bg-emerald-500'
                : 'bg-sky-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
