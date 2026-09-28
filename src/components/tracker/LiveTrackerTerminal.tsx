import React from 'react';
import { Terminal } from 'lucide-react';

interface LiveTrackerTerminalProps {
  logs: { timestamp: string; level: string; message: string }[];
}

export const LiveTrackerTerminal: React.FC<LiveTrackerTerminalProps> = ({ logs }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Journal d'exécution & Requêtes Directes</span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">{logs.length} entrées</span>
      </div>

      <div className="p-4 max-h-72 overflow-y-auto font-mono text-xs space-y-1.5 text-slate-300">
        {logs.length === 0 ? (
          <p className="text-slate-500 text-center py-6">En attente des premiers retours des serveurs...</p>
        ) : (
          logs.slice(-25).map((log, i) => (
            <div key={i} className="flex items-start gap-2 leading-relaxed">
              <span className="text-slate-500 text-[11px] shrink-0">
                {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
              </span>
              <span
                className={
                  log.level === 'error'
                    ? 'text-rose-400 font-semibold'
                    : log.level === 'warn'
                    ? 'text-amber-400'
                    : 'text-emerald-300'
                }
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
