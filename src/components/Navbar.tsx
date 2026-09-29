import React from 'react';
import {
  LogOut,
  MapPin,
  Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleMobileMenu?: () => void;
}

const TAB_TITLES: Record<string, string> = {
  dashboard: 'Tableau de bord',
  pricing: 'Pricing & Itinéraires',
  campaigns: 'Suivi des Campagnes',
  temporal: 'Comparateur Temporel (Évolution des Prix)',
  cities: 'Villes & Régions',
  neighborhoods: 'Quartiers Urbains',
  history: 'Historique des Relevés',
  users: 'Gestion des Utilisateurs',
  settings: 'Paramètres Passerelles'
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onToggleMobileMenu
}) => {
  const { user, logout } = useAuth();
  const currentTitle = TAB_TITLES[activeTab] || 'Citrine Pricing';

  return (
    <header className="h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between z-20 sticky top-0">
      
      {/* Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition active:scale-95"
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
                <span className="truncate max-w-[100px] sm:max-w-none text-slate-400">{user.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

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

