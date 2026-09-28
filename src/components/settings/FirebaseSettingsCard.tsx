import React from 'react';
import { Database, Flame, CheckCircle2, RotateCw, RefreshCw, Users, Building2, Compass } from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';

interface FirebaseSettingsCardProps {
  dbStats: { userCount: number; cityCount: number; neighborhoodCount: number };
  isSeeding: boolean;
  seedSuccessMsg: string | null;
  onManualSync: () => void;
}

export const FirebaseSettingsCard: React.FC<FirebaseSettingsCardProps> = ({
  dbStats,
  isSeeding,
  seedSuccessMsg,
  onManualSync
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-900">
            Persistance Cloud Firestore & Synchronisation
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Connecté</span>
        </span>
      </div>

      <div className="p-5 space-y-4 text-xs">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-700">
            <span className="font-semibold text-slate-900">ID Projet Firebase :</span>
            <span className="font-mono text-slate-600">{firebaseConfig.projectId || 'ai-studio-project'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span className="font-semibold text-slate-900">Base Firestore :</span>
            <span className="font-mono text-slate-600">{(firebaseConfig as any).firestoreDatabaseId || '(default)'}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2.5">
            <Users className="w-4 h-4 text-blue-600" />
            <div>
              <span className="text-[10px] text-slate-400 block">Utilisateurs</span>
              <strong className="text-slate-900 font-bold">{dbStats.userCount}</strong>
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-teal-600" />
            <div>
              <span className="text-[10px] text-slate-400 block">Villes</span>
              <strong className="text-slate-900 font-bold">{dbStats.cityCount}</strong>
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="text-[10px] text-slate-400 block">Quartiers</span>
              <strong className="text-slate-900 font-bold">{dbStats.neighborhoodCount}</strong>
            </div>
          </div>
        </div>

        {seedSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-lg">
            {seedSuccessMsg}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onManualSync}
            disabled={isSeeding}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Synchronisation en cours...' : 'Forcer la synchronisation Firestore'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
