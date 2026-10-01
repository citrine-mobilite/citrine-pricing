import React from 'react';
import { Database, Flame, CheckCircle2, RefreshCw, Users, Building2, Compass, Download, FileCode } from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';
import { api } from '../../services/api';

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

      <div className="p-5 space-y-5 text-xs">
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

        {/* Exportation de la base de données (2 Boutons) */}
        <div className="pt-4 border-t border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
            <Download className="w-4 h-4 text-[#1F4F4A]" />
            <span>Exportation & Sauvegarde JSON de la Base de Données</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Bouton 1: Exporter la structure de la BD */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2 flex flex-col justify-between">
              <div>
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  <span>Structure de la BD (Schéma)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                  Exporte la configuration des Villes, Quartiers, Utilisateurs et Paramètres d'API (sans les relevés de tarifs).
                </p>
              </div>
              <a
                href={api.getDbStructureExportUrl()}
                download
                className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Exporter la structure de la BD</span>
              </a>
            </div>

            {/* Bouton 2: Exporter la BD et toutes ses données */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2 flex flex-col justify-between">
              <div>
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>BD et Toutes ses Données</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                  Exporte l'intégralité de la base de données : Villes, Quartiers, Utilisateurs, Historique, Campagnes et tous les relevés.
                </p>
              </div>
              <a
                href={api.getDbFullDataExportUrl()}
                download
                className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#183F3B] rounded-lg transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span>Exporter toute la BD avec données</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
