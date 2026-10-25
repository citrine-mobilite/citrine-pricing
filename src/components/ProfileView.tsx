import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { PricingCampaign } from '../types';
import {
  User,
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
  Lock,
  MapPin,
  Activity,
  UserCheck,
  ShieldAlert,
  Save,
  Globe,
  Award,
  ArrowUpRight
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

  // Profile details editing
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password editing
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  if (!user) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-500 max-w-xl mx-auto shadow-sm my-12">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900 mb-1">Session non authentifiée</h2>
        <p className="text-xs text-slate-500 mb-4">Veuillez vous connecter pour accéder à votre profil et gérer vos paramètres.</p>
      </div>
    );
  }

  // Filter campaigns launched by this user
  const myRecentCampaigns = useMemo(() => {
    return campaigns
      .filter(
        (c) =>
          c.triggeredByUserId === user.id ||
          (c.triggeredByUserName && c.triggeredByUserName.toLowerCase() === user.name.toLowerCase())
      )
      .slice(0, 6);
  }, [campaigns, user]);

  const totalMyCampaignsCount = useMemo(() => {
    return campaigns.filter(
      (c) =>
        c.triggeredByUserId === user.id ||
        (c.triggeredByUserName && c.triggeredByUserName.toLowerCase() === user.name.toLowerCase())
    ).length;
  }, [campaigns, user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!cleanName || !cleanEmail) return;

    setIsUpdatingProfile(true);
    setProfileSuccess(false);

    try {
      await api.updateUser(String(user.id), { name: cleanName, email: cleanEmail });
      user.name = cleanName;
      user.email = cleanEmail;
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
      if (onRefresh) onRefresh();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Profil mis à jour avec succès',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Impossible de mettre à jour le profil.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let gen = '';
    for (let i = 0; i < 12; i++) {
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
      await api.changeUserPassword(String(user.id), cleanPass);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 4000);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Mot de passe modifié avec succès !',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (err: any) {
      setPasswordError(err.message || 'Erreur lors de la modification du mot de passe.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const roleTitle =
    user.role === 'admin'
      ? 'Super Administrateur'
      : user.role === 'responsable'
      ? 'Responsable Opérations'
      : 'Opérateur Pricing';

  const roleBadgeStyle =
    user.role === 'admin'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : user.role === 'responsable'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-emerald-50 text-emerald-800 border-emerald-200';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* HERO BANNER DU PROFIL                                                     */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-white via-slate-50/50 to-white rounded-3xl border border-slate-200/90 p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#1F4F4A]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1F4F4A] to-[#2B6E67] text-white flex items-center justify-center font-black text-3xl uppercase shadow-lg shadow-[#1F4F4A]/15 shrink-0 ring-4 ring-white">
                {user.name ? user.name.substring(0, 2) : 'US'}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-3 border-white rounded-full shadow-xs" title="En ligne" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{user.name}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${roleBadgeStyle} flex items-center gap-1.5 shadow-2xs`}>
                  <ShieldCheck className="w-4 h-4" />
                  {roleTitle}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1.5 font-mono text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  <Mail className="w-3.5 h-3.5 text-[#1F4F4A]" />
                  {user.email}
                </span>
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Inscrit le {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '01/01/2026'}
                </span>
                {user.lastLoginAt && (
                  <span className="flex items-center gap-1.5 text-slate-500 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Dernière session : {new Date(user.lastLoginAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* KPI Mini Cards */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="px-5 py-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <div className="text-xl font-black text-[#1F4F4A]">{totalMyCampaignsCount}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Campagnes Lancées</div>
            </div>
            <div className="px-5 py-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 shadow-2xs text-center">
              <div className="text-xl font-black text-emerald-700 flex items-center justify-center gap-1">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <span>Actif</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mt-0.5">Statut Compte</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORMULAIRES DE CONFIGURATION (PROFIL & SÉCURITÉ)                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARTE 1 : INFORMATIONS PERSONNELLES */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-7 shadow-xs space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#1F4F4A] flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Informations Personnelles</h3>
                <p className="text-xs text-slate-500">Mettez à jour vos informations d'identification</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nom complet / Identifiant</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#1F4F4A] focus:ring-2 focus:ring-[#1F4F4A]/20 text-xs text-slate-800 outline-none transition font-medium"
                  placeholder="Ex: Admin Citrine"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Adresse e-mail professionnelle</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#1F4F4A] focus:ring-2 focus:ring-[#1F4F4A]/20 text-xs text-slate-800 outline-none transition font-medium font-mono"
                  placeholder="nom@citrine-mobilite.com"
                />
                <p className="text-[11px] text-slate-400 mt-1">Utilisé pour les connexions et rapports d'analyses.</p>
              </div>

              <div className="pt-2">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
                  <Award className="w-4 h-4 text-[#1F4F4A] shrink-0 mt-0.5" />
                  <div className="text-[11px] text-slate-600 leading-relaxed">
                    <strong className="text-slate-900 font-semibold block mb-0.5">Droits d'accès et privilèges :</strong>
                    Vous bénéficiez du rôle <span className="font-bold text-purple-700">{roleTitle}</span> avec accès complet aux moteurs de pricing Yango, Hero Cab et Trip Master.
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {profileSuccess ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Profil mis à jour !</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Enregistrement instantané</span>
                )}

                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-5 py-2.5 bg-[#1F4F4A] hover:bg-[#163834] text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className={`w-4 h-4 ${isUpdatingProfile ? 'animate-spin' : ''}`} />
                  <span>{isUpdatingProfile ? 'Enregistrement...' : 'Enregistrer le profil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* CARTE 2 : SÉCURITÉ & MOT DE PASSE */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-7 shadow-xs space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Sécurité & Mot de passe</h3>
                  <p className="text-xs text-slate-500">Modifiez votre mot de passe d'accès sécurisé</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeneratePassword}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs border border-purple-200"
                title="Générer un mot de passe robuste aléatoire"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Générer un mot de passe</span>
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nouveau mot de passe</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 focus:border-[#1F4F4A] focus:ring-2 focus:ring-[#1F4F4A]/20 text-xs font-mono text-slate-800 outline-none transition"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Confirmer le nouveau mot de passe</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#1F4F4A] focus:ring-2 focus:ring-[#1F4F4A]/20 text-xs font-mono text-slate-800 outline-none transition"
                  placeholder="••••••••••••"
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {passwordSuccess ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mot de passe modifié avec succès !</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Cryptage sécurisé en base</span>
                )}

                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-5 py-2.5 bg-[#1F4F4A] hover:bg-[#163834] text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className={`w-4 h-4 ${isUpdatingPassword ? 'animate-spin' : ''}`} />
                  <span>{isUpdatingPassword ? 'Modification...' : 'Modifier le mot de passe'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION : CAMPAGNES RÉCENTES LANCÉES PAR L'UTILISATEUR                   */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-7 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#1F4F4A] flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Vos Campagnes Récentes</h3>
              <p className="text-xs text-slate-500">Historique des 6 dernières campagnes déclenchées par votre compte</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>Voir tout l'historique</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {myRecentCampaigns.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Globe className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-medium">Aucune campagne n'a encore été lancée par votre compte.</p>
            <button
              type="button"
              onClick={() => onNavigate('pricing')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1F4F4A] text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-[#163834] transition cursor-pointer mt-2"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Lancer un premier pricing</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRecentCampaigns.map((camp) => (
              <div
                key={camp.id}
                onClick={() => onSelectCampaign(String(camp.id))}
                className="p-4 bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/80 hover:border-[#1F4F4A]/40 transition shadow-2xs hover:shadow-md cursor-pointer group flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block">ID #{camp.id}</span>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#1F4F4A] transition">
                      {camp.cityName || 'Ville Cameroun'}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    camp.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : camp.status === 'in_progress'
                      ? 'bg-amber-100 text-amber-800 animate-pulse'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {camp.status === 'completed' ? 'Terminée' : camp.status === 'in_progress' ? 'En cours' : camp.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-200/60 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Trajets</span>
                    <strong className="text-slate-800 font-bold">{camp.totalPairs || 0}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Moyenne</span>
                    <strong className="text-[#1F4F4A] font-bold">{Math.round(camp.avgPrice || 0).toLocaleString()} {camp.currency || 'XAF'}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {camp.startedAt ? new Date(camp.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Récemment'}
                  </span>
                  <span className="text-[#1F4F4A] font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    <span>Inspecter</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
