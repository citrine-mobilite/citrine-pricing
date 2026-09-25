import React, { useState, useRef } from 'react';
import { City, Neighborhood } from '../types';
import { api } from '../services/api';
import { DataTable, Column } from './DataTable';
import { parseNeighborhoodExcelFile } from '../utils/exportUtils';
import {
  Compass,
  Plus,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  XCircle,
  Trash2,
  Building2,
  X,
  AlertCircle,
  HelpCircle,
  FileCheck
} from 'lucide-react';

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
  const currentCity = cities.find((c) => c.id === selectedCityId) || cities[0];
  const cityNeighborhoods = neighborhoods.filter((n) => n.cityId === currentCity?.id);
  const activeCount = cityNeighborhoods.filter((n) => n.active).length;

  // Single Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [newNbLat, setNewNbLat] = useState('4.0531');
  const [newNbLng, setNewNbLng] = useState('9.7028');
  const [newNbZone, setNewNbZone] = useState<any>('commercial');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter by Arrondissement (Douala 1er à 5e)
  const [selectedArrondissement, setSelectedArrondissement] = useState<string>('all');

  const filteredCityNeighborhoods = cityNeighborhoods.filter((nb) => {
    if (selectedArrondissement === 'all') return true;
    return nb.name.toLowerCase().includes(selectedArrondissement.toLowerCase());
  });

  // Excel Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCityId, setImportCityId] = useState(currentCity?.id || cities[0]?.id || '');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleActive = async (nb: Neighborhood) => {
    try {
      await api.updateNeighborhood(nb.id, { active: !nb.active });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la modification.');
    }
  };

  const handleDelete = async (nbId: string) => {
    if (!confirm('Supprimer ce quartier ?')) return;
    try {
      await api.deleteNeighborhood(nbId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression.');
    }
  };

  const [isLoadingOfficial, setIsLoadingOfficial] = useState(false);

  const handleClearAllCityNeighborhoods = async () => {
    if (!confirm(`Voulez-vous vraiment vider tous les quartiers de ${currentCity.name} ? Cette action prépare la liste pour votre nouvel import Excel.`)) {
      return;
    }
    try {
      await api.clearCityNeighborhoods(currentCity.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du nettoyage de la liste.');
    }
  };

  const handleReloadOfficialDouala = async () => {
    try {
      setIsLoadingOfficial(true);
      await api.seedCityNeighborhoods('city_douala');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du chargement des quartiers.');
    } finally {
      setIsLoadingOfficial(false);
    }
  };

  const handleAddNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNbName.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createNeighborhood({
        cityId: currentCity.id,
        name: newNbName.trim(),
        lat: parseFloat(newNbLat),
        lng: parseFloat(newNbLng),
        zoneType: newNbZone,
        active: true
      });
      setShowAddModal(false);
      setNewNbName('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’ajout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file selection for Excel Import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsing(true);
    setImportError(null);
    setImportSuccessMsg(null);

    const parsed = await parseNeighborhoodExcelFile(file, importCityId);
    setIsParsing(false);

    if (parsed.success) {
      setParsedPreview(parsed.neighborhoods);
    } else {
      setImportError(parsed.error || 'Erreur lors de la lecture du fichier Excel.');
      setParsedPreview([]);
    }
  };

  // Confirm and save imported neighborhoods
  const handleConfirmImport = async () => {
    if (parsedPreview.length === 0) return;

    setIsSubmitting(true);
    setImportError(null);

    try {
      const res = await api.importNeighborhoodsBatch(importCityId, parsedPreview);
      setImportSuccessMsg(`${res.count} quartiers importés avec succès.`);
      setParsedPreview([]);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccessMsg(null);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      setImportError(err.message || "Erreur lors de l'enregistrement des quartiers.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // DataTable columns
  const columns: Column<Neighborhood>[] = [
    {
      key: 'name',
      label: 'Nom du Quartier',
      sortable: true,
      render: (nb) => (
        <span className="font-semibold text-slate-900">{nb.name}</span>
      )
    },
    {
      key: 'zoneType',
      label: 'Typologie Zone',
      sortable: true,
      render: (nb) => {
        const labels: Record<string, { text: string; bg: string }> = {
          commercial: { text: 'Affaires / Commercial', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
          residential: { text: 'Résidentiel', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          popular: { text: 'Populaire / Dense', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
          airport: { text: 'Aéroportuaire', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
          center: { text: 'Centre Administratif', bg: 'bg-slate-100 text-slate-700 border-slate-200' }
        };
        const badge = labels[nb.zoneType || 'commercial'] || labels.commercial;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badge.bg}`}
          >
            {badge.text}
          </span>
        );
      },
      exportValue: (nb) => nb.zoneType || 'commercial'
    },
    {
      key: 'lat',
      label: 'Latitude',
      sortable: true,
      render: (nb) => <span className="font-mono text-slate-600">{nb.lat.toFixed(4)}</span>,
      exportValue: (nb) => nb.lat
    },
    {
      key: 'lng',
      label: 'Longitude',
      sortable: true,
      render: (nb) => <span className="font-mono text-slate-600">{nb.lng.toFixed(4)}</span>,
      exportValue: (nb) => nb.lng
    },
    {
      key: 'active',
      label: 'Statut',
      sortable: true,
      render: (nb) => (
        <button
          onClick={() => handleToggleActive(nb)}
          className="inline-flex items-center gap-1.5 cursor-pointer text-left"
          title="Cliquer pour activer/désactiver ce quartier du calcul"
        >
          {nb.active ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Actif (Tarifé)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              <XCircle className="w-3 h-3 text-slate-400" />
              Exclu
            </span>
          )}
        </button>
      ),
      exportValue: (nb) => (nb.active ? 'Actif' : 'Inactif')
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (nb) => (
        <button
          onClick={() => handleDelete(nb.id)}
          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
          title="Supprimer le quartier"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
      exportValue: () => ''
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Quartiers & Pôles Urbains
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reload Douala official full-address neighborhoods */}
          {currentCity.id === 'city_douala' && (
            <button
              onClick={handleReloadOfficialDouala}
              disabled={isLoadingOfficial}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition cursor-pointer"
              title="Recharger les 162 quartiers officiels de Douala 1er à 5e avec le champ Adresse Complète et coordonnées GPS"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isLoadingOfficial ? 'Chargement...' : 'Charger Douala 1er à 5e (162)'}</span>
            </button>
          )}

          {/* Clear city neighborhoods button */}
          {cityNeighborhoods.length > 0 && (
            <button
              onClick={handleClearAllCityNeighborhoods}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
              title={`Supprimer tous les quartiers de ${currentCity.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vider {currentCity.name} ({cityNeighborhoods.length})</span>
            </button>
          )}

          {/* Import Excel Button */}
          <button
            onClick={() => {
              setImportCityId(currentCity.id);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1F4F4A] bg-white hover:bg-[#F0FAFA] border border-[#3D8B85]/20 shadow-sm transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#3D8B85]" />
            <span>Importer Excel (.xlsx)</span>
          </button>

          {/* Add Neighborhood Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#3D8B85] hover:bg-[#347872] shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un quartier</span>
          </button>
        </div>
      </div>

      {/* Banner if Douala is currently empty */}
      {currentCity.id === 'city_douala' && cityNeighborhoods.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-900">
                162 quartiers officiels de Douala prêts (Douala 1er, 2e, 3e, 4e, 5e)
              </h3>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Chaque quartier est enregistré avec le libellé <strong>« Adresse Complète »</strong> (ex: <em>Bali, DOUALA 1ER, LITTORAL, Cameroun</em>) et ses coordonnées GPS exactes.
              </p>
            </div>
          </div>
          <button
            onClick={handleReloadOfficialDouala}
            disabled={isLoadingOfficial}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow transition whitespace-nowrap cursor-pointer"
          >
            {isLoadingOfficial ? 'Chargement en cours...' : 'Injecter les 162 adresses complètes'}
          </button>
        </div>
      )}

      {/* City Switcher & Combinatorial Header */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#3D8B85]" />
            <span>Ville active :</span>
          </label>
          <select
            value={selectedCityId}
            onChange={(e) => onSelectCityId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#1F4F4A] focus:outline-none focus:border-[#3D8B85]"
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>

          {currentCity.id === 'city_douala' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Arrondissement :</span>
              <select
                value={selectedArrondissement}
                onChange={(e) => setSelectedArrondissement(e.target.value)}
                className="bg-[#F0FAFA] border border-[#3D8B85]/20 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1F4F4A] focus:outline-none focus:border-[#3D8B85]"
              >
                <option value="all">Tous (1er au 5e)</option>
                <option value="Douala 1er">Douala 1er (30 quartiers)</option>
                <option value="Douala 2e">Douala 2e (15 quartiers)</option>
                <option value="Douala 3e">Douala 3e (51 quartiers)</option>
                <option value="Douala 4e">Douala 4e (21 quartiers)</option>
                <option value="Douala 5e">Douala 5e (45 quartiers)</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            <strong className="font-semibold text-slate-900">{filteredCityNeighborhoods.filter(n => n.active).length}</strong>{' '}
            actifs sur {filteredCityNeighborhoods.length}
          </span>
          <span className="text-slate-300">•</span>
          <span>
            <strong className="font-semibold text-[#3D8B85]">
              {(() => {
                const count = filteredCityNeighborhoods.filter(n => n.active).length;
                return count > 1 ? count * (count - 1) : 0;
              })()}
            </strong>{' '}
            combinaisons
          </span>
        </div>
      </div>

      {/* Modern Compact DataTable */}
      <DataTable
        columns={columns}
        data={filteredCityNeighborhoods}
        searchPlaceholder={`Rechercher un quartier de ${currentCity.name}...`}
        searchKeys={['name', 'zoneType']}
        exportFileName={`quartiers_${currentCity.name.toLowerCase()}`}
        exportTitle={`Quartiers et Coordonnées GPS - ${currentCity.name}`}
        exportSubtitle={`${filteredCityNeighborhoods.length} quartiers enregistrés`}
        pageSizeOptions={[10, 25, 50, 100]}
        defaultPageSize={10}
        emptyMessage={`Aucun quartier enregistré pour ${currentCity.name}. Utilisez le bouton 'Importer Excel' pour charger la liste.`}
      />

      {/* Excel Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Importer les quartiers via fichier Excel
                </h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {importSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            {importError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{importError}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* City selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Associer les quartiers à la ville :
                </label>
                <select
                  value={importCityId}
                  onChange={(e) => setImportCityId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-600 focus:bg-white"
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Cameroun)
                    </option>
                  ))}
                </select>
              </div>

              {/* File upload drag zone */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-medium text-slate-700">
                  {importFile ? (
                    <span className="font-semibold text-emerald-700 flex items-center justify-center gap-1">
                      <FileCheck className="w-4 h-4" />
                      {importFile.name}
                    </span>
                  ) : (
                    'Cliquez ou glissez votre fichier Excel (.xlsx, .xls)'
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Colonnes reconnues automatiquement : <code>Nom</code>, <code>Latitude</code>, <code>Longitude</code>
                </div>
              </div>

              {/* Preview Table if parsed */}
              {parsedPreview.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-2.5 max-h-48 overflow-y-auto bg-white">
                  <div className="text-xs font-semibold text-slate-800 mb-1.5 flex items-center justify-between">
                    <span>Aperçu avant importation :</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                      {parsedPreview.length} quartiers détectés
                    </span>
                  </div>
                  <table className="w-full text-left text-[11px] text-slate-600">
                    <thead className="border-b border-slate-100 text-slate-400">
                      <tr>
                        <th className="py-1">Nom</th>
                        <th className="py-1">Lat</th>
                        <th className="py-1">Lng</th>
                        <th className="py-1">Zone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedPreview.slice(0, 5).map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-1 font-medium text-slate-800">{p.name}</td>
                          <td className="py-1 font-mono">{p.lat.toFixed(4)}</td>
                          <td className="py-1 font-mono">{p.lng.toFixed(4)}</td>
                          <td className="py-1 capitalize">{p.zoneType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedPreview.length > 5 && (
                    <div className="text-[10px] text-slate-400 mt-1 text-center">
                      ... et {parsedPreview.length - 5} autres quartiers
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={parsedPreview.length === 0 || isSubmitting}
                onClick={handleConfirmImport}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting
                  ? 'Importation...'
                  : `Importer les ${parsedPreview.length} quartiers`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Neighborhood Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                Ajouter un quartier à {currentCity.name}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNeighborhood} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom du quartier / repère
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Bastos, Bonanjo, Akwa..."
                  value={newNbName}
                  onChange={(e) => setNewNbName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Typologie urbaine
                </label>
                <select
                  value={newNbZone}
                  onChange={(e) => setNewNbZone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-600 focus:bg-white"
                >
                  <option value="commercial">Affaires / Commercial</option>
                  <option value="residential">Résidentiel</option>
                  <option value="popular">Populaire / Haute densité</option>
                  <option value="center">Centre Administratif</option>
                  <option value="airport">Aéroportuaire</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitude GPS
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newNbLat}
                    onChange={(e) => setNewNbLat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-600 focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitude GPS
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newNbLng}
                    onChange={(e) => setNewNbLng(e.target.value)}
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
                  {isSubmitting ? 'Ajout...' : 'Ajouter le quartier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
