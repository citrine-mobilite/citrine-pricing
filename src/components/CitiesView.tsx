import React, { useState } from 'react';
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
  AlertCircle
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
  const [newCityName, setNewCityName] = useState('');
  const [newCityLat, setNewCityLat] = useState('4.0511');
  const [newCityLng, setNewCityLng] = useState('9.7679');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggleActive = async (city: City) => {
    try {
      await api.updateCity(city.id, { active: !city.active });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du changement de statut.');
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
          enabled: true,
          slots: [
            '06:00', '07:00', '08:00', '09:00', '10:00',
            '11:00', '12:00', '13:00', '14:00', '15:00',
            '16:00', '17:00', '18:00', '19:00', '19:30',
            '20:00', '20:30', '21:00', '22:00'
          ]
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
            onClick={() => onLaunchPricingForCity(city.id)}
            disabled={!city.active || (city.activeNeighborhoodsCount || 0) < 2}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Pricing</span>
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
