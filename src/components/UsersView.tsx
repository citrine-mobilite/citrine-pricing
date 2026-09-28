import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from './DataTable';
import { CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { UsersHeader } from './users/UsersHeader';
import { UserModal } from './users/UserModal';
import { DeleteUserModal } from './users/DeleteUserModal';
import Swal from 'sweetalert2';

interface UsersViewProps {
  users: User[];
  onRefresh: () => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ users, onRefresh }) => {
  const { user: currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deletion modal state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      onRefresh();
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Utilisateur créé avec succès',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (err: any) {
      const msg = err.message || 'Erreur lors de la création de l’utilisateur.';
      setError(msg);
      Swal.fire({
        title: 'Erreur',
        text: msg,
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      Swal.fire({
        title: 'Action impossible',
        text: 'Vous ne pouvez pas désactiver votre propre compte administrateur.',
        icon: 'warning',
        confirmButtonColor: '#1F4F4A'
      });
      return;
    }
    try {
      await api.updateUser(user.id, { active: !user.active });
      onRefresh();
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: user.active ? 'info' : 'success',
        title: user.active ? 'Compte utilisateur désactivé' : 'Compte utilisateur réactivé',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Erreur lors du changement de statut.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    }
  };

  const handleOpenDeleteModal = (user: User) => {
    if (user.id === currentUser?.id) {
      Swal.fire({
        title: 'Action impossible',
        text: 'Vous ne pouvez pas supprimer votre propre compte.',
        icon: 'warning',
        confirmButtonColor: '#1F4F4A'
      });
      return;
    }
    if (users.length <= 1) {
      Swal.fire({
        title: 'Action impossible',
        text: 'Impossible de supprimer le seul utilisateur restant du système.',
        icon: 'warning',
        confirmButtonColor: '#1F4F4A'
      });
      return;
    }
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);

    try {
      await api.deleteUser(userToDelete.id);
      setIsDeleteModalOpen(false);
      const deletedName = userToDelete.name;
      setUserToDelete(null);
      onRefresh();

      Swal.fire({
        title: 'Utilisateur supprimé !',
        text: `Le compte de ${deletedName} a été définitivement supprimé.`,
        icon: 'success',
        confirmButtonColor: '#1F4F4A',
        timer: 2500
      });
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur de suppression',
        text: err.message || 'Impossible de supprimer cet utilisateur.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<User>[] = useMemo(() => [
    {
      key: 'name',
      label: 'Utilisateur',
      sortable: true,
      render: (u) => (
        <span className="font-semibold text-slate-900">
          {u.name}{' '}
          {u.id === currentUser?.id && (
            <span className="text-[10px] text-[#1F4F4A] bg-[#1F4F4A]/10 px-1.5 py-0.5 rounded border border-[#1F4F4A]/20 ml-1">
              Vous
            </span>
          )}
        </span>
      )
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (u) => <span className="font-mono text-slate-600 text-xs">{u.email}</span>
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
      )
    },
    {
      key: 'lastLoginAt',
      label: 'Dernière Connexion',
      sortable: true,
      render: (u) => (
        <span className="text-slate-500 text-xs font-mono">
          {u.lastLoginAt
            ? new Date(u.lastLoginAt).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Jamais'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (u) => (
        u.id !== currentUser?.id && (
          <button
            onClick={() => handleOpenDeleteModal(u)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
            title="Supprimer l'utilisateur"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )
      )
    }
  ], [currentUser?.id, users.length]);

  return (
    <div className="space-y-4">
      <UsersHeader
        totalCount={users.length}
        onOpenAddModal={() => setIsModalOpen(true)}
      />

      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="Rechercher par nom ou email..."
        searchKeys={['name', 'email']}
        exportFileName="utilisateurs_vtc"
      />

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        name={name}
        onNameChange={setName}
        email={email}
        onEmailChange={setEmail}
        isSubmitting={isSubmitting}
        onSubmit={handleCreateUser}
        error={error}
      />

      <DeleteUserModal
        isOpen={isDeleteModalOpen}
        user={userToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};
