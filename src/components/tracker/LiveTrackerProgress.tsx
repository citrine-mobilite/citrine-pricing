import React from 'react';
import { PricingCampaign } from '../../types';
import { Clock, TrendingUp, CheckCircle2 } from 'lucide-react';

interface LiveTrackerProgressProps {
  campaign: PricingCampaign;
}

export const LiveTrackerProgress: React.FC<LiveTrackerProgressProps> = ({ campaign }) => {
  const progressPercent =
    campaign.totalPairs > 0
      ? Math.min(100, Math.round(((campaign.completedPairs || 0) / campaign.totalPairs) * 100))
      : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-800">
          Progression Globale : {campaign.completedPairs || 0} / {campaign.totalPairs} trajets traités
        </span>
        <span className="text-base font-bold text-[#1F4F4A] font-mono">{progressPercent}%</span>
      </div>

      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-sky-400 rounded-full transition-all duration-300 shadow-sm"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] text-slate-400 block mb-0.5">Prix Moyen Yango</span>
          <strong className="text-slate-900 font-mono text-sm font-bold">
            {campaign.avgPrice ? `${campaign.avgPrice.toLocaleString('fr-FR')} FCFA` : '—'}
          </strong>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] text-slate-400 block mb-0.5">Moyenne Hero Cab</span>
          <strong className="text-teal-700 font-mono text-sm font-bold">
            {campaign.heroStats?.avgPrice ? `${campaign.heroStats.avgPrice.toLocaleString('fr-FR')} FCFA` : '—'}
          </strong>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] text-slate-400 block mb-0.5">Temps Écoulé</span>
          <strong className="text-slate-900 font-mono text-sm font-bold">
            {campaign.durationSeconds ? `${campaign.durationSeconds}s` : 'En cours'}
          </strong>
        </div>
      </div>
    </div>
  );
};
