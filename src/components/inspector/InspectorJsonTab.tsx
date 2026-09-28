import React from 'react';
import { Copy, Check } from 'lucide-react';

interface InspectorJsonTabProps {
  jsonString: string;
  onCopy: (text: string) => void;
  copied: boolean;
}

export const InspectorJsonTab: React.FC<InspectorJsonTabProps> = ({
  jsonString,
  onCopy,
  copied
}) => {
  return (
    <div className="relative">
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={() => onCopy(jsonString)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition border border-slate-700 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copié !</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copier JSON</span>
            </>
          )}
        </button>
      </div>

      <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
        {jsonString}
      </pre>
    </div>
  );
};
