import React from 'react';
import {
  RotateCw,
  Clock,
  LogOut,
  MapPin,
  Menu
} from 'lucide-react';
import { CAMEROON_SLOTS } from '../data/seedData';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onQuickTrigger: () => void;
  isTriggeringAuto: boolean;
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
  onQuickTrigger,
  isTriggeringAuto,
  onToggleMobileMenu
}) => {
  const { user, logout } = useAuth();
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
        
        {/* Scheduled Slots indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{CAMEROON_SLOTS.length} cycles / jour programmés</span>
        </div>

        {/* Execute Auto-Cycle Now Button */}
        <button
          onClick={onQuickTrigger}
          disabled={isTriggeringAuto}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 shadow-2xs transition disabled:opacity-50 cursor-pointer"
          title="Déclencher immédiatement le cycle programmé"
        >
          <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isTriggeringAuto ? 'animate-spin' : ''}`} />
          <span>{isTriggeringAuto ? 'Exécution...' : 'Déclencher cycle'}</span>
        </button>

        {/* Separator */}
        <div className="h-4 w-px bg-slate-200" />

        {/* User email & Logout */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-800">
              {user?.name || user?.email?.split('@')[0] || 'Admin'}
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
            title="Se déconnecter"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </header>
  );
};
