import React from 'react';
import { Compass, Database, ShieldCheck } from 'lucide-react';

interface SettingsTabsHeaderProps {
  activeTab: 'yango' | 'hero' | 'tripmaster' | 'supabase' | 'admin';
  onTabChange: (tab: 'yango' | 'hero' | 'tripmaster' | 'supabase' | 'admin') => void;
}

export const SettingsTabsHeader: React.FC<SettingsTabsHeaderProps> = ({
  activeTab,
  onTabChange
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
          Paramètres des Passerelles & Base de Données
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Gestion des accès directs aux API Yango, Hero Cab Pro, Trip Master, de la base Supabase et du compte Administrateur (BD).
        </p>
      </div>

      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs flex-wrap gap-0.5">
        <button
          type="button"
          onClick={() => onTabChange('yango')}
          className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'yango'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Yango Live</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('hero')}
          className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'hero'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-teal-600" />
          <span>Hero Cab Pro</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('tripmaster')}
          className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'tripmaster'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-indigo-600" />
          <span>Trip Master</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('supabase')}
          className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'supabase'
              ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span>Base Supabase</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('admin')}
          className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'admin'
              ? 'bg-white text-purple-800 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
          <span>Compte Admin (BD)</span>
        </button>
      </div>
    </div>
  );
};
