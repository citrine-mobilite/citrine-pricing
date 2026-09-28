import React from 'react';
import { TripResult } from '../../types';
import { Send, Clock, Server } from 'lucide-react';

interface InspectorRequestTabProps {
  trip: TripResult;
}

export const InspectorRequestTab: React.FC<InspectorRequestTabProps> = ({ trip }) => {
  const details = trip.apiCallDetails;

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Endpoint ciblé :</span>
          </span>
          <span className="font-mono text-slate-900">{details?.endpoint || 'Yango & Hero Cab Gateway'}</span>
        </div>

        {details?.latencyMs && (
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Temps de réponse (latence) :</span>
            </span>
            <span className="font-mono text-emerald-700 font-bold">{details.latencyMs} ms</span>
          </div>
        )}
      </div>

      <div>
        <span className="font-semibold text-slate-800 block mb-1">Payload de requête envoyé :</span>
        <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
          {trip.requestPayload ? JSON.stringify(trip.requestPayload, null, 2) : 'Aucun payload envoyé en cache.'}
        </pre>
      </div>
    </div>
  );
};
