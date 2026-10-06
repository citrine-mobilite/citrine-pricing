import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, MapPin, X, Building } from 'lucide-react';

export interface ArrondissementInfo {
  name: string;
  cityName: string;
  tripCount: number;
  neighborhoodsCount: number;
  formattedLabel: string;
}

interface ArrondissementSelect2Props {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ArrondissementInfo[];
  placeholder?: string;
  disabled?: boolean;
}

export const ArrondissementSelect2: React.FC<ArrondissementSelect2Props> = ({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner un arrondissement...',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.name === value) || null;
  }, [options, value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.cityName.toLowerCase().includes(q) ||
        opt.formattedLabel.toLowerCase().includes(q) ||
        String(opt.tripCount).includes(q) ||
        String(opt.neighborhoodsCount).includes(q)
    );
  }, [options, searchQuery]);

  const handleSelect = (arrName: string) => {
    onChange(arrName);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' && isOpen && filteredOptions.length > 0) {
      e.preventDefault();
      handleSelect(filteredOptions[0].name);
    }
  };

  return (
    <div className="relative w-full text-left" ref={containerRef} onKeyDown={handleKeyDown}>
      {label && (
        <label htmlFor={id} className="block text-[11px] font-semibold text-slate-600 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-white border rounded-lg px-3 py-2 text-xs text-left flex items-center justify-between gap-2 shadow-sm transition cursor-pointer select-none ${
          isOpen
            ? 'border-[#1F4F4A] ring-2 ring-[#1F4F4A]/10 text-slate-900'
            : 'border-slate-300 hover:border-slate-400 text-slate-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
          {selectedOption ? (
            <span className="font-bold text-slate-800 truncate">
              {selectedOption.name}{' '}
              <span className="font-semibold text-teal-800 text-[11px]">
                ({selectedOption.tripCount} {selectedOption.tripCount > 1 ? 'trajets' : 'trajet'} - {selectedOption.cityName})
              </span>
            </span>
          ) : (
            <span className="text-slate-400 font-normal truncate">{value || placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {selectedOption && (
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
              {selectedOption.neighborhoodsCount} {selectedOption.neighborhoodsCount > 1 ? 'quartiers' : 'quartier'}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-800' : ''}`}
          />
        </div>
      </button>

      {/* Floating Dropdown Panel (Select2) */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Integrated Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un arrondissement ou ville..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1F4F4A] focus:ring-1 focus:ring-[#1F4F4A]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Counts Badge */}
            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-slate-500">
              <span>{filteredOptions.length} arrondissement{filteredOptions.length > 1 ? 's' : ''} disponible{filteredOptions.length > 1 ? 's' : ''}</span>
              {searchQuery && (
                <span className="text-teal-700 font-medium">Recherche : « {searchQuery} »</span>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                <Building className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                <span>Aucun arrondissement trouvé</span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="block mx-auto mt-2 text-[11px] text-teal-700 font-medium hover:underline cursor-pointer"
                  >
                    Réinitialiser le filtre
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.name === value;
                return (
                  <div
                    key={opt.name}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.name)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-teal-50 text-teal-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${
                          isSelected
                            ? 'bg-teal-700 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {opt.name.replace(/[^0-9]/g, '') || opt.name.slice(0, 2)}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                          <span>{opt.name}</span>
                          <span className="font-semibold text-teal-700 text-[11px]">
                            ({opt.tripCount} {opt.tripCount > 1 ? 'trajets' : 'trajet'} - {opt.cityName})
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {opt.neighborhoodsCount} quartier{opt.neighborhoodsCount > 1 ? 's' : ''} actif{opt.neighborhoodsCount > 1 ? 's' : ''} répertorié{opt.neighborhoodsCount > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                        {opt.tripCount} tr.
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-teal-700 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
