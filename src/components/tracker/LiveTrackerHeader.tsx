import React from 'react';
import { PricingCampaign } from '../../types';
import { StopCircle, TableProperties, ArrowRight } from 'lucide-react';

interface LiveTrackerHeaderProps {
  campaign: PricingCampaign;
  isCancelling: boolean;
  onCancel: () => void;
  onNavigate: (tab: string) => void;
  onSelectCampaign: (id: string) => void;
}

export const LiveTrackerHeader: React.FC<LiveTrackerHeaderProps> = ({
  campaign,
  isCancelling,
  onCancel,
  onNavigate,
  onSelectCampaign
}) => {
  const isFinished = campaign.status === 'completed' || campaign.status === 'cancelled';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
            {campaign.id}
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
              campaign.status === 'completed'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : campaign.status === 'in_progress'
                ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {campaign.status === 'completed'
              ? 'Terminée avec succès'
              : campaign.status === 'in_progress'
              ? 'Calculs en cours...'
              : campaign.status === 'cancelled'
              ? 'Arrêtée manuellement'
              : campaign.status}
          </span>
        </div>

        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Suivi Temps Réel : {campaign.cityName}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Interrogation simultanée des serveurs de tarification par lots de 100 éléments.
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {campaign.status === 'in_progress' && (
          <button
            onClick={onCancel}
            disabled={isCancelling}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <StopCircle className="w-4 h-4 text-rose-600" />
            <span>{isCancelling ? 'Arrêt...' : 'Arrêter'}</span>
          </button>
        )}

        {isFinished && (
          <button
            onClick={() => {
              onSelectCampaign(campaign.id);
              onNavigate('pricing');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition cursor-pointer shadow-sm"
          >
            <TableProperties className="w-4 h-4" />
            <span>Voir les Résultats</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
