import React, { useState } from 'react';
import { User } from '../types';
import {
  Users,
  UserPlus,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from './DataTable';

interface UsersViewProps {
  users: User[];
  onRefresh: () => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ users, onRefresh }) => {
  const { user: currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Nom et email sont obligatoires.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.createUser({
        name: name.trim(),
        email: email.trim(),
        role: 'employe'
      });
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de l’utilisateur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('Vous ne pouvez pas désactiver votre propre compte.');
      return;
    }
    try {
      await api.updateUser(user.id, { active: !user.active });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    if (confirm(`Confirmez-vous la suppression du compte de ${user.name} ?`)) {
      try {
        await api.deleteUser(user.id);
        onRefresh();
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression.');
      }
    }
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      label: 'Utilisateur',
      sortable: true,
      render: (u) => (
        <span className="font-semibold text-slate-900">
          {u.name}{' '}
          {u.id === currentUser?.id && (
            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 ml-1">
              Vous
            </span>
          )}
        </span>
      ),
      exportValue: (u) => u.name
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (u) => <span className="font-mono text-slate-600 text-xs">{u.email}</span>,
      exportValue: (u) => u.email
    },
    {
      key: 'active',
      label: 'Statut',
      sortable: true,
      render: (u) => (
        <button
          onClick={() => handleToggleActive(u)}
          disabled={u.id === currentUser?.id}
          className="inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          title="Activer ou désactiver l'accès"
        >
          {u.active ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Actif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              <XCircle className="w-3 h-3 text-rose-500" />
              Désactivé
            </span>
          )}
        </button>
      ),
      exportValue: (u) => (u.active ? 'Actif' : 'Désactivé')
    },
    {
      key: 'lastLoginAt',
      label: 'Dernière Connexion',
      sortable: true,
      render: (u) => (
        <span className="text-slate-500 text-xs">
          {u.lastLoginAt
            ? new Date(u.lastLoginAt).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Jamais'}
        </span>
      ),
      exportValue: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : 'Jamais')
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (u) => (
        <div>
          {u.id !== currentUser?.id && (
            <button
              onClick={() => handleDeleteUser(u)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
              title="Supprimer ce compte"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
      exportValue: () => ''
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1F4F4A] tracking-tight">
            Comptes Utilisateurs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Application interne : création manuelle des comptes autorisés.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#3D8B85] hover:bg-[#347872] shadow-sm transition cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Créer un utilisateur</span>
        </button>
      </div>

      {/* Users DataTable */}
      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="Rechercher par nom ou email..."
        searchKeys={['name', 'email']}
        exportFileName="utilisateurs_citrine"
        exportTitle="Liste des Utilisateurs - Citrine Pricing"
        pageSizeOptions={[25, 50, 100]}
        defaultPageSize={25}
        emptyMessage="Aucun utilisateur configuré."
      />

      {/* Modal Create User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-[#1F4F4A] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#3D8B85]" />
                <span>Créer un compte collaborateur</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1F4F4A] mb-1">
                  Nom et Prénom
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Jean Dupont"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F0FAFA]/60 border border-slate-200 rounded-lg px-3 py-2 text-xs text-[#1F4F4A] focus:outline-none focus:border-[#3D8B85] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F4F4A] mb-1">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  placeholder="nom@citrine-pricing.cm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F0FAFA]/60 border border-slate-200 rounded-lg px-3 py-2 text-xs text-[#1F4F4A] focus:outline-none focus:border-[#3D8B85] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F4F4A] mb-1">
                  Mot de passe initial
                </label>
                <input
                  type="text"
                  placeholder="Mot de passe temporaire"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F0FAFA]/60 border border-slate-200 rounded-lg px-3 py-2 text-xs text-[#1F4F4A] focus:outline-none focus:border-[#3D8B85] focus:bg-white font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#3D8B85] hover:bg-[#347872] rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
