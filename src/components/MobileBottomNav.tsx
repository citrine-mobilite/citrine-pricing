import React from 'react';
import {
  LayoutDashboard,
  Zap,
  Activity,
  Clock,
  Menu
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeCampaignCount?: number;
  onOpenMenu: () => void;
  isPricingRunning?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  activeCampaignCount = 0,
  onOpenMenu,
  isPricingRunning = false
}) => {
  const items = [
    {
      id: 'dashboard',
      label: 'Accueil',
      icon: LayoutDashboard,
      onClick: () => setActiveTab('dashboard')
    },
    {
      id: 'pricing',
      label: 'Pricing',
      icon: Zap,
      badge: isPricingRunning ? 'LIVE' : undefined,
      onClick: () => setActiveTab('pricing')
    },
    {
      id: 'campaigns',
      label: 'Campagnes',
      icon: Activity,
      countBadge: activeCampaignCount > 0 ? activeCampaignCount : undefined,
      onClick: () => setActiveTab('campaigns')
    },
    {
      id: 'temporal',
      label: 'Évolution',
      icon: Clock,
      onClick: () => setActiveTab('temporal')
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: Menu,
      onClick: onOpenMenu
    }
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-3px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Navigation mobile"
    >
      <div className="grid grid-cols-5 h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center py-1 transition-all active:scale-90 cursor-pointer ${
                isActive
                  ? 'text-[#1F4F4A] font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-[#1F4F4A]' : ''
                  }`}
                />
                
                {/* Active Live Tag */}
                {item.badge && (
                  <span className="absolute -top-1.5 -right-3 text-[8px] font-black px-1 py-0.2 rounded-full bg-[#D4A82F] text-slate-950 animate-pulse">
                    {item.badge}
                  </span>
                )}

                {/* Campaign count badge */}
                {item.countBadge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 text-[9px] font-bold w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    {item.countBadge}
                  </span>
                )}
              </div>

              <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'font-bold text-[#1F4F4A]' : 'font-medium'}`}>
                {item.label}
              </span>

              {/* Indicator bar */}
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 rounded-full bg-[#1F4F4A]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
