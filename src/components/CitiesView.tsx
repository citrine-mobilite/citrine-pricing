import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { City } from '../types';
import { api } from '../services/api';
import { DataTable, Column } from './DataTable';
import {
  Building2,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Compass,
  ToggleLeft,
  ToggleRight,
  X,
  AlertCircle,
  Zap,
  Edit3
} from 'lucide-react';

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
      setErrorMsg(err.message || 'Erreur lors de la modification de la ville.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchModalChoice = async (cityId: string, mode: 'navigate' | 'sample_25' | 'full') => {
    const targetCity = cities.find(c => c.id === cityId);
    if (!targetCity || !targetCity.active) {
      Swal.fire({
        icon: 'warning',
        title: 'Ville inactive',
        text: 'Impossible de lancer un pricing sur une ville inactive.',
        confirmButtonColor: '#1F4F4A'
      });
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
        sampleLimit: mode === 'sample_25' ? 25 : 'all'
      });
      setSelectedCityForLaunch(null);
      onLaunchPricingForCity(cityId);
      onRefresh();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur au lancement',
        text: err.message || 'Erreur lors du lancement de la tarification.',
        confirmButtonColor: '#DC2626'
      });
    } finally {
      setIsStartingCampaign(false);
    }
  };

  const handleToggleActive = async (city: City) => {
    try {
      await api.updateCity(city.id, { active: !city.active });
      onRefresh();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: err.message || 'Erreur lors du changement de statut.',
        confirmButtonColor: '#DC2626'
      });
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
        currency: 'XAF',
        currencySymbol: 'FCFA',
        center: {
          lat: parseFloat(newCityLat),
          lng: parseFloat(newCityLng)
        },
        autoSchedule: {
          enabled: false,
          slots: []
        }
      });
      setShowAddModal(false);
      setNewCityName('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création de la ville.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // DataTable columns
  const columns: Column<any>[] = [
    {
      key: 'name',
      label: 'Ville (Cameroun)',
      sortable: true,
      render: (city) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div>
            <span className="font-semibold text-slate-900">{city.name}</span>
            <span className="text-[10px] text-slate-400 block">Cameroun</span>
          </div>
        </div>
      )
    },
    {
      key: 'neighborhoodsCount',
      label: 'Quartiers',
      sortable: true,
      render: (city) => (
        <div>
          <div className="font-medium text-slate-800">
            {city.activeNeighborhoodsCount || 0} actifs{' '}
            <span className="text-slate-400 text-[11px]">
              / {city.neighborhoodsCount || 0}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            {city.possiblePairs || 0} paires combinatoires
          </div>
        </div>
      ),
      exportValue: (c) => `${c.activeNeighborhoodsCount || 0}/${c.neighborhoodsCount || 0}`
    },
    {
      key: 'active',
      label: 'Statut',
      sortable: true,
      render: (city) => (
        <button
          onClick={() => handleToggleActive(city)}
          className="inline-flex items-center gap-1.5 cursor-pointer text-left"
          title="Cliquer pour activer ou désactiver la ville"
        >
          {city.active ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              <XCircle className="w-3 h-3 text-slate-400" />
              Inactive
            </span>
          )}
        </button>
      ),
      exportValue: (c) => (c.active ? 'Active' : 'Inactive')
    },
    {
      key: 'lastRunAt',
      label: 'Dernier Pricing',
      sortable: true,
      render: (city) => {
        const lastRun = city.autoSchedule?.lastRunAt;
        if (!lastRun) {
          return <span className="text-slate-400 text-[11px]">Aucun</span>;
        }
        return (
          <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>
              {new Date(lastRun).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        );
      },
      exportValue: (c) => c.autoSchedule?.lastRunAt || 'Aucun'
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (city) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onSelectCityNeighborhoods(city.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition hover:border-slate-300 cursor-pointer"
          >
            <Compass className="w-3 h-3 text-slate-500" />
            <span>Quartiers</span>
          </button>

          <button
            onClick={() => openEditModal(city)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition hover:border-slate-300 cursor-pointer"
            title={`Modifier les informations de ${city.name}`}
          >
            <Edit3 className="w-3 h-3 text-slate-500" />
            <span>Modifier</span>
          </button>

          <button
            onClick={() => setSelectedCityForLaunch(city)}
            disabled={!city.active || (city.activeNeighborhoodsCount || 0) < 2}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#183F3B] rounded-lg shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title={!city.active ? 'Activez la ville pour lancer un pricing' : ((city.activeNeighborhoodsCount || 0) < 2 ? 'Ajoutez au moins 2 quartiers actifs' : `Lancer le pricing sur ${city.name}`)}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Lancer Pricing</span>
          </button>
        </div>
      ),
      exportValue: () => ''
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title & Add Button */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Villes du Cameroun
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter une ville</span>
        </button>
      </div>

      {/* Modern Compact DataTable */}
      <DataTable
        columns={columns}
        data={cities}
        searchPlaceholder="Rechercher une ville du Cameroun..."
        searchKeys={['name', 'country']}
        exportFileName="villes_cameroun_citrine"
        exportTitle="Liste des Villes VTC Cameroun - Citrine Pricing"
        exportSubtitle="Statut opérationnel et combinatoire des quartiers"
        pageSizeOptions={[25, 50, 100, 250]}
        defaultPageSize={25}
        emptyMessage="Aucune ville enregistrée."
      />

      {/* City Pricing Launch Modal */}
      {selectedCityForLaunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Lancer une tarification sur {selectedCityForLaunch.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCityForLaunch.activeNeighborhoodsCount || 0} quartiers actifs • {(selectedCityForLaunch.possiblePairs || 0).toLocaleString('fr-FR')} paires départ/arrivée
                </p>
              </div>
              <button
                onClick={() => setSelectedCityForLaunch(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 pt-2">
              {/* Option 1: Test Rapide 25 */}
              <button
                onClick={() => handleLaunchModalChoice(selectedCityForLaunch.id, 'sample_25')}
                disabled={isStartingCampaign}
                className="w-full text-left p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 fill-amber-500 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      ⚡ Test Rapide (25 trajets)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Échantillon instantané pour vérifier les tarifs en direct
                    </div>
                  </div>
                </div>
                <Play className="w-3.5 h-3.5 text-amber-700 group-hover:translate-x-0.5 transition" />
              </button>

              {/* Option 2: Campagne Complète */}
              <button
                onClick={() => handleLaunchModalChoice(selectedCityForLaunch.id, 'full')}
                disabled={isStartingCampaign}
                className="w-full text-left p-3.5 rounded-xl border border-[#3D8B85]/30 bg-[#F0FAFA] hover:bg-[#E2F5F3] transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#3D8B85]/20 text-[#1F4F4A] flex items-center justify-center shrink-0">
                    <Play className="w-4 h-4 fill-current text-[#1F4F4A]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      🚀 Campagne Complète ({(selectedCityForLaunch.possiblePairs || 0).toLocaleString('fr-FR')} trajets)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Relevé exhaustif de toutes les permutations en parallèle
                    </div>
                  </div>
                </div>
                <Play className="w-3.5 h-3.5 text-[#1F4F4A] group-hover:translate-x-0.5 transition" />
              </button>

              {/* Option 3: Aller à l'onglet Pricing */}
              <button
                onClick={() => handleLaunchModalChoice(selectedCityForLaunch.id, 'navigate')}
                disabled={isStartingCampaign}
                className="w-full text-center py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Ouvrir la page Pricing pour configurer d'abord
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit City Modal */}
      {editingCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#1F4F4A]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Modifier la ville
                </h3>
              </div>
              <button
                onClick={() => setEditingCity(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCity} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom de la ville
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#3D8B85] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#3D8B85] focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#3D8B85] focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Devise
                </label>
                <input
                  type="text"
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#3D8B85] focus:bg-white font-mono uppercase"
                />
              </div>

              {/* Status Toggle Switch */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Statut de la ville
                </label>
                <button
                  type="button"
                  onClick={() => setEditActive(!editActive)}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    editActive
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {editActive ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-xs font-bold">
                      {editActive ? 'Ville Active (Tarification autorisée)' : 'Ville Inactive (Verrouillée)'}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold underline">
                    {editActive ? 'Désactiver' : 'Activer'}
                  </span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCity(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#183F3B] rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add City Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                Ajouter une ville (Cameroun)
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateCity} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom de la ville
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Garoua, Bamenda, Maroua..."
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newCityLat}
                    onChange={(e) => setNewCityLat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-600 focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newCityLng}
                    onChange={(e) => setNewCityLng(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-600 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer la ville'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
