import React, { useEffect, useState } from 'react';
import { PricingCampaign } from '../types';
import { Activity, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { LiveTrackerHeader } from './tracker/LiveTrackerHeader';
import { LiveTrackerProgress } from './tracker/LiveTrackerProgress';
import { LiveTrackerTerminal } from './tracker/LiveTrackerTerminal';

interface LiveTrackerViewProps {
  campaignId: string | null;
  onNavigate: (tab: string) => void;
  onSelectCampaign: (id: string) => void;
}

export const LiveTrackerView: React.FC<LiveTrackerViewProps> = ({
  campaignId,
  onNavigate,
  onSelectCampaign
}) => {
  const [campaign, setCampaign] = useState<PricingCampaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }

    let intervalId: any;

    const fetchStatus = async () => {
      try {
        const data = await api.getCampaign(campaignId);
        if (!data) {
          clearInterval(intervalId);
          setCampaign(null);
          setIsLoading(false);
          return;
        }

        setCampaign(data);
        setIsLoading(false);

        if (data.status === 'completed' || data.status === 'cancelled' || data.status === 'failed') {
          clearInterval(intervalId);
        }
      } catch {
        clearInterval(intervalId);
        setIsLoading(false);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 800);

    return () => clearInterval(intervalId);
  }, [campaignId]);

  const handleCancel = async () => {
    if (!campaign) return;
    setIsCancelling(true);
    try {
      await api.cancelCampaign(campaign.id);
      const updated = await api.getCampaign(campaign.id);
      setCampaign(updated);
    } catch (err: any) {
      console.error('Erreur:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!campaignId || (!campaign && !isLoading)) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
        <Activity className="w-12 h-12 text-slate-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Aucune campagne active sélectionnée</h2>
        <p className="text-xs text-slate-500">
          Lancez une nouvelle campagne de pricing ou sélectionnez-en une dans l’historique pour observer sa progression en direct.
        </p>
        <button
          onClick={() => onNavigate('pricing')}
          className="inline-flex items-center gap-2 bg-[#1F4F4A] hover:bg-[#183F3B] text-white font-semibold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
        >
          <span>Aller au Hub Pricing</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (isLoading && !campaign) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Chargement de l’état de la campagne...
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <LiveTrackerHeader
          campaign={campaign}
          isCancelling={isCancelling}
          onCancel={handleCancel}
          onNavigate={onNavigate}
          onSelectCampaign={onSelectCampaign}
        />
      </div>

      <LiveTrackerProgress campaign={campaign} />
    </div>
  );
};
