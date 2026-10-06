import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { PricingCampaign } from '../types';
import {
  UserCircle,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Mail,
  Zap,
  Check,
  ChevronRight,
  ShieldCheck,
  Lock
} from 'lucide-react';
import Swal from 'sweetalert2';

interface ProfileViewProps {
  campaigns: PricingCampaign[];
  onSelectCampaign: (id: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  campaigns,
  onSelectCampaign,
  onNavigate,
  onRefresh
}) => {
  const { user } = useAuth();

  // Name editing
  const [name, setName] = useState(user?.name || '');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Password editing
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  if (!user) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        Veuillez vous connecter pour accéder à votre profil.
      </div>
    );
  }

  // Filter campaigns launched by this user
  const myCampaigns = campaigns.filter(
    (c) =>
      c.triggeredByUserId === user.id ||
      (c.triggeredByUserName && c.triggeredByUserName.toLowerCase() === user.name.toLowerCase())
  );

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    setIsUpdatingName(true);
    setNameSuccess(false);

    try {
      await api.updateUser(user.id, { name: cleanName });
      user.name = cleanName; // Local update
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
      if (onRefresh) onRefresh();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Nom mis à jour avec succès',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Impossible de mettre à jour votre nom.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let gen = '';
    for (let i = 0; i < 10; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(gen);
    setConfirmPassword(gen);
    setShowPassword(true);
    setPasswordError(null);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    const cleanPass = newPassword.trim();
    if (!cleanPass) {
      setPasswordError('Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (cleanPass.length < 4) {
      setPasswordError('Le mot de passe doit comporter au moins 4 caractères.');
      return;
    }
    if (cleanPass !== confirmPassword.trim()) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await api.changeUserPassword(user.id, cleanPass);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 4000);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Votre mot de passe a été modifié avec succès !',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (err: any) {
      setPasswordError(err.message || 'Erreur lors de la modification du mot de passe.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const roleTitle = user.role === 'admin' ? 'Super Administrateur' : user.role === 'responsable' ? 'Responsable Opérations' : 'Opérateur';
  const roleColor = user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : user.role === 'responsable' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Profile Summary Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1F4F4A] text-white flex items-center justify-center font-black text-2xl uppercase shadow-sm">
              {user.name.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{user.name}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleColor} flex items-center gap-1`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {roleTitle}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1 font-mono">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {user.email}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Membre depuis : {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'Compte Système'}
                </span>
                {user.lastLoginAt && (
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Dernière connexion : {new Date(user.lastLoginAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="bg-[#F0FAFA] border border-[#3D8B85]/20 rounded-xl px-4 py-2.5 text-center">
              <div className="text-lg font-black text-[#1F4F4A]">{myCampaigns.length}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#3D8B85]">Pricing Lancés</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Profile Settings (Name & Password) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card: Edit Name */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#1F4F4A]/10 text-[#1F4F4A] flex items-center justify-center">
                <UserCircle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Informations Personnelles</h2>
                <p className="text-xs text-slate-500">Modifier le nom affiché sur vos campagnes et rapports</p>
              </div>
            </div>

            <form onSubmit={handleUpdateName} className="space-y-4">
              <div>
                <label htmlFor="profile-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom complet
                </label>
                <input
                  id="profile-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adresse email (identifiant)
                </label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">L'adresse email est gérée par l'administrateur système.</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                {nameSuccess && (
                  <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Modifié !
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isUpdatingName || name === user.name}
                  className="ml-auto px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#163834] text-white rounded-lg transition cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {isUpdatingName ? 'Enregistrement...' : 'Mettre à jour mon nom'}
                </button>
              </div>
            </form>
          </div>

          {/* Card: Change Password */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Modifier mon mot de passe</h2>
                  <p className="text-xs text-slate-500">Mettre à jour vos identifiants d'accès sécurisé</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-xs font-semibold text-[#1F4F4A] hover:text-[#163834] inline-flex items-center gap-1 cursor-pointer bg-[#F0FAFA] px-2.5 py-1 rounded-lg border border-[#3D8B85]/20"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#3D8B85]" />
                <span>Générer</span>
              </button>
            </div>

            {passwordError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Votre mot de passe a été mis à jour avec succès.</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Au moins 4 caractères..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3.5 pr-10 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3D8B85]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ressaisir le mot de passe..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3D8B85]"
                />
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingPassword || !newPassword}
                  className="px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#163834] text-white rounded-lg transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isUpdatingPassword ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Column: My Recent Campaigns */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Mes Campagnes Récentes</h2>
                  <p className="text-xs text-slate-500">{myCampaigns.length} relevé(s) lancé(s) par vous</p>
                </div>
              </div>
            </div>

            {myCampaigns.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Vous n'avez pas encore lancé de campagne de pricing.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {myCampaigns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectCampaign(c.id);
                      onNavigate('pricing');
                    }}
                    className="w-full text-left p-3 rounded-xl border border-slate-200/80 hover:border-[#3D8B85] hover:bg-[#F0FAFA] transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-[#1F4F4A] flex items-center gap-1.5">
                        <span>{c.cityName}</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          ({c.completedPairs || c.totalPairs} trajets)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(c.startedAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#1F4F4A] transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
