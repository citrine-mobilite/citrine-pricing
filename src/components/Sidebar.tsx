import React from 'react';
import { HeroLogo } from './HeroLogo';
import { PWAInstallButton } from './PWAInstallButton';
import {
  LayoutDashboard,
  Zap,
  Activity,
  Building2,
  Compass,
  History,
  Settings,
  Users,
  Clock,
  UserCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeCampaignCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeCampaignCount = 0,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const navigation = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { id: 'pricing', label: 'Pricing', icon: Zap },
    { id: 'campaigns', label: 'Campagnes', icon: Activity, badge: activeCampaignCount > 0 ? activeCampaignCount : undefined },
    { id: 'temporal', label: 'Évolution Prix', icon: Clock },
    { id: 'cities', label: 'Villes', icon: Building2 },
    { id: 'neighborhoods', label: 'Quartiers', icon: Compass },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'profile', label: 'Mon Profil', icon: UserCircle },
    ...(isAdmin
      ? [
          { id: 'users', label: 'Utilisateurs', icon: Users },
          { id: 'settings', label: 'Paramètres', icon: Settings }
        ]
      : [])
  ];

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-[#3D8B85]/15 select-none shadow-[1px_0_4px_rgba(31,79,74,0.03)]">
      {/* Brand Header with Hero Cab Logo */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-[#3D8B85]/10 bg-white">
        <div className="flex items-center gap-2.5">
          <HeroLogo size="md" showSubtitle={true} />
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Navigation links */}
      <div className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-[#3D8B85]/10 text-[#3D8B85] border border-[#3D8B85]/25 shadow-xs font-bold'
                  : 'text-[#1F4F4A]/80 hover:text-[#1F4F4A] hover:bg-[#F0FAFA] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#3D8B85]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#D4A82F] text-slate-950 shadow-xs animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer with Logged User shortcut & PWA */}
      <div className="p-3 border-t border-[#3D8B85]/10 bg-slate-50/50 space-y-2">
        {user && (
          <button
            onClick={() => {
              setActiveTab('profile');
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white border border-slate-200/80 hover:border-[#3D8B85]/50 hover:bg-[#F0FAFA] text-left transition cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-[#1F4F4A]/10 text-[#1F4F4A] flex items-center justify-center text-xs font-bold uppercase shrink-0">
              {user.name.substring(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate group-hover:text-[#1F4F4A]">{user.name}</div>
              <div className="text-[10px] text-slate-400 capitalize">
                {user.role === 'admin' ? 'Super Admin' : user.role === 'responsable' ? 'Responsable' : 'Opérateur'}
              </div>
            </div>
          </button>
        )}
        <PWAInstallButton variant="full" className="w-full justify-center" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 z-20">
        {content}
      </aside>

      {/* Mobile drawer overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
