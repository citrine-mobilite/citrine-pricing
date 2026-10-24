import React from 'react';
import { PricingCampaign } from '../../types';
import { StopCircle } from 'lucide-react';

interface CampaignsActiveBannerProps {
  campaign: PricingCampaign;
  cancellingId: string | null;
  onCancel: (id: string) => void;
}

export const CampaignsActiveBanner: React.FC<CampaignsActiveBannerProps> = ({
  campaign,
  cancellingId,
  onCancel
}) => {
  const percent =
    campaign.totalPairs > 0
      ? Math.min(100, Math.round(((campaign.completedPairs || 0) / campaign.totalPairs) * 100))
      : 0;

  return (
    <div className="bg-white rounded-xl border border-blue-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] bg-gradient-to-r from-blue-50/20 to-white">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
          <strong className="text-xs font-bold text-slate-900">
            Campagne active : {campaign.cityName}
          </strong>
          <span className="text-[11px] text-slate-500 font-mono">
            ({campaign.completedPairs || 0} / {campaign.totalPairs} trajets)
          </span>
        </div>

        <button
          onClick={() => onCancel(campaign.id)}
          disabled={cancellingId === campaign.id}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50"
        >
          <StopCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>{cancellingId === campaign.id ? 'Arrêt...' : 'Arrêter'}</span>
        </button>
      </div>

      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
