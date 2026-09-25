import React, { useState } from 'react';
import { City } from '../types';
import {
  Clock,
  Play,
  CheckCircle2,
  Calendar,
  Building2,
  Sparkles,
  Zap,
  RefreshCw,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';

interface SchedulerViewProps {
  cities: City[];
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
}

export const SchedulerView: React.FC<SchedulerViewProps> = ({
  cities,
  onRefresh,
  onNavigate
}) => {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerReport, setTriggerReport] = useState<any>(null);

  const handleTriggerNow = async () => {
    setIsTriggering(true);
    setTriggerReport(null);

    try {
      const res = await api.triggerScheduledPricing();
      setTriggerReport(res);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du déclenchement.');
    } finally {
      setIsTriggering(false);
    }
  };

  const toggleCityScheduler = async (city: City) => {
    try {
      await api.updateCity(city.id, {
        autoSchedule: {
          enabled: !city.autoSchedule?.enabled,
          slots: city.autoSchedule?.slots || ['08:00', '13:00', '18:00']
        }
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Planification Automatique 3x par Jour
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Exécution programmée des benchmarks Yango aux heures clés pour capter la volatilité et les majorations (surge).
          </p>
        </div>

        <button
          onClick={handleTriggerNow}
          disabled={isTriggering}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-amber-950/40 transition cursor-pointer disabled:opacity-50"
        >
          {isTriggering ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span>Déclencher le cycle automatique maintenant</span>
        </button>
      </div>

      {triggerReport && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
          <div className="font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Cycle automatique exécuté avec succès !</span>
          </div>
          <div>
            {triggerReport.triggeredCount} ville(s) mise(s) à jour : {triggerReport.cities.join(', ')}
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-white underline font-semibold mt-1 inline-block"
          >
            Consulter les nouvelles campagnes créées ➔
          </button>
        </div>
      )}

      {/* 3 Slots Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
              Créneau 1
            </span>
            <span className="text-lg font-mono font-bold text-white">08:00</span>
          </div>
          <h3 className="text-sm font-semibold text-white">Heure de Pointe du Matin</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Mesure la pression de la demande lors des départs vers les centres d'affaires (Plateau, Bonanjo, etc.).
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Actif sur toutes les villes configurées</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              Créneau 2
            </span>
            <span className="text-lg font-mono font-bold text-white">13:00</span>
          </div>
          <h3 className="text-sm font-semibold text-white">Créneau Méridien / Déjeuner</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Permet d'évaluer le tarif de base hors pointe, avec fluidité de trafic et disponibilité optimale de chauffeurs.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Actif sur toutes les villes configurées</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
              Créneau 3
            </span>
            <span className="text-lg font-mono font-bold text-white">18:00</span>
          </div>
          <h3 className="text-sm font-semibold text-white">Heure de Pointe du Soir</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Analyse les fortes majorations dynamiques (surge pricing) lors des retours de bureaux vers les zones résidentielles.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Actif sur toutes les villes configurées</span>
          </div>
        </div>

      </div>

      {/* City-by-city Scheduler Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-white mb-1">
          Activation par Ville Opérée
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Activez ou désactivez la collecte automatique 3x/jour pour chaque ville indépendamment.
        </p>

        <div className="space-y-3">
          {cities.map((city) => (
            <div
              key={city.id}
              className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-800"
            >
              <div className="flex items-center space-x-3">
                <Building2 className="w-5 h-5 text-rose-500" />
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{city.name}</span>
                    <span className="text-xs text-slate-400 font-normal">({city.country})</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {city.autoSchedule?.lastRunAt ? (
                      <span>
                        Dernière exécution : {new Date(city.autoSchedule.lastRunAt).toLocaleString('fr-FR')}
                      </span>
                    ) : (
                      <span>Aucun run automatique enregistré</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleCityScheduler(city)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    city.autoSchedule?.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {city.autoSchedule?.enabled ? '✓ Planifié 3x/jour' : '✕ Désactivé'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
