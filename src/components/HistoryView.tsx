import React, { useState, useEffect } from 'react';
import { City, PricingCampaign, HistoryRecord } from '../types';
import { api } from '../services/api';
import { HistoryTabsHeader } from './history/HistoryTabsHeader';
import { HistoryCampaignsTab } from './history/HistoryCampaignsTab';
import { HistoryConsolidationTab } from './history/HistoryConsolidationTab';
import { HistoryAuditTab } from './history/HistoryAuditTab';

interface HistoryViewProps {
  campaigns: PricingCampaign[];
  cities: City[];
  onSelectCampaign: (campaignId: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  campaigns,
  cities,
  onSelectCampaign,
  onNavigate,
  onRefresh
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'consolidation' | 'audit'>('campaigns');
  const [cityFilter, setCityFilter] = useState<string>('');

  // Consolidation State
  const [rangePreset, setRangePreset] = useState<'today' | 'yesterday' | '7days' | '30days' | 'year' | 'custom' | 'all'>('7days');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<HistoryRecord[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('');

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await api.getHistory();
      setAuditLogs(logs);
    } catch (e) {
      console.error('Erreur chargement audit logs:', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeSubTab]);

  const handleToggleCampaignSelection = (id: string) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleAllCampaigns = (checked: boolean) => {
    if (checked) {
      setSelectedCampaignIds(campaigns.filter((c) => c.status === 'completed').map((c) => c.id));
    } else {
      setSelectedCampaignIds([]);
    }
  };

  return (
    <div className="space-y-4">
      <HistoryTabsHeader
        activeSubTab={activeSubTab}
        onTabChange={setActiveSubTab}
        campaignsCount={campaigns.length}
        auditCount={auditLogs.length}
      />

      {activeSubTab === 'campaigns' && (
        <HistoryCampaignsTab
          campaigns={campaigns}
          cities={cities}
          cityFilter={cityFilter}
          onCityFilterChange={setCityFilter}
          onSelectCampaign={onSelectCampaign}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
        />
      )}

      {activeSubTab === 'consolidation' && (
        <HistoryConsolidationTab
          campaigns={campaigns}
          cities={cities}
          cityFilter={cityFilter}
          onCityFilterChange={setCityFilter}
          rangePreset={rangePreset}
          onRangePresetChange={setRangePreset}
          customDate={customDate}
          onCustomDateChange={setCustomDate}
          selectedCampaignIds={selectedCampaignIds}
          onToggleCampaignSelection={handleToggleCampaignSelection}
          onToggleAllCampaigns={handleToggleAllCampaigns}
        />
      )}

      {activeSubTab === 'audit' && (
        <HistoryAuditTab
          auditLogs={auditLogs}
          loadingAudit={loadingAudit}
          onReload={loadAuditLogs}
          auditTypeFilter={auditTypeFilter}
          onAuditTypeFilterChange={setAuditTypeFilter}
        />
      )}
    </div>
  );
};
