import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2, Share } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as standalone app, don't show the prompt
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'full') {
      return (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1F4F4A] to-[#2D736C] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-95 transition cursor-pointer ${className}`}
        >
          <Smartphone className="w-4 h-4 text-[#D4A82F]" />
          <span>{isInstalling ? 'Installation...' : 'Installer l\'application mobile'}</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-[#1F4F4A]/10 hover:bg-[#1F4F4A]/15 border border-[#3D8B85]/30 px-2.5 py-1.5 text-xs font-semibold text-[#1F4F4A] transition cursor-pointer shadow-2xs active:scale-95 ${className}`}
        title="Installer Citrine Pricing sur votre écran d'accueil"
      >
        <Download className="w-3.5 h-3.5 text-[#D4A82F]" />
        <span className="hidden sm:inline">Installer l'App</span>
        <span className="sm:hidden">App</span>
      </button>
    );
  }

  // iOS Safari flow (WebKit doesn't fire beforeinstallprompt)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg bg-[#1F4F4A]/10 hover:bg-[#1F4F4A]/15 border border-[#3D8B85]/30 px-2.5 py-1.5 text-xs font-semibold text-[#1F4F4A] transition cursor-pointer active:scale-95 ${className}`}
          title="Installer sur iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#D4A82F]" />
          <span>Installer</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1F4F4A] flex items-center justify-center text-white">
                    <Smartphone className="w-4 h-4 text-[#D4A82F]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Installer sur iPhone / iPad</h3>
                    <p className="text-[11px] text-slate-500">Accès direct et mode plein écran</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-700">
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1F4F4A] text-[10px] font-bold text-white">1</span>
                  <p>
                    Appuyez sur le bouton <strong>Partager</strong> <Share className="inline w-3.5 h-3.5 text-[#1F4F4A]" /> dans la barre Safari (en bas de votre écran).
                  </p>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1F4F4A] text-[10px] font-bold text-white">2</span>
                  <p>
                    Faites défiler la liste vers le bas et touchez <strong>« Sur l'écran d'accueil »</strong> (icône avec un carré et un plus).
                  </p>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">3</span>
                  <p>
                    Touchez <strong>Ajouter</strong> en haut à droite. L'icône Citrine Pricing apparaîtra avec vos applications !
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-[#1F4F4A] py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#183F3B] transition"
              >
                Compris !
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
