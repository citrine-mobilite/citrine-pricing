import React, { useRef, useState, useMemo } from 'react';
import { City, Neighborhood } from '../../types';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  ShieldAlert,
  PlusCircle,
  HelpCircle,
  SlidersHorizontal,
  MapPin
} from 'lucide-react';
import { parseNeighborhoodReconcileFile, ReconcileItem, ReconcileResult } from '../../utils/neighborhoodReconciler';
import { api } from '../../services/api';

interface NeighborhoodExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cities: City[];
  currentCityId: string;
  existingNeighborhoods: Neighborhood[];
  onSuccess: () => void;
}

export const NeighborhoodExcelImportModal: React.FC<NeighborhoodExcelImportModalProps> = ({
  isOpen,
  onClose,
  cities,
  currentCityId,
  existingNeighborhoods,
  onSuccess
}) => {
  const [importCityId, setImportCityId] = useState(currentCityId || cities[0]?.id || '');
  const selectedCity = cities.find((c) => c.id === importCityId) || cities[0];
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters for preview
  const [activeTab, setActiveTab] = useState<'all' | 'update' | 'create' | 'ignored_douala_6'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview filtering (Hooks must run unconditionally on every render)
  const filteredItems = useMemo(() => {
    if (!reconcileResult) return [];
    return reconcileResult.items.filter((item) => {
      // Tab filter
      if (activeTab !== 'all' && item.status !== activeTab) return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q) || (item.oldName && item.oldName.toLowerCase().includes(q));
        const matchAddr = item.fullAddress.toLowerCase().includes(q);
        const matchArr = item.arrondissement?.toLowerCase().includes(q);
        return matchName || matchAddr || matchArr;
      }
      return true;
    });
  }, [reconcileResult, activeTab, searchQuery]);

  const summary = reconcileResult?.summary;

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsing(true);
    setImportError(null);
    setImportSuccessMsg(null);

    try {
      const res = await parseNeighborhoodReconcileFile(file, importCityId, existingNeighborhoods);
      if (!res.success || res.items.length === 0) {
        setImportError(res.error || 'Aucune donnée valide trouvée dans ce fichier Excel.');
        setReconcileResult(null);
      } else {
        setReconcileResult(res);
      }
    } catch (err: any) {
      setImportError(err.message || 'Erreur lors de l’analyse du fichier Excel.');
      setReconcileResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleResetFile = () => {
    setImportFile(null);
    setReconcileResult(null);
    setImportError(null);
    setImportSuccessMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExecuteReconciliation = async () => {
    if (!reconcileResult || reconcileResult.items.length === 0 || !importCityId) return;

    // Seuls les éléments 'update' et 'create' sont envoyés (Douala 6ème est exclu)
    const validItems = reconcileResult.items.filter(
      (item) => item.status === 'update' || item.status === 'create'
    );

    if (validItems.length === 0) {
      setImportError('Aucune modification ou création valide à enregistrer.');
      return;
    }

    setIsSubmitting(true);
    setImportError(null);

    try {
      const res = await api.reconcileNeighborhoodsBatch(importCityId, validItems);
      setImportSuccessMsg(
        `✅ Opération réussie : ${res.updatedCount} quartier(s) rectifié(s) et ${res.createdCount} nouveau(x) quartier(s) ajouté(s) !`
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1600);
    } catch (err: any) {
      setImportError(err.message || "Erreur lors de l'enregistrement en base.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-5 sm:p-6 relative max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#3D8B85]">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Rectification & Mise à jour des Quartiers via Excel
            </h2>
            <p className="text-xs text-slate-500">
              Mise à jour des coordonnées GPS, noms raccourcis, adresses complètes et détection automatique
            </p>
          </div>
        </div>

        {/* Feedback Messages */}
        {importError && (
          <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{importError}</span>
          </div>
        )}

        {importSuccessMsg && (
          <div className="p-3 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{importSuccessMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Top Config Row: City & Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label htmlFor="import-city-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Ville cible
              </label>
              <select
                id="import-city-select"
                value={importCityId}
                onChange={(e) => {
                  setImportCityId(e.target.value);
                  if (importFile) handleResetFile();
                }}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fichier Excel (.xlsx / .xls / .csv)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">
                    {importFile ? importFile.name : 'Choisir le fichier Excel'}
                  </span>
                </button>
                {importFile && (
                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 transition cursor-pointer"
                    title="Changer de fichier"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Loading indicator */}
          {isParsing && (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
              <RefreshCw className="w-6 h-6 text-[#3D8B85] animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Analyse des colonnes, réconciliation des coordonnées et exclusion de Douala 6ème...
              </p>
            </div>
          )}

          {/* Reconcile Diff Preview */}
          {!isParsing && reconcileResult && summary && (
            <div className="space-y-3">
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-teal-800">À rectifier</span>
                    <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                  </div>
                  <div className="text-lg font-bold text-teal-900 mt-1">{summary.toUpdateCount}</div>
                  <div className="text-[10px] text-teal-700">Noms & GPS corrigés</div>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-blue-800">À ajouter</span>
                    <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-lg font-bold text-blue-900 mt-1">{summary.toCreateCount}</div>
                  <div className="text-[10px] text-blue-700">Nouveaux quartiers</div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-800">Douala 6e exclu</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-lg font-bold text-amber-900 mt-1">{summary.ignoredDouala6Count}</div>
                  <div className="text-[10px] text-amber-700">Filtrés conformément</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700">Total lignes</span>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{summary.totalParsed}</div>
                  <div className="text-[10px] text-slate-500">Lignes analysées</div>
                </div>
              </div>

              {/* Table Controls (Tabs & Search) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      activeTab === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tous ({reconcileResult.items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('update')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      activeTab === 'update' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-600 hover:text-teal-800'
                    }`}
                  >
                    À rectifier ({summary.toUpdateCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      activeTab === 'create' ? 'bg-white text-blue-800 shadow-2xs' : 'text-slate-600 hover:text-blue-800'
                    }`}
                  >
                    Nouveaux ({summary.toCreateCount})
                  </button>
                  {summary.ignoredDouala6Count > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('ignored_douala_6')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                        activeTab === 'ignored_douala_6' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-amber-800'
                      }`}
                    >
                      Exclus ({summary.ignoredDouala6Count})
                    </button>
                  )}
                </div>

                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrer par nom..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
                  />
                </div>
              </div>

              {/* Items Diff List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Statut Import</th>
                      <th className="py-2 px-3">Ville / Dépt / Arr.</th>
                      <th className="py-2 px-3">Nom du Quartier</th>
                      <th className="py-2 px-3">Zone</th>
                      <th className="py-2 px-3">Statut</th>
                      <th className="py-2 px-3">Latitude / Longitude</th>
                      <th className="py-2 px-3">Adresse Complète</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                          Aucun quartier correspondant aux filtres sélectionnés.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          {/* Statut Import */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {item.status === 'update' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                                <RefreshCw className="w-2.5 h-2.5" />
                                Rectification
                              </span>
                            )}
                            {item.status === 'create' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                <PlusCircle className="w-2.5 h-2.5" />
                                Nouveau
                              </span>
                            )}
                            {item.status === 'ignored_douala_6' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                Douala 6e exclu
                              </span>
                            )}
                            {item.status === 'invalid' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                <AlertCircle className="w-2.5 h-2.5" />
                                Invalide
                              </span>
                            )}
                          </td>

                          {/* Ville / Dept / Arrondissement */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{item.arrondissement || item.cityName || selectedCity?.name || '—'}</div>
                            <div className="text-[10px] text-slate-400">
                              {item.departement ? `${item.departement} • ` : ''}{item.ville || item.cityName || selectedCity?.name || '—'}
                            </div>
                          </td>

                          {/* Nom du Quartier */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            {item.oldName && item.oldName !== item.name && (
                              <div className="text-[10px] text-slate-400 line-through truncate max-w-[180px]">
                                {item.oldName}
                              </div>
                            )}
                          </td>

                          {/* Zone */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 capitalize">
                              {item.zone || item.zoneType || 'commercial'}
                            </span>
                          </td>

                          {/* Statut Métier */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                item.active !== false
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {item.active !== false ? 'Actif' : 'Inactif'}
                            </span>
                          </td>

                          {/* Coordonnées Avant / Après */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                            {item.status === 'update' && item.oldLat !== undefined && item.oldLng !== undefined ? (
                              <div className="space-y-0.5">
                                <div className="text-slate-400 text-[10px] line-through">
                                  {item.oldLat.toFixed(4)}, {item.oldLng.toFixed(4)}
                                </div>
                                <div className="text-teal-900 font-semibold flex items-center gap-1">
                                  <ArrowRight className="w-3 h-3 text-teal-600 inline" />
                                  <span>{item.lat.toFixed(5)}, {item.lng.toFixed(5)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-800 font-medium">
                                {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                              </div>
                            )}
                          </td>

                          {/* Adresse complète */}
                          <td className="py-2.5 px-3 max-w-[220px]">
                            <div className="text-[11px] text-slate-700 truncate" title={item.fullAddress}>
                              {item.fullAddress}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Initial State / Help Notice */}
          {!importFile && (
            <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200/60 text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#1F4F4A]">
                <HelpCircle className="w-4 h-4 text-[#3D8B85]" />
                <span>Format de colonnes supporté (détection automatique)</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Le système intègre directement toutes vos 8 colonnes : <strong>Ville</strong>, <strong>Département</strong>, <strong>Arrondissement</strong>, <strong>Nom (Quartier)</strong>, <strong>Zone</strong>, <strong>Statut</strong>, <strong>Latitude</strong> et <strong>Longitude</strong>.
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
                <li>Reconnaissance souple par nom avec tolérance de casse, accents et 2-3 lettres de différence.</li>
                <li>Le nom court et propre est conservé, et la localisation complète est sauvegardée dans <code className="bg-white px-1 py-0.5 rounded text-teal-900">fullAddress</code>.</li>
                <li>Les quartiers de <strong>Douala 6ème</strong> (Manoka) sont automatiquement identifiés et exclus conformément à vos directives.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Annuler
          </button>

          {reconcileResult && (
            <button
              type="button"
              onClick={handleExecuteReconciliation}
              disabled={isSubmitting || (summary?.toUpdateCount === 0 && summary?.toCreateCount === 0)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-xl text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>
                    Appliquer les rectifications ({summary?.toUpdateCount || 0} màj, {summary?.toCreateCount || 0} ajouts)
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
