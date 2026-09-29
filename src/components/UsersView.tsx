import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from './DataTable';
import { CheckCircle2, XCircle, Trash2, Pencil, Shield } from 'lucide-react';
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
  
  // Modal state (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'responsable' | 'employe'>('employe');
  const [active, setActive] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deletion modal state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenAddModal = () => {
    setModalMode('create');
    setEditingUserId(null);
    setName('');
    setEmail('');
    setRole('employe');
    setActive(true);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setModalMode('edit');
    setEditingUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role || 'employe');
    setActive(user.active !== false);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Nom et email sont obligatoires.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (modalMode === 'edit' && editingUserId) {
        await api.updateUser(editingUserId, {
          name: name.trim(),
          email: email.trim(),
          role,
          active
        });

        setIsModalOpen(false);
        onRefresh();

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Utilisateur mis à jour avec succès',
          showConfirmButton: false,
          timer: 2500
        });
      } else {
        await api.createUser({
          name: name.trim(),
          email: email.trim(),
          role
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
      }
    } catch (err: any) {
      const msg = err.message || 'Erreur lors de l’enregistrement de l’utilisateur.';
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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1F4F4A]/10 text-[#1F4F4A] flex items-center justify-center font-bold text-xs uppercase">
            {u.name.substring(0, 2)}
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>{u.name}</span>
              {u.id === currentUser?.id && (
                <span className="text-[10px] text-[#1F4F4A] bg-[#1F4F4A]/10 px-1.5 py-0.2 rounded border border-[#1F4F4A]/20">
                  Vous
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 block sm:hidden font-mono">{u.email}</span>
          </div>
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (u) => <span className="font-mono text-slate-600 text-xs">{u.email}</span>
    },
    {
      key: 'role',
      label: 'Rôle',
      sortable: true,
      render: (u) => {
        if (u.role === 'admin') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80">
              <Shield className="w-3 h-3 text-purple-600" />
              Administrateur
            </span>
          );
        }
        if (u.role === 'responsable') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
              Responsable
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
            Opérateur
          </span>
        );
      }
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
          title={u.id === currentUser?.id ? 'Vous ne pouvez pas modifier votre propre statut' : 'Cliquer pour changer le statut'}
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
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEditModal(u)}
            className="p-1.5 text-slate-500 hover:text-[#1F4F4A] hover:bg-[#1F4F4A]/10 rounded-lg transition cursor-pointer"
            title="Modifier l'utilisateur"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {u.id !== currentUser?.id && (
            <button
              onClick={() => handleOpenDeleteModal(u)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              title="Supprimer l'utilisateur"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ], [currentUser?.id, users.length]);

  return (
    <div className="space-y-4">
      <UsersHeader
        totalCount={users.length}
        onOpenAddModal={handleOpenAddModal}
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
        mode={modalMode}
        onClose={() => setIsModalOpen(false)}
        name={name}
        onNameChange={setName}
        email={email}
        onEmailChange={setEmail}
        role={role}
        onRoleChange={setRole}
        active={active}
        onActiveChange={setActive}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmitUser}
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
