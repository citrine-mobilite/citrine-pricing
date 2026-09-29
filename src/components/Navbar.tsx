import React from 'react';
import {
  LogOut,
  MapPin,
  Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleMobileMenu?: () => void;
}

const TAB_TITLES: Record<string, string> = {
  dashboard: 'Tableau de bord',
  pricing: 'Pricing & Itinéraires',
  campaigns: 'Suivi des Campagnes',
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
  const { logout } = useAuth();
  const currentTitle = TAB_TITLES[activeTab] || 'Citrine Pricing';

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between z-10 sticky top-0">
      
      {/* Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight truncate">
          {currentTitle}
        </h1>
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-normal">
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-400" />
            Cameroun (XAF)
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-200 transition cursor-pointer shadow-2xs"
          title="Se déconnecter de l'application"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-500" />
          <span>Déconnexion</span>
        </button>
      </div>

    </header>
  );
};
