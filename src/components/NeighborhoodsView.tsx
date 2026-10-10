import React, { useState, useMemo, useEffect } from 'react';
import { City, Neighborhood } from '../types';
import { api } from '../services/api';
import { NeighborhoodsHeader } from './neighborhoods/NeighborhoodsHeader';
import { NeighborhoodModal } from './neighborhoods/NeighborhoodModal';
import { NeighborhoodExcelImportModal } from './neighborhoods/NeighborhoodExcelImportModal';
import { NeighborhoodQuickInfo } from './neighborhoods/NeighborhoodQuickInfo';
import { NeighborhoodsTable } from './neighborhoods/NeighborhoodsTable';
import { getNeighborhoodCity, getNeighborhoodCityId } from '../utils/routeMatrix';

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
  // Filters State : Ville, Département, Arrondissement, Statut, Recherche
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>(selectedCityId || 'city_douala');
  const [selectedDepartement, setSelectedDepartement] = useState<string>('all');
  const [selectedArrondissement, setSelectedArrondissement] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Keep in sync with parent selectedCityId
  useEffect(() => {
    if (selectedCityId) {
      setSelectedCityFilter(selectedCityId);
      setSelectedDepartement('all');
      setSelectedArrondissement('all');
    }
  }, [selectedCityId]);

  const handleCityFilterChange = (newCityId: string) => {
    setSelectedCityFilter(newCityId);
    setSelectedDepartement('all');
    setSelectedArrondissement('all');
    if (newCityId !== 'all') {
      onSelectCityId(newCityId);
    }
  };

  const handleDepartementFilterChange = (newDep: string) => {
    setSelectedDepartement(newDep);
    setSelectedArrondissement('all');
  };

  const handleResetFilters = () => {
    setSelectedCityFilter('all');
    setSelectedDepartement('all');
    setSelectedArrondissement('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  // Determine current active city for contextual actions (Add/Import/Seeding)
  const currentCity = useMemo(() => {
    if (selectedCityFilter && selectedCityFilter !== 'all') {
      return cities.find((c) => c.id === selectedCityFilter) || cities[0];
    }
    return cities.find((c) => c.id === selectedCityId) || cities[0] || {
      id: selectedCityId || 'default_city',
      name: 'Ville active',
      country: 'Cameroun',
      currency: 'XAF',
      currencySymbol: 'FCFA',
      active: true,
      center: { lat: 4.0511, lng: 9.7679 },
      autoSchedule: { enabled: false, slots: [] }
    };
  }, [cities, selectedCityFilter, selectedCityId]);

  // 1. Filtrage préalable par Ville (100% dynamique pour n'importe quelle ville actuelle ou future)
  const cityFilteredNeighborhoods = useMemo(() => {
    if (selectedCityFilter === 'all') {
      return neighborhoods;
    }
    const targetCity = cities.find((c) => c.id === selectedCityFilter);
    const targetKey = selectedCityFilter.toLowerCase().trim();
    const targetName = targetCity?.name.toLowerCase().trim();
    return neighborhoods.filter((n) => {
      if (n.cityId === selectedCityFilter) return true;
      const cId = getNeighborhoodCityId(n);
      if (cId === targetKey || cId.includes(targetKey)) return true;
      if (targetName) {
        const v = (n.ville || n.cityName || '').toLowerCase().trim();
        if (v === targetName || v.includes(targetName)) return true;
      }
      return false;
    });
  }, [neighborhoods, selectedCityFilter, cities]);

  // 2. Extraire dynamiquement les départements pour la sélection actuelle
  const availableDepartements = useMemo(() => {
    const deps = new Set<string>();
    cityFilteredNeighborhoods.forEach((n) => {
      const dep = (n.departement || '').trim();
      if (dep) deps.add(dep);
    });
    return Array.from(deps).sort();
  }, [cityFilteredNeighborhoods]);

  // 3. Extraire dynamiquement les arrondissements pour la sélection actuelle
  const availableArrondissements = useMemo(() => {
    const arrs = new Set<string>();
    cityFilteredNeighborhoods.forEach((n) => {
      if (selectedDepartement !== 'all') {
        const dep = (n.departement || '').trim().toLowerCase();
        if (dep !== selectedDepartement.toLowerCase()) return;
      }
      const arr = (n.arrondissement || '').trim();
      if (arr) arrs.add(arr);
    });
    return Array.from(arrs).sort();
  }, [cityFilteredNeighborhoods, selectedDepartement]);

  // 4. Filtrage complet multi-critères : Ville x Département x Arrondissement x Statut x Recherche
  const filteredNeighborhoods = useMemo(() => {
    return cityFilteredNeighborhoods.filter((nb) => {
      // Filtre département
      if (selectedDepartement !== 'all') {
        const dep = (nb.departement || '').trim().toLowerCase();
        if (dep !== selectedDepartement.toLowerCase()) return false;
      }

      // Filtre arrondissement
      if (selectedArrondissement !== 'all') {
        const targetArr = selectedArrondissement.toLowerCase().trim();
        const arr = (nb.arrondissement || '').toLowerCase();
        if (!arr.includes(targetArr)) return false;
      }

      // Filtre statut
      if (statusFilter === 'active' && !nb.active) return false;
      if (statusFilter === 'inactive' && nb.active) return false;

      // Filtre recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inName = (nb.name || '').toLowerCase().includes(q);
        const inAddr = (nb.fullAddress || '').toLowerCase().includes(q);
        const inZone = (nb.zone || nb.zoneType || '').toLowerCase().includes(q);
        const inArr = (nb.arrondissement || '').toLowerCase().includes(q);
        const inDep = (nb.departement || '').toLowerCase().includes(q);
        const inVille = (nb.ville || nb.cityName || '').toLowerCase().includes(q);
        if (!inName && !inAddr && !inZone && !inArr && !inDep && !inVille) return false;
      }

      return true;
    });
  }, [cityFilteredNeighborhoods, selectedDepartement, selectedArrondissement, statusFilter, searchQuery]);

  const activeFilteredNeighborhoods = useMemo(() => {
    return filteredNeighborhoods.filter((n) => n.active);
  }, [filteredNeighborhoods]);

  // Add / Edit Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [newNbVille, setNewNbVille] = useState(currentCity?.name || '');
  const [newNbDepartement, setNewNbDepartement] = useState(availableDepartements[0] || '');
  const [newNbArrondissement, setNewNbArrondissement] = useState(availableArrondissements[0] || '');
  const [newNbFullAddress, setNewNbFullAddress] = useState('');
  const [newNbLat, setNewNbLat] = useState(currentCity?.center?.lat ? String(currentCity.center.lat) : '4.0531');
  const [newNbLng, setNewNbLng] = useState(currentCity?.center?.lng ? String(currentCity.center.lng) : '9.7028');
  const [newNbZone, setNewNbZone] = useState('commercial');
  const [newNbStatus, setNewNbStatus] = useState('actif');
  const [newNbActive, setNewNbActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAddModal = () => {
    setNewNbName('');
    setNewNbVille(currentCity?.name || '');
    setNewNbDepartement(availableDepartements[0] || '');
    setNewNbArrondissement(availableArrondissements[0] || '');
    setNewNbFullAddress('');
    setNewNbLat(currentCity?.center?.lat ? String(currentCity.center.lat) : '4.0531');
    setNewNbLng(currentCity?.center?.lng ? String(currentCity.center.lng) : '9.7028');
    setNewNbZone('commercial');
    setNewNbStatus('actif');
    setNewNbActive(true);
    setShowAddModal(true);
  };

  const [editingNb, setEditingNb] = useState<Neighborhood | null>(null);
  const [editNbName, setEditNbName] = useState('');
  const [editNbVille, setEditNbVille] = useState('');
  const [editNbDepartement, setEditNbDepartement] = useState('');
  const [editNbArrondissement, setEditNbArrondissement] = useState('');
  const [editNbFullAddress, setEditNbFullAddress] = useState('');
  const [editNbLat, setEditNbLat] = useState('4.0531');
  const [editNbLng, setEditNbLng] = useState('9.7028');
  const [editNbZone, setEditNbZone] = useState('commercial');
  const [editNbStatus, setEditNbStatus] = useState('actif');
  const [editNbActive, setEditNbActive] = useState(true);
  const [editNbCityId, setEditNbCityId] = useState(String(currentCity?.id || 'city_douala'));
  const [editError, setEditError] = useState<string | null>(null);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isLoadingOfficial, setIsLoadingOfficial] = useState(false);

  const openEditModal = (nb: Neighborhood) => {
    setEditingNb(nb);
    setEditNbName(nb.name);
    setEditNbVille(nb.ville || nb.cityName || currentCity?.name || '');
    setEditNbDepartement(nb.departement || availableDepartements[0] || '');
    setEditNbArrondissement(nb.arrondissement || '');
    setEditNbFullAddress(nb.fullAddress || `${nb.name}, ${nb.arrondissement || ''}`);
    setEditNbLat(nb.lat.toString());
    setEditNbLng(nb.lng.toString());
    setEditNbZone(nb.zone || nb.zoneType || 'commercial');
    setEditNbStatus(typeof nb.status === 'string' ? nb.status : (nb.active !== false ? 'actif' : 'inactif'));
    setEditNbActive(nb.active ?? true);
    setEditNbCityId(String(nb.cityId || currentCity?.id || ''));
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
        ville: editNbVille.trim() || currentCity?.name || '',
        departement: editNbDepartement.trim() || availableDepartements[0] || '',
        arrondissement: editNbArrondissement.trim(),
        fullAddress: editNbFullAddress.trim() || `${editNbName.trim()}, ${editNbArrondissement.trim()}`,
        lat: parseFloat(editNbLat) || editingNb.lat,
        lng: parseFloat(editNbLng) || editingNb.lng,
        zone: editNbZone,
        zoneType: editNbZone as any,
        status: editNbStatus,
        active: editNbActive,
        cityId: String(editNbCityId)
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
        cityId: String(currentCity?.id || cities[0]?.id || ''),
        name: newNbName.trim(),
        ville: newNbVille.trim() || currentCity?.name || '',
        departement: newNbDepartement.trim() || availableDepartements[0] || '',
        arrondissement: newNbArrondissement.trim(),
        fullAddress: newNbFullAddress.trim() || `${newNbName.trim()}, ${newNbArrondissement.trim()}`,
        lat: parseFloat(newNbLat),
        lng: parseFloat(newNbLng),
        zone: newNbZone,
        zoneType: newNbZone as any,
        status: newNbStatus,
        active: newNbActive
      });
      setShowAddModal(false);
      setNewNbName('');
      setNewNbFullAddress('');
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

  const handleDelete = async (nbId: string | number) => {
    if (!confirm('Supprimer ce quartier ?')) return;
    try {
      await api.deleteNeighborhood(nbId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    }
  };

  const handleBatchToggle = async (activeState: boolean) => {
    if (selectedCityFilter !== 'all' && currentCity?.id) {
      try {
        await api.batchToggleNeighborhoods(String(currentCity.id), activeState);
        onRefresh();
      } catch (err: any) {
        alert(err.message || 'Erreur.');
      }
    } else {
      // Activer/Désactiver pour toutes les villes
      try {
        await Promise.all(cities.map((c) => api.batchToggleNeighborhoods(String(c.id), activeState)));
        onRefresh();
      } catch (err: any) {
        alert(err.message || 'Erreur.');
      }
    }
  };

  const handleClearCityNeighborhoods = async () => {
    if (!currentCity?.id || selectedCityFilter === 'all') return;
    if (!confirm(`Voulez-vous vraiment vider tous les quartiers de ${currentCity.name} ?`)) return;
    try {
      await api.clearCityNeighborhoods(String(currentCity.id));
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    }
  };

  const handleReloadOfficialDouala = async () => {
    if (!currentCity?.id) return;
    try {
      setIsLoadingOfficial(true);
      await api.seedCityNeighborhoods(String(currentCity.id));
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    } finally {
      setIsLoadingOfficial(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Multi-filters */}
      <NeighborhoodsHeader
        cities={cities}
        currentCity={currentCity}
        selectedCityId={selectedCityFilter}
        onSelectCityId={handleCityFilterChange}
        availableDepartements={availableDepartements}
        selectedDepartement={selectedDepartement}
        onSelectDepartement={handleDepartementFilterChange}
        availableArrondissements={availableArrondissements}
        selectedArrondissement={selectedArrondissement}
        onSelectArrondissement={setSelectedArrondissement}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onResetFilters={handleResetFilters}
        filteredCount={filteredNeighborhoods.length}
        totalCityCount={cityFilteredNeighborhoods.length}
        totalGlobalCount={neighborhoods.length}
        onOpenAddModal={handleOpenAddModal}
        onOpenImportModal={() => setShowImportModal(true)}
        onBatchToggle={handleBatchToggle}
        onClearCityNeighborhoods={handleClearCityNeighborhoods}
        onReloadOfficialDouala={handleReloadOfficialDouala}
        isLoadingOfficial={isLoadingOfficial}
      />

      {/* Warning if current selected city is deactivated */}
      {selectedCityFilter !== 'all' && !currentCity?.active && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5 shadow-2xs">
          <span className="font-semibold text-amber-900 shrink-0">⚠️ Ville désactivée :</span>
          <span>Les quartiers de <strong>{currentCity.name}</strong> ne sont pas monitorés et les relevés de pricing y sont suspendus.</span>
        </div>
      )}

      {/* Quick Info & Matrix Count (Strict Intra-City) */}
      <NeighborhoodQuickInfo
        totalCount={filteredNeighborhoods.length}
        activeNeighborhoods={activeFilteredNeighborhoods}
        cityName={selectedCityFilter === 'all' ? 'Toutes les villes (Intra-ville strict)' : currentCity.name}
        onLaunchPricing={() => onLaunchPricingForCity(String(currentCity.id))}
      />

      {/* Data Table */}
      <NeighborhoodsTable
        neighborhoods={filteredNeighborhoods}
        cityName={selectedCityFilter === 'all' ? 'Cameroun' : currentCity.name}
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
        ville={newNbVille}
        onVilleChange={setNewNbVille}
        departement={newNbDepartement}
        onDepartementChange={setNewNbDepartement}
        arrondissement={newNbArrondissement}
        onArrondissementChange={setNewNbArrondissement}
        fullAddress={newNbFullAddress}
        onFullAddressChange={setNewNbFullAddress}
        lat={newNbLat}
        onLatChange={setNewNbLat}
        lng={newNbLng}
        onLngChange={setNewNbLng}
        zone={newNbZone}
        onZoneChange={setNewNbZone}
        status={newNbStatus}
        onStatusChange={setNewNbStatus}
        active={newNbActive}
        onActiveChange={setNewNbActive}
        cityId={String(currentCity?.id || 'city_douala')}
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
        ville={editNbVille}
        onVilleChange={setEditNbVille}
        departement={editNbDepartement}
        onDepartementChange={setEditNbDepartement}
        arrondissement={editNbArrondissement}
        onArrondissementChange={setEditNbArrondissement}
        fullAddress={editNbFullAddress}
        onFullAddressChange={setEditNbFullAddress}
        lat={editNbLat}
        onLatChange={setEditNbLat}
        lng={editNbLng}
        onLngChange={setEditNbLng}
        zone={editNbZone}
        onZoneChange={setEditNbZone}
        status={editNbStatus}
        onStatusChange={setEditNbStatus}
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
        currentCityId={String(currentCity?.id || cities[0]?.id || '')}
        existingNeighborhoods={neighborhoods}
        onSuccess={onRefresh}
      />
    </div>
  );
};
