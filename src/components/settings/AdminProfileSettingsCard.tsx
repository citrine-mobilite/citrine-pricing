import React, { useState, useEffect } from 'react';
import { User as UserType } from '../../types';
import { api } from '../../services/api';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';

export const AdminProfileSettingsCard: React.FC = () => {
  const [adminUser, setAdminUser] = useState<UserType | null>(null);
  const [email, setEmail] = useState('citrinemobilite@gmail.com');
  const [password, setPassword] = useState('Citrine2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.getUsers().then(users => {
      const admin = users.find(u => u.email === 'citrinemobilite@gmail.com' || u.role === 'admin');
      if (admin) {
        setAdminUser(admin);
        setEmail(admin.email || 'citrinemobilite@gmail.com');
      }
    }).catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) return;
    setIsSaving(true);
    setSuccess(false);

    try {
      const payload: any = { email: email.trim() };
      if (password && password !== '••••••••••••' && password !== 'Citrine2026!') {
        payload.password = password.trim();
      }
      await api.updateUser(adminUser.id, payload);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Compte Administrateur mis à jour en BD avec succès',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (err: any) {
      Swal.fire({
        title: 'Erreur',
        text: err.message || 'Impossible de mettre à jour le compte admin.',
        icon: 'error',
        confirmButtonColor: '#1F4F4A'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Gestion du Compte Administrateur (BD)</h3>
          <p className="text-xs text-slate-500">Configurez l'email et le mot de passe administrateur principaux (stockés en base de données)</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span>Email de l'Administrateur</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#1F4F4A] focus:ring-2 focus:ring-[#1F4F4A]/20 text-xs text-slate-800 outline-none transition"
            placeholder="citrinemobilite@gmail.com"
          />
          <p className="text-[11px] text-slate-400 mt-1">Cet email sert de référence principale pour l'accès Super Admin et les notifications.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Mot de passe Administrateur (BD)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 focus:border-[#1F4F4A] focus:ring-2 focus:ring-[#1F4F4A]/20 text-xs font-mono text-slate-800 outline-none transition"
              placeholder="Citrine2026!"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Le mot de passe stocké de manière sécurisée en base de données.</p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {success ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Enregistré en BD avec succès !</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">Modifications persistées instantanément</span>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#1F4F4A] hover:bg-[#163834] text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Enregistrement...' : 'Mettre à jour l’Admin'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
