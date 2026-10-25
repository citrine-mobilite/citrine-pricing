import React from 'react';
import {
  LogOut,
  MapPin,
  Menu,
  UserCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { PricingCampaign } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleMobileMenu?: () => void;
  activeCampaigns?: PricingCampaign[];
}

const TAB_TITLES: Record<string, string> = {
  dashboard: 'Accueil',
  statistics: 'Tableau des Statistiques & Pricing',
  shortages: 'Analyse des Pénuries & Ruptures de Trajets',
  pricing: 'Pricing & Itinéraires',
  campaigns: 'Suivi des Campagnes',
  temporal: 'Comparateur Temporel (Évolution des Prix)',
  cities: 'Villes & Régions',
  neighborhoods: 'Quartiers Urbains',
  history: 'Exportation & Rapports',
  profile: 'Mon Profil',
  users: 'Gestion des Utilisateurs',
  settings: 'Paramètres Passerelles'
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onToggleMobileMenu,
  activeCampaigns = []
}) => {
  const { user, logout } = useAuth();
  const currentTitle = TAB_TITLES[activeTab] || 'Citrine Pricing';
  const runningCamp = activeCampaigns[0];
  const progressPct = runningCamp && runningCamp.totalPairs > 0
    ? Math.min(100, Math.round(((runningCamp.completedPairs || 0) / runningCamp.totalPairs) * 100))
    : 0;

  return (
    <header className="h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between z-20 sticky top-0">
      
      {/* Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition active:scale-95 cursor-pointer"
            title="Ouvrir le menu"
            aria-label="Ouvrir le menu principal"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
            {currentTitle}
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-normal">
            <span className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-slate-400" />
              Cameroun (XAF)
            </span>
            {user?.name && (
              <>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <button
                  onClick={() => setActiveTab('profile')}
                  className="truncate max-w-[140px] sm:max-w-none text-slate-500 hover:text-[#1F4F4A] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                  title="Voir mon profil"
                >
                  <UserCircle className="w-3 h-3 text-[#1F4F4A]" />
                  <span>{user.name}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center / Right: Live Progressive Pricing Indicator */}
      {runningCamp && (
        <div 
          onClick={() => setActiveTab('pricing')}
          className="hidden md:flex items-center gap-2.5 bg-gradient-to-r from-amber-50 via-emerald-50 to-sky-50 border border-amber-300/60 px-3 py-1.5 rounded-xl cursor-pointer hover:shadow-xs transition group"
          title="Cliquez pour voir le pricing en cours"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <span className="text-[#1F4F4A]">Pricing {runningCamp.cityName} en cours</span>
              <span className="text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded-md text-[10px]">
                {runningCamp.completedPairs || 0}/{runningCamp.totalPairs || 0} ({progressPct}%)
              </span>
            </div>
            <div className="w-32 h-1.5 bg-slate-200/80 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Right Controls: PWA Install Button + Logout */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <PWAInstallButton />

        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-200 transition cursor-pointer shadow-2xs active:scale-95"
          title="Se déconnecter de l'application"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>

    </header>
  );
};
