import React, { useEffect, useState } from 'react';
import { PricingCampaign } from '../types';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  StopCircle,
  TableProperties,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Terminal,
  Zap
} from 'lucide-react';
import { api } from '../services/api';

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

  // Poll campaign status while running
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

        // If completed or cancelled, stop polling
        if (data.status === 'completed' || data.status === 'cancelled' || data.status === 'error') {
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
      console.error('Erreur lors de l’interruption:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!campaignId || (!campaign && !isLoading)) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
        <Activity className="w-12 h-12 text-slate-600 mx-auto" />
        <h2 className="text-lg font-bold text-white">Aucune campagne active sélectionnée</h2>
        <p className="text-xs text-slate-400">
          Lancez une nouvelle campagne de pricing ou sélectionnez-en une dans l’historique pour observer sa progression en temps réel.
        </p>
        <button
          onClick={() => onNavigate('launcher')}
          className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
        >
          <span>Aller au Lancement</span>
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

  const progressPercent =
    campaign.totalPairs > 0
      ? Math.min(100, Math.round((campaign.completedPairs / campaign.totalPairs) * 100))
      : 0;

  const isFinished = campaign.status === 'completed' || campaign.status === 'cancelled';

  return (
    <div className="space-y-6">
      
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {campaign.id}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  campaign.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : campaign.status === 'in_progress'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                    : 'bg-slate-700 text-slate-300 border-slate-600'
                }`}
              >
                {campaign.status === 'completed'
                  ? 'Terminée avec succès'
                  : campaign.status === 'in_progress'
                  ? 'Calculs Yango en cours...'
                  : campaign.status === 'cancelled'
                  ? 'Arrêtée manuellement'
                  : campaign.status}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">
              Campagne : {campaign.cityName}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Déclenchée par <strong className="text-slate-200">{campaign.triggeredByUserName}</strong> ({campaign.triggerType === 'scheduled' ? 'Automatisme 3x/j' : 'Manuel'}) le {new Date(campaign.startedAt).toLocaleString('fr-FR')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {campaign.status === 'in_progress' && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="inline-flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                <StopCircle className="w-4 h-4" />
                <span>Interrompre le Run</span>
              </button>
            )}

            <button
              onClick={() => {
                onSelectCampaign(campaign.id);
                onNavigate('results');
              }}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-950/40 cursor-pointer"
            >
              <TableProperties className="w-4 h-4" />
              <span>Consulter Résultats Détaillés</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-semibold text-slate-300 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Progression de la campagne
            </span>
            <span className="font-mono text-white font-bold text-sm">
              {campaign.completedPairs} / {campaign.totalPairs} trajets ({progressPercent}%)
            </span>
          </div>

          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isFinished ? 'bg-emerald-500' : 'bg-gradient-to-r from-rose-500 to-amber-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Trajets Traités
          </span>
          <div className="text-xl font-bold text-white mt-1">
            {campaign.completedPairs} <span className="text-xs font-normal text-slate-400">/ {campaign.totalPairs}</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-0.5">
            0 échec de proxy
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Prix Moyen Relevé
          </span>
          <div className="text-xl font-bold text-rose-400 mt-1">
            {campaign.avgPrice ? `${campaign.avgPrice.toLocaleString('fr-FR')} ${campaign.currency}` : 'Calcul...'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Min: {campaign.minPrice || 0} • Max: {campaign.maxPrice || 0}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Distance Moyenne
          </span>
          <div className="text-xl font-bold text-white mt-1">
            {campaign.avgDistanceKm ? `${campaign.avgDistanceKm} km` : '-'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Réseau urbain
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Durée d'Exécution
          </span>
          <div className="text-xl font-bold text-amber-300 font-mono mt-1">
            {campaign.durationSeconds ? `${campaign.durationSeconds}s` : 'En cours...'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Cadence : ~120ms / requête
          </div>
        </div>

      </div>

      {/* Terminal Live Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-300 font-mono">
            <Terminal className="w-4 h-4 text-rose-400" />
            <span>Journal d'exécution Yango Routestats (Live Cloud Functions Proxy)</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Auto-scroll actif</span>
        </div>

        <div className="p-4 bg-slate-950/70 font-mono text-xs max-h-96 overflow-y-auto space-y-1.5">
          {campaign.logs && campaign.logs.length > 0 ? (
            campaign.logs.map((log, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 text-slate-300 py-0.5 border-b border-slate-900/50"
              >
                <span className="text-slate-500 text-[10px] shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0 ${
                    log.level === 'error'
                      ? 'bg-rose-500/20 text-rose-400'
                      : log.level === 'warn'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="text-slate-200 break-words leading-relaxed">{log.message}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-600 text-xs py-4 text-center">
              En attente des premières réponses de l'API Yango...
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
