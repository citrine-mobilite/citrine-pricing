import React from 'react';
import {
  LayoutDashboard,
  Zap,
  Activity,
  Building2,
  Compass,
  History,
  Settings,
  Users,
  Gem
} from 'lucide-react';

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
  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pricing', label: 'Pricing', icon: Zap },
    { id: 'campaigns', label: 'Campagnes', icon: Activity, badge: activeCampaignCount > 0 ? activeCampaignCount : undefined },
    { id: 'cities', label: 'Villes', icon: Building2 },
    { id: 'neighborhoods', label: 'Quartiers', icon: Compass },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'settings', label: 'Paramètres', icon: Settings }
  ];

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-[#3D8B85]/15 select-none shadow-[1px_0_4px_rgba(31,79,74,0.03)]">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#3D8B85]/10 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3D8B85] flex items-center justify-center shadow-sm">
            <Gem className="w-4 h-4 text-[#D4A82F] font-bold" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-[#1F4F4A]">
              Citrine Pricing
            </div>
            <div className="text-[10px] text-[#3D8B85] font-semibold tracking-wider uppercase">
              VTC Cameroun
            </div>
          </div>
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1 text-slate-400 hover:text-slate-700 rounded-lg"
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
