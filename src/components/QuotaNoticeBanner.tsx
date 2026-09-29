import React, { useState, useEffect } from 'react';
import { subscribeToQuotaExceeded } from '../utils/quotaHandler';
import { AlertTriangle, X, Database } from 'lucide-react';

export const QuotaNoticeBanner: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeToQuotaExceeded(() => {
      setVisible(true);
    });
    return () => unsubscribe();
  }, []);

  if (!visible) return null;

  return (
    <div className="bg-amber-500 text-slate-900 border-b border-amber-600 px-4 py-2.5 shadow-md flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-amber-600 text-white rounded-lg shrink-0">
          <Database className="w-4 h-4" />
        </div>
        <div className="text-xs">
          <span className="font-bold uppercase tracking-wider text-amber-950 bg-amber-200/80 px-2 py-0.5 rounded text-[10px] mr-2">
            Mode Mémoire Autonome
          </span>
          <span className="font-medium text-slate-900">
            Quota Firestore quotidien atteint (Spark Gratuit). L'application fonctionne en direct en mémoire vive — tous vos calculs et comparatifs restent 100% fonctionnels.
          </span>
        </div>
      </div>

      <button
        onClick={() => setVisible(false)}
        className="p-1 text-slate-800 hover:text-slate-950 hover:bg-amber-400 rounded-lg transition cursor-pointer shrink-0 ml-3"
        title="Masquer l'avertissement"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
