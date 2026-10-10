import React, { useMemo } from 'react';
import { Neighborhood } from '../../types';
import { DataTable, Column } from '../DataTable';
import { Edit3, Trash2 } from 'lucide-react';

interface NeighborhoodsTableProps {
  neighborhoods: Neighborhood[];
  cityName: string;
  onToggleActive: (nb: Neighborhood) => void;
  onOpenEditModal: (nb: Neighborhood) => void;
  onDelete: (id: string) => void;
}

export const NeighborhoodsTable: React.FC<NeighborhoodsTableProps> = ({
  neighborhoods,
  cityName,
  onToggleActive,
  onOpenEditModal,
  onDelete
}) => {
  const columns: Column<Neighborhood>[] = useMemo(() => [
    {
      key: 'ville',
      label: 'Ville',
      sortable: true,
      exportValue: (nb) => nb.ville || nb.cityName || cityName || '—',
      render: (nb) => (
        <span className="font-medium text-slate-800 text-xs">
          {nb.ville || nb.cityName || cityName || '—'}
        </span>
      )
    },
    {
      key: 'departement',
      label: 'Département',
      sortable: true,
      exportValue: (nb) => nb.departement || '—',
      render: (nb) => (
        <span className="text-slate-600 text-xs">
          {nb.departement || '—'}
        </span>
      )
    },
    {
      key: 'arrondissement',
      label: 'Arrondissement',
      sortable: true,
      exportValue: (nb) => nb.arrondissement || 'Non défini',
      render: (nb) => (
        <span className="font-semibold text-slate-900 text-xs">
          {nb.arrondissement || 'Non défini'}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Nom du Quartier',
      sortable: true,
      exportValue: (nb) => nb.name,
      render: (nb) => (
        <span className="font-semibold text-slate-900 text-xs">
          {nb.name}
        </span>
      )
    },
    {
      key: 'fullAddress',
      label: 'Adresse complète',
      sortable: true,
      exportValue: (nb) => nb.fullAddress || nb.name,
      render: (nb) => (
        <span className="text-[11px] text-slate-500 truncate max-w-xs block" title={nb.fullAddress || nb.name}>
          {nb.fullAddress || nb.name}
        </span>
      )
    },
    {
      key: 'zone',
      label: 'Zone',
      sortable: true,
      exportValue: (nb) => nb.zone || nb.zoneType || 'commercial',
      render: (nb) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 capitalize">
          {nb.zone || nb.zoneType || 'commercial'}
        </span>
      )
    },
    {
      key: 'lat',
      label: 'Latitude',
      sortable: true,
      exportValue: (nb) => nb.lat,
      render: (nb) => <span className="font-mono text-slate-600 text-xs">{nb.lat.toFixed(5)}</span>
    },
    {
      key: 'lng',
      label: 'Longitude',
      sortable: true,
      exportValue: (nb) => nb.lng,
      render: (nb) => <span className="font-mono text-slate-600 text-xs">{nb.lng.toFixed(5)}</span>
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      exportValue: (nb) => (typeof nb.status === 'string' ? nb.status : (nb.active ? 'Actif' : 'Inactif')),
      render: (nb) => (
        <button
          onClick={() => onToggleActive(nb)}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition ${
            nb.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
          }`}
          title="Cliquer pour basculer Actif / Inactif"
        >
          <span>{typeof nb.status === 'string' ? nb.status : (nb.active ? 'Actif' : 'Inactif')}</span>
        </button>
      )
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (nb) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => onOpenEditModal(nb)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
            title="Modifier"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(nb.id)}
            className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ], [cityName, onToggleActive, onOpenEditModal, onDelete]);

  return (
    <DataTable
      columns={columns}
      data={neighborhoods}
      searchPlaceholder="Rechercher par quartier, arrondissement, ville, département, zone..."
      searchKeys={['name', 'arrondissement', 'ville', 'departement', 'fullAddress', 'zone', 'status']}
      exportFileName={`quartiers_${cityName.toLowerCase()}`}
    />
  );
};
