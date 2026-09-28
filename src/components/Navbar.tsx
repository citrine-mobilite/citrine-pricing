import React, { useState, useEffect } from 'react';
import {
  LogOut,
  MapPin,
  Menu,
  Database
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
  const { user, logout } = useAuth();
  const currentTitle = TAB_TITLES[activeTab] || 'Citrine Pricing';
  const [isLocalMode, setIsLocalMode] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/system/status')
      .then(r => r.json())
      .then(d => {
        if (d?.isFirestoreQuotaExceeded || d?.storageMode === 'local_memory') {
          setIsLocalMode(true);
        }
      })
      .catch(() => {});
  }, []);

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
        {isLocalMode ? (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
            title="Quota gratuit Firestore atteint pour aujourd'hui. L'application tourne normalement en mode mémoire locale sécurisée."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Mode Mémoire Locale
          </span>
        ) : (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
            title="Base de données Firestore opérationnelle"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Firestore Actif
          </span>
        )}

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
