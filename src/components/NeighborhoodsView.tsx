import React, { useState, useMemo } from 'react';
import { City, Neighborhood } from '../types';
import { api } from '../services/api';
import { NeighborhoodsHeader } from './neighborhoods/NeighborhoodsHeader';
import { NeighborhoodModal } from './neighborhoods/NeighborhoodModal';
import { NeighborhoodExcelImportModal } from './neighborhoods/NeighborhoodExcelImportModal';
import { NeighborhoodQuickInfo } from './neighborhoods/NeighborhoodQuickInfo';
import { NeighborhoodsTable } from './neighborhoods/NeighborhoodsTable';

interface NeighborhoodsViewProps {
  cities: City[];
  neighborhoods: Neighborhood[];
  selectedCityId: string;
  onSelectCityId: (cityId: string) => void;
  onRefresh: () => void;
  onLaunchPricingForCity: (cityId: string) => void;
}

export const NeighborhoodsView: React.FC<NeighborhoodsViewProps> = ({
  cities,
  neighborhoods,
  selectedCityId,
  onSelectCityId,
  onRefresh,
  onLaunchPricingForCity
}) => {
  const currentCity = cities.find((c) => c.id === selectedCityId) || cities[0] || {
    id: selectedCityId || 'city_douala',
    name: 'Sélectionner une ville',
    country: 'Cameroun',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    active: true,
    center: { lat: 4.0511, lng: 9.7679 },
    autoSchedule: { enabled: false, slots: [] }
  };
  const cityNeighborhoods = neighborhoods.filter((n) => n.cityId === currentCity?.id);
  const activeNeighborhoods = currentCity?.active ? cityNeighborhoods.filter((n) => n.active) : [];

  // Filter by Arrondissement
  const [selectedArrondissement, setSelectedArrondissement] = useState<string>('all');
  const filteredNeighborhoods = useMemo(() => {
    return cityNeighborhoods.filter((nb) => {
      if (selectedArrondissement === 'all') return true;
      return nb.name.toLowerCase().includes(selectedArrondissement.toLowerCase());
    });
  }, [cityNeighborhoods, selectedArrondissement]);

  // Add / Edit Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [newNbLat, setNewNbLat] = useState('4.0531');
  const [newNbLng, setNewNbLng] = useState('9.7028');
  const [newNbZone, setNewNbZone] = useState('commercial');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingNb, setEditingNb] = useState<Neighborhood | null>(null);
  const [editNbName, setEditNbName] = useState('');
  const [editNbLat, setEditNbLat] = useState('4.0531');
  const [editNbLng, setEditNbLng] = useState('9.7028');
  const [editNbZone, setEditNbZone] = useState('commercial');
  const [editNbActive, setEditNbActive] = useState(true);
  const [editNbCityId, setEditNbCityId] = useState(currentCity?.id || 'city_douala');
  const [editError, setEditError] = useState<string | null>(null);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isLoadingOfficial, setIsLoadingOfficial] = useState(false);

  const openEditModal = (nb: Neighborhood) => {
    setEditingNb(nb);
    setEditNbName(nb.name);
    setEditNbLat(nb.lat.toString());
    setEditNbLng(nb.lng.toString());
    setEditNbZone(nb.zoneType || 'commercial');
    setEditNbActive(nb.active ?? true);
    setEditNbCityId(nb.cityId || currentCity?.id || 'city_douala');
    setEditError(null);
  };

  const handleUpdateNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNb || !editNbName.trim()) return;
    setIsSubmitting(true);
    setEditError(null);
    try {
      await api.updateNeighborhood(editingNb.id, {
        name: editNbName.trim(),
        lat: parseFloat(editNbLat) || editingNb.lat,
        lng: parseFloat(editNbLng) || editingNb.lng,
        zoneType: editNbZone as any,
        active: editNbActive,
        cityId: editNbCityId
      });
      setEditingNb(null);
      onRefresh();
    } catch (err: any) {
      setEditError(err.message || 'Erreur lors de la modification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNbName.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createNeighborhood({
        cityId: currentCity?.id || 'city_douala',
        name: newNbName.trim(),
        lat: parseFloat(newNbLat),
        lng: parseFloat(newNbLng),
        zoneType: newNbZone as any,
        active: true
      });
      setShowAddModal(false);
      setNewNbName('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'ajout.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (nb: Neighborhood) => {
    try {
      await api.updateNeighborhood(nb.id, { active: !nb.active });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    }
  };

  const handleDelete = async (nbId: string) => {
    if (!confirm('Supprimer ce quartier ?')) return;
    try {
      await api.deleteNeighborhood(nbId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    }
  };

  const handleBatchToggle = async (activeState: boolean) => {
    if (!currentCity?.id) return;
    try {
      await api.batchToggleNeighborhoods(currentCity.id, activeState);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    }
  };

  const handleClearCityNeighborhoods = async () => {
    if (!confirm(`Voulez-vous vraiment vider tous les quartiers de ${currentCity?.name} ?`)) return;
    try {
      if (currentCity?.id) {
        await api.clearCityNeighborhoods(currentCity.id);
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    }
  };

  const handleReloadOfficialDouala = async () => {
    try {
      setIsLoadingOfficial(true);
      await api.seedCityNeighborhoods('city_douala');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    } finally {
      setIsLoadingOfficial(false);
    }
  };

  return (
    <div className="space-y-4">
      <NeighborhoodsHeader
        cities={cities}
        currentCity={currentCity}
        onSelectCityId={onSelectCityId}
        selectedArrondissement={selectedArrondissement}
        onSelectArrondissement={setSelectedArrondissement}
        onOpenAddModal={() => setShowAddModal(true)}
        onOpenImportModal={() => setShowImportModal(true)}
        onBatchToggle={handleBatchToggle}
        onClearCityNeighborhoods={handleClearCityNeighborhoods}
        onReloadOfficialDouala={handleReloadOfficialDouala}
        isLoadingOfficial={isLoadingOfficial}
      />

      {!currentCity?.active && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5 shadow-2xs">
          <span className="font-semibold text-amber-900 shrink-0">⚠️ Ville désactivée :</span>
          <span>Les quartiers de <strong>{currentCity.name}</strong> ne sont pas monitorés et les relevés de pricing y sont suspendus.</span>
        </div>
      )}

      <NeighborhoodQuickInfo
        totalCount={cityNeighborhoods.length}
        activeNeighborhoods={activeNeighborhoods}
        cityName={currentCity.name}
        onLaunchPricing={() => onLaunchPricingForCity(currentCity.id)}
      />

      <NeighborhoodsTable
        neighborhoods={filteredNeighborhoods}
        cityName={currentCity.name}
        onToggleActive={handleToggleActive}
        onOpenEditModal={openEditModal}
        onDelete={handleDelete}
      />

      {/* Add Modal */}
      <NeighborhoodModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        name={newNbName}
        onNameChange={setNewNbName}
        lat={newNbLat}
        onLatChange={setNewNbLat}
        lng={newNbLng}
        onLngChange={setNewNbLng}
        zone={newNbZone}
        onZoneChange={setNewNbZone}
        cityId={currentCity?.id || 'city_douala'}
        cities={cities}
        isSubmitting={isSubmitting}
        onSubmit={handleAddNeighborhood}
      />

      {/* Edit Modal */}
      <NeighborhoodModal
        isOpen={Boolean(editingNb)}
        onClose={() => setEditingNb(null)}
        isEditMode
        neighborhood={editingNb}
        name={editNbName}
        onNameChange={setEditNbName}
        lat={editNbLat}
        onLatChange={setEditNbLat}
        lng={editNbLng}
        onLngChange={setEditNbLng}
        zone={editNbZone}
        onZoneChange={setEditNbZone}
        active={editNbActive}
        onActiveChange={setEditNbActive}
        cityId={editNbCityId}
        onCityIdChange={setEditNbCityId}
        cities={cities}
        isSubmitting={isSubmitting}
        onSubmit={handleUpdateNeighborhood}
        error={editError}
      />

      {/* Excel Import Modal */}
      <NeighborhoodExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        cities={cities}
        currentCityId={currentCity?.id || cities[0]?.id || ''}
        onSuccess={onRefresh}
      />
    </div>
  );
};
