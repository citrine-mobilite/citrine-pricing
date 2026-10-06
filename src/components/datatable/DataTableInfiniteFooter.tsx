import React, { useEffect, useRef } from 'react';
import { ArrowUp, RotateCw, Sparkles, CheckCircle2 } from 'lucide-react';

interface DataTableInfiniteFooterProps {
  totalCount: number;
  visibleCount: number;
  onLoadMore: () => void;
  onLoadAll: () => void;
  onScrollToTop: () => void;
}

export const DataTableInfiniteFooter: React.FC<DataTableInfiniteFooterProps> = ({
  totalCount,
  visibleCount,
  onLoadMore,
  onLoadAll,
  onScrollToTop
}) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (visibleCount >= totalCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [visibleCount, totalCount, onLoadMore]);

  const hasMore = visibleCount < totalCount;

  return (
    <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
      {/* Count summary */}
      <div className="flex items-center gap-2">
        <span>
          Affichage de <strong className="font-bold text-slate-900">{Math.min(visibleCount, totalCount)}</strong> sur{' '}
          <strong className="font-bold text-slate-900">{totalCount.toLocaleString('fr-FR')}</strong> éléments
        </span>
        {!hasMore && totalCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Tous affichés
          </span>
        )}
      </div>

      {/* Sentinel for auto infinite scroll */}
      <div ref={sentinelRef} className="h-1 w-full sm:w-auto" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {hasMore ? (
          <>
            <button
              onClick={onLoadMore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F4F4A] bg-[#F0FAFA] hover:bg-[#3D8B85]/20 border border-[#3D8B85]/30 rounded-lg transition cursor-pointer active:scale-95"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#3D8B85]" />
              <span>Charger 50 de plus</span>
            </button>

            <button
              onClick={onLoadAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition cursor-pointer active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Tout charger ({totalCount})</span>
            </button>
          </>
        ) : (
          <button
            onClick={onScrollToTop}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer active:scale-95"
          >
            <ArrowUp className="w-3.5 h-3.5 text-[#1F4F4A]" />
            <span>Remonter en haut</span>
          </button>
        )}
      </div>
    </div>
  );
};
