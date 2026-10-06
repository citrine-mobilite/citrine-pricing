import React, { useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { City } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from './DataTable';
import { Edit3, Play, Compass } from 'lucide-react';
import { CitiesHeader } from './cities/CitiesHeader';
import { CityModal } from './cities/CityModal';
import { CityLaunchChoiceModal } from './cities/CityLaunchChoiceModal';

interface CitiesViewProps {
  cities: (City & {
    neighborhoodsCount?: number;
    activeNeighborhoodsCount?: number;
    possiblePairs?: number;
  })[];
  onRefresh: () => void;
  onSelectCityNeighborhoods: (cityId: string) => void;
  onLaunchPricingForCity: (cityId: string) => void;
}

export const CitiesView: React.FC<CitiesViewProps> = ({
  cities,
  onRefresh,
  onSelectCityNeighborhoods,
  onLaunchPricingForCity
}) => {
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [editName, setEditName] = useState('');
  const [editLat, setEditLat] = useState('4.0511');
  const [editLng, setEditLng] = useState('9.7679');
  const [editActive, setEditActive] = useState(true);
  const [editCurrency, setEditCurrency] = useState('XAF');

  const [selectedCityForLaunch, setSelectedCityForLaunch] = useState<(City & { possiblePairs?: number; activeNeighborhoodsCount?: number }) | null>(null);
  const [isStartingCampaign, setIsStartingCampaign] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [newCityLat, setNewCityLat] = useState('4.0511');
  const [newCityLng, setNewCityLng] = useState('9.7679');
  const [newCityCurrency, setNewCityCurrency] = useState('XAF');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openEditModal = (city: City) => {
    setEditingCity(city);
    setEditName(city.name);
    setEditLat(city.center?.lat?.toString() || '4.0511');
    setEditLng(city.center?.lng?.toString() || '9.7679');
    setEditActive(city.active ?? true);
    setEditCurrency(city.currency || 'XAF');
    setErrorMsg(null);
  };

  const handleUpdateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCity || !editName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.updateCity(editingCity.id, {
        name: editName.trim(),
        active: editActive,
        currency: editCurrency.trim().toUpperCase(),
        center: {
          lat: parseFloat(editLat) || editingCity.center.lat,
          lng: parseFloat(editLng) || editingCity.center.lng
        }
      });
      setEditingCity(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la modification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.createCity({
        name: newCityName.trim(),
        country: 'Cameroun',
        currency: newCityCurrency.trim().toUpperCase() || 'XAF',
        currencySymbol: 'FCFA',
        active: true,
        center: {
          lat: parseFloat(newCityLat) || 4.0511,
          lng: parseFloat(newCityLng) || 9.7679
        },
        autoSchedule: { enabled: false, slots: [] }
      });
      setShowAddModal(false);
      setNewCityName('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchModalChoice = async (cityId: string, mode: 'navigate' | 'sample_25' | 'full') => {
    const targetCity = cities.find(c => c.id === cityId);
    if (!targetCity || !targetCity.active) {
      Swal.fire({ icon: 'warning', title: 'Ville inactive', text: 'Impossible de lancer un pricing sur une ville inactive.' });
      setSelectedCityForLaunch(null);
      return;
    }

    if (mode === 'navigate') {
      setSelectedCityForLaunch(null);
      onLaunchPricingForCity(cityId);
      return;
    }

    setIsStartingCampaign(true);
    try {
      await api.startCampaign({
        cityId,
        triggerType: 'manual',
        selectedClasses: ['econom'],
        sampleLimit: mode === 'sample_25' ? 25 : 'all',
        triggeredByUserId: user?.id,
        triggeredByUserName: user?.name || 'Citrine Opérateur',
        triggeredByUserRole: user?.role || 'employe'
      });
      setSelectedCityForLaunch(null);
      onLaunchPricingForCity(cityId);
      onRefresh();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Erreur au lancement.' });
    } finally {
      setIsStartingCampaign(false);
    }
  };

  const handleToggleActive = async (city: City) => {
    try {
      await api.updateCity(city.id, { active: !city.active });
      onRefresh();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Erreur.' });
    }
  };

  const columns: Column<City & { neighborhoodsCount?: number; activeNeighborhoodsCount?: number; possiblePairs?: number }>[] = useMemo(() => [
    {
      key: 'name',
      label: 'Ville & Pays',
      sortable: true,
      render: (c) => (
        <div>
          <strong className="text-slate-900 block font-semibold">{c.name}</strong>
          <span className="text-[11px] text-slate-400">{c.country}</span>
        </div>
      )
    },
    {
      key: 'neighborhoodsCount',
      label: 'Quartiers',
      sortable: true,
      render: (c) => (
        <button
          onClick={() => onSelectCityNeighborhoods(c.id)}
          className="inline-flex items-center gap-1.5 text-xs text-[#1F4F4A] hover:underline font-semibold"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>{c.activeNeighborhoodsCount || 0} / {c.neighborhoodsCount || 0} actifs</span>
        </button>
      )
    },
    {
      key: 'possiblePairs',
      label: 'Trajets possibles',
      sortable: true,
      align: 'right',
      render: (c) => (
        <span className="font-mono text-xs text-slate-700">
          {(c.possiblePairs || 0).toLocaleString('fr-FR')}
        </span>
      )
    },
    {
      key: 'currency',
      label: 'Devise',
      sortable: true,
      render: (c) => <span className="font-mono text-xs text-slate-600">{c.currency || 'XAF'}</span>
    },
    {
      key: 'active',
      label: 'Statut',
      sortable: true,
      render: (c) => (
        <button
          onClick={() => handleToggleActive(c)}
          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition ${
            c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {c.active ? 'Active' : 'Inactive'}
        </button>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedCityForLaunch(c)}
            disabled={!c.active || (c.activeNeighborhoodsCount || 0) < 2}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-40"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>Benchmark</span>
          </button>
          <button onClick={() => openEditModal(c)} className="p-1 text-slate-400 hover:text-slate-700 rounded transition">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ], [onSelectCityNeighborhoods]);

  return (
    <div className="space-y-4">
      <CitiesHeader
        totalCities={cities.length}
        activeCities={cities.filter(c => c.active).length}
        onOpenAddModal={() => setShowAddModal(true)}
        onRefresh={onRefresh}
      />

      <DataTable
        columns={columns}
        data={cities}
        searchPlaceholder="Rechercher une ville..."
        searchKeys={['name', 'country']}
        exportFileName="villes_vtc"
      />

      <CityModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        name={newCityName}
        onNameChange={setNewCityName}
        lat={newCityLat}
        onLatChange={setNewCityLat}
        lng={newCityLng}
        onLngChange={setNewCityLng}
        currency={newCityCurrency}
        onCurrencyChange={setNewCityCurrency}
        isSubmitting={isSubmitting}
        onSubmit={handleCreateCity}
        error={errorMsg}
      />

      <CityModal
        isOpen={Boolean(editingCity)}
        onClose={() => setEditingCity(null)}
        isEditMode
        name={editName}
        onNameChange={setEditName}
        lat={editLat}
        onLatChange={setEditLat}
        lng={editLng}
        onLngChange={setEditLng}
        currency={editCurrency}
        onCurrencyChange={setEditCurrency}
        active={editActive}
        onActiveChange={setEditActive}
        isSubmitting={isSubmitting}
        onSubmit={handleUpdateCity}
        error={errorMsg}
      />

      <CityLaunchChoiceModal
        city={selectedCityForLaunch}
        onClose={() => setSelectedCityForLaunch(null)}
        onChoice={handleLaunchModalChoice}
        isStartingCampaign={isStartingCampaign}
      />
    </div>
  );
};
