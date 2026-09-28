import React from 'react';
import { Sliders, CheckCircle } from 'lucide-react';

interface LauncherTariffClassSelectorProps {
  selectedClasses: string[];
  onToggleClass: (id: string) => void;
}

export const LauncherTariffClassSelector: React.FC<LauncherTariffClassSelectorProps> = ({
  selectedClasses,
  onToggleClass
}) => {
  const classes = [
    { id: 'econom', name: 'Éco / Standard', desc: 'Tarif standard Yango' },
    { id: 'comfort', name: 'Confort / Berline', desc: 'Véhicules climatisés' }
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <Sliders className="w-4 h-4 text-[#1F4F4A]" />
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          2. Classes Tarifaires Cibles
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {classes.map((cls) => {
          const isSelected = selectedClasses.includes(cls.id);
          return (
            <div
              key={cls.id}
              onClick={() => onToggleClass(cls.id)}
              className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                isSelected
                  ? 'border-[#1F4F4A] bg-[#1F4F4A]/5'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div>
                <strong className="text-xs font-bold text-slate-900 block">{cls.name}</strong>
                <span className="text-[11px] text-slate-500">{cls.desc}</span>
              </div>
              <CheckCircle
                className={`w-4 h-4 ${isSelected ? 'text-[#1F4F4A]' : 'text-slate-300'}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
