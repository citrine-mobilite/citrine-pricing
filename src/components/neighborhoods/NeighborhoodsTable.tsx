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
      key: 'name',
      label: 'Nom du Quartier',
      sortable: true,
      render: (nb) => <span className="font-semibold text-slate-900">{nb.name}</span>
    },
    {
      key: 'lat',
      label: 'Latitude',
      sortable: true,
      render: (nb) => <span className="font-mono text-slate-600 text-xs">{nb.lat.toFixed(5)}</span>
    },
    {
      key: 'lng',
      label: 'Longitude',
      sortable: true,
      render: (nb) => <span className="font-mono text-slate-600 text-xs">{nb.lng.toFixed(5)}</span>
    },
    {
      key: 'zoneType',
      label: 'Zone',
      sortable: true,
      render: (nb) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 capitalize">
          {nb.zoneType || 'commercial'}
        </span>
      )
    },
    {
      key: 'active',
      label: 'Statut',
      sortable: true,
      render: (nb) => (
        <button
          onClick={() => onToggleActive(nb)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition ${
            nb.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span>{nb.active ? 'Actif' : 'Inactif'}</span>
        </button>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (nb) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => onOpenEditModal(nb)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(nb.id)}
            className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ], [onToggleActive, onOpenEditModal, onDelete]);

  return (
    <DataTable
      columns={columns}
      data={neighborhoods}
      searchPlaceholder="Rechercher un quartier ou arrondissement..."
      searchKeys={['name']}
      exportFileName={`quartiers_${cityName.toLowerCase()}`}
    />
  );
};
