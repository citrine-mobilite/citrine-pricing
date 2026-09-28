import React, { useRef } from 'react';
import { City } from '../../types';
import { X, FileSpreadsheet, Upload, FileCheck, AlertCircle, HelpCircle } from 'lucide-react';
import { parseNeighborhoodExcelFile } from '../../utils/exportUtils';
import { api } from '../../services/api';

interface NeighborhoodExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cities: City[];
  currentCityId: string;
  onSuccess: () => void;
}

export const NeighborhoodExcelImportModal: React.FC<NeighborhoodExcelImportModalProps> = ({
  isOpen,
  onClose,
  cities,
  currentCityId,
  onSuccess
}) => {
  const [importCityId, setImportCityId] = React.useState(currentCityId);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [isParsing, setIsParsing] = React.useState(false);
  const [parsedPreview, setParsedPreview] = React.useState<any[]>([]);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsing(true);
    setImportError(null);
    setImportSuccessMsg(null);

    try {
      const res = await parseNeighborhoodExcelFile(file, importCityId);
      if (!res.success || res.neighborhoods.length === 0) {
        setImportError(res.error || 'Aucune ligne valide trouvée dans ce fichier Excel.');
        setParsedPreview([]);
      } else {
        setParsedPreview(res.neighborhoods);
      }
    } catch (err: any) {
      setImportError(err.message || 'Erreur lors de la lecture du fichier Excel.');
      setParsedPreview([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedPreview.length === 0 || !importCityId) return;

    setIsSubmitting(true);
    setImportError(null);

    try {
      const payload = parsedPreview.map((item) => ({
        name: item.name,
        lat: item.lat,
        lng: item.lng,
        zoneType: item.zoneType || 'commercial',
        active: true
      }));

      const res = await api.importNeighborhoodsBatch(importCityId, payload);
      setImportSuccessMsg(
        `✅ ${res.count || payload.length} quartiers ont été importés avec succès !`
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1400);
    } catch (err: any) {
      setImportError(err.message || "Erreur lors de l'enregistrement en base.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Importer des quartiers depuis Excel (.xlsx / .csv)
            </h2>
            <p className="text-xs text-slate-500">
              Importez vos listes de quartiers et points GPS d'un coup
            </p>
          </div>
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* City Selection */}
          <div>
            <label htmlFor="import-city-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Ville de destination *
            </label>
            <select
              id="import-city-select"
              value={importCityId}
              onChange={(e) => setImportCityId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.country})
                </option>
              ))}
            </select>
          </div>

          {/* File Upload Area */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                importFile
                  ? 'border-emerald-400 bg-emerald-50/30'
                  : 'border-slate-300 hover:border-[#3D8B85] bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-800 mb-0.5">
                {importFile ? importFile.name : 'Cliquez pour sélectionner un fichier Excel'}
              </p>
              <p className="text-[11px] text-slate-400">Formats supportés : .xlsx, .xls, .csv</p>
            </div>
          </div>

          {/* Format Requirements Info */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <HelpCircle className="w-3.5 h-3.5 text-[#1F4F4A]" />
              <span>Colonnes attendues dans le fichier Excel :</span>
            </div>
            <p className="text-slate-500 pl-5">
              • <strong>Nom</strong> ou <strong>Quartier</strong> (ex: Akwa, Douala 1er)<br />
              • <strong>Latitude</strong> ou <strong>Lat</strong> (ex: 4.0531)<br />
              • <strong>Longitude</strong> ou <strong>Lng</strong> (ex: 9.7028)
            </p>
          </div>

          {/* Error / Success feedback */}
          {importError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          {importSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-lg flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{importSuccessMsg}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedPreview.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1.5">
                <span>Aperçu des données détectées</span>
                <span className="text-emerald-700 font-bold">{parsedPreview.length} lignes valides</span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                <table className="w-full text-left text-[11px] text-slate-700">
                  <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-3">#</th>
                      <th className="py-1.5 px-3">Quartier</th>
                      <th className="py-1.5 px-3">Latitude</th>
                      <th className="py-1.5 px-3">Longitude</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedPreview.slice(0, 15).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-1 px-3 font-medium text-slate-900">{item.name}</td>
                        <td className="py-1 px-3 font-mono text-slate-600">{item.lat}</td>
                        <td className="py-1 px-3 font-mono text-slate-600">{item.lng}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={parsedPreview.length === 0 || isSubmitting}
            className="px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50"
          >
            {isSubmitting ? 'Importation...' : `Valider l'import (${parsedPreview.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};
