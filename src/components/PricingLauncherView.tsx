import React, { useState } from 'react';
import { City, Neighborhood } from '../types';
import { PlayCircle, AlertCircle, Play } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LauncherCitySelectorCard } from './launcher/LauncherCitySelectorCard';
import { LauncherTariffClassSelector } from './launcher/LauncherTariffClassSelector';
import { LauncherSingleRouteTester } from './launcher/LauncherSingleRouteTester';

interface PricingLauncherViewProps {
  cities: City[];
  neighborhoods: Neighborhood[];
  selectedCityId: string;
  onSelectCityId: (cityId: string) => void;
  onCampaignStarted: (campaignId: string) => void;
}

export const PricingLauncherView: React.FC<PricingLauncherViewProps> = ({
  cities,
  neighborhoods,
  selectedCityId,
  onSelectCityId,
  onCampaignStarted
}) => {
  const { user } = useAuth();
  const currentCity = cities.find(c => c.id === selectedCityId) || cities[0];

  const cityNeighborhoods = neighborhoods.filter(n => n.cityId === currentCity?.id);
  const activeNeighborhoods = cityNeighborhoods.filter(n => n.active);
  const activeCount = activeNeighborhoods.length;
  const totalPairs = activeCount > 1 ? activeCount * (activeCount - 1) : 0;

  const [selectedClasses, setSelectedClasses] = useState<string[]>(['econom']);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [singleStartId, setSingleStartId] = useState<string>(activeNeighborhoods[0]?.id || '');
  const [singleEndId, setSingleEndId] = useState<string>(activeNeighborhoods[1]?.id || '');
  const [singleTestResult, setSingleTestResult] = useState<any>(null);
  const [isTestingSingle, setIsTestingSingle] = useState(false);

  const toggleClass = (tariffId: string) => {
    if (selectedClasses.includes(tariffId)) {
      if (selectedClasses.length > 1) {
        setSelectedClasses(selectedClasses.filter(c => c !== tariffId));
      }
    } else {
      setSelectedClasses([...selectedClasses, tariffId]);
    }
  };

  const handleStartCampaign = async () => {
    if (!currentCity) return;
    if (activeCount < 2) {
      setError('Au moins 2 quartiers actifs sont nécessaires pour générer les permutations Départ ➔ Arrivée.');
      return;
    }

    setIsLaunching(true);
    setError(null);

    try {
      const res = await api.startCampaign({
        cityId: currentCity.id,
        triggeredByUserId: user?.id,
        triggeredByUserName: user?.name,
        triggerType: 'manual',
        selectedClasses
      });

      onCampaignStarted(res.campaign.id);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du lancement de la campagne.');
      setIsLaunching(false);
    }
  };

  const handleRunSingleTest = async () => {
    const origin = activeNeighborhoods.find(n => n.id === singleStartId);
    const dest = activeNeighborhoods.find(n => n.id === singleEndId);
    if (!origin || !dest) return;

    setIsTestingSingle(true);
    setSingleTestResult(null);

    try {
      const res = await api.testSingleRoute({
        startLat: origin.lat,
        startLng: origin.lng,
        endLat: dest.lat,
        endLng: dest.lng,
        tariffClass: selectedClasses[0] || 'econom',
        cityCurrency: currentCity.currency
      });
      setSingleTestResult(res);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’appel Yango.');
    } finally {
      setIsTestingSingle(false);
    }
  };

  const estimatedDurationSec = Math.max(3, Math.round((totalPairs * 140) / 1000));

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-[#1F4F4A]" />
          <span>Lancement d’une Campagne de Pricing</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Génère automatiquement les paires Départ ➔ Arrivée et interroge simultanément les serveurs de tarification.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <LauncherCitySelectorCard
        cities={cities}
        currentCity={currentCity}
        onSelectCityId={onSelectCityId}
        activeCount={activeCount}
        totalPairs={totalPairs}
        estimatedDurationSec={estimatedDurationSec}
      />

      <LauncherTariffClassSelector
        selectedClasses={selectedClasses}
        onToggleClass={toggleClass}
      />

      <LauncherSingleRouteTester
        activeNeighborhoods={activeNeighborhoods}
        singleStartId={singleStartId}
        onSingleStartChange={setSingleStartId}
        singleEndId={singleEndId}
        onSingleEndChange={setSingleEndId}
        isTestingSingle={isTestingSingle}
        onRunSingleTest={handleRunSingleTest}
        singleTestResult={singleTestResult}
      />

      <div className="flex justify-end pt-2">
        <button
          onClick={handleStartCampaign}
          disabled={isLaunching || activeCount < 2}
          className="inline-flex items-center gap-2 px-6 py-3 text-xs font-bold text-white bg-[#1F4F4A] hover:bg-[#183F3B] rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>{isLaunching ? 'Démarrage...' : `Démarrer Campagne (${totalPairs.toLocaleString('fr-FR')} trajets)`}</span>
        </button>
      </div>
    </div>
  );
};
