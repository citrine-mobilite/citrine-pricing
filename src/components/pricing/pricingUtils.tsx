import React from 'react';
import { TripResult } from '../../types';

export const cleanNeighborhoodName = (name: string | null | undefined): string => {
  if (!name) return '—';
  const commaIndex = name.indexOf(',');
  if (commaIndex !== -1) {
    return name.substring(0, commaIndex).trim();
  }
  return name.trim();
};

export const renderCellPrice = (price: number | null | undefined, accent?: 'yango' | 'hero') => {
  if (!price || price <= 0 || isNaN(price)) {
    return <span className="text-slate-300 font-mono text-[11px]">—</span>;
  }
  const color = accent === 'hero' ? 'text-teal-700 font-bold' : 'text-slate-900 font-bold';
  return (
    <span className={`font-mono text-xs ${color}`}>
      {price.toLocaleString('fr-FR')} <span className="text-[10px] text-slate-400 font-normal">F</span>
    </span>
  );
};

export const getYangoPrice = (t: TripResult, className: 'econom' | 'business' | 'comfortplus' | 'moto'): number | null => {
  if (className === 'econom') return t.priceEconom || t.classes?.econom?.price || (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'econom')?.price || (t.tariffClass === 'econom' ? t.price : null);
  if (className === 'business') return t.priceConfort || t.classes?.business?.price || (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'confort')?.price || null;
  if (className === 'comfortplus') return t.priceConfortPlus || t.classes?.comfortplus?.price || (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'comfortplus' || c.className?.toLowerCase() === 'confort+')?.price || null;
  if (className === 'moto') return t.priceMoto || t.classes?.moto?.price || (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'moto')?.price || null;
  return null;
};

export const getHeroPrice = (t: TripResult, className: 'eco' | 'confort' | 'suv' | 'perkm'): number | null => {
  const hQ = t.heroQuote as any;
  if (className === 'eco') {
    let p = t.priceHeroStandard || hQ?.priceStandard || hQ?.priceEco || hQ?.price || t.priceHero || null;
    if (!p && hQ?.classes) {
      p = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'standard' || c.className?.toLowerCase() === 'eco')?.price || null;
    }
    return p;
  }
  if (className === 'confort') {
    let p = t.priceHeroConfort || hQ?.priceConfort || null;
    if (!p && hQ?.classes) {
      p = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'confort' || c.className?.toLowerCase() === 'comfort')?.price || null;
    }
    return p;
  }
  if (className === 'suv') {
    let p = t.priceHeroSuv || hQ?.priceSuv || null;
    if (!p && hQ?.classes) {
      p = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'suv')?.price || null;
    }
    return p;
  }
  if (className === 'perkm') {
    let p = t.priceHeroPerKm || hQ?.pricePerKm || null;
    if (!p && t.distanceKm && t.distanceKm > 0) {
      const heroBasePrice = t.priceHeroStandard || t.priceHeroConfort || t.priceHero || hQ?.priceStandard || hQ?.price;
      if (heroBasePrice && heroBasePrice > 0) {
        p = Math.round(heroBasePrice / t.distanceKm);
      }
    }
    return p;
  }
  return null;
};

export const getTripMasterPrice = (t: TripResult, className: 'eco' | 'confort' | 'moto'): number | null => {
  const tmQ = t.tripMasterQuote as any;
  if (className === 'eco') return t.priceTripMaster || tmQ?.priceEco || tmQ?.price || null;
  if (className === 'confort') return t.priceTripMasterConfort || tmQ?.priceConfort || null;
  if (className === 'moto') return t.priceTripMasterMoto || tmQ?.priceMoto || null;
  return null;
};

export interface PricingStatsSummary {
  yango: {
    eco: { avg: number; min: number; count: number };
    confort: { avg: number; min: number; count: number };
    confortPlus: { avg: number; min: number; count: number };
    moto: { avg: number; min: number; count: number };
  };
  hero: {
    eco: { avg: number; min: number; count: number };
    confort: { avg: number; min: number; count: number };
    suv: { avg: number; min: number; count: number };
    perKm: { avg: number; min: number; count: number };
  };
  tripMaster: {
    eco: { avg: number; min: number; count: number };
    confort: { avg: number; min: number; count: number };
    moto: { avg: number; min: number; count: number };
  };
  yangoWins: number;
  heroWins: number;
  totalTrips: number;
}

export function computePricingStats(trips: TripResult[]): PricingStatsSummary {
  const yEco: number[] = [];
  const yConf: number[] = [];
  const yConfPlus: number[] = [];
  const yMoto: number[] = [];
  const hEco: number[] = [];
  const hConf: number[] = [];
  const hSuv: number[] = [];
  const hVip: number[] = [];
  let yangoWins = 0;
  let heroWins = 0;

  const tmEco: number[] = [];
  const tmConf: number[] = [];
  const tmMoto: number[] = [];

  trips.forEach((t) => {
    const pYE = getYangoPrice(t, 'econom');
    const pYC = getYangoPrice(t, 'business');
    const pYCP = getYangoPrice(t, 'comfortplus');
    const pYM = getYangoPrice(t, 'moto');

    const pHE = getHeroPrice(t, 'eco');
    const pHC = getHeroPrice(t, 'confort');
    const pHS = getHeroPrice(t, 'suv');
    const pHV = getHeroPrice(t, 'perkm');

    const pTME = getTripMasterPrice(t, 'eco');
    const pTMC = getTripMasterPrice(t, 'confort');
    const pTMM = getTripMasterPrice(t, 'moto');

    if (pYE && pYE > 0) yEco.push(pYE);
    if (pYC && pYC > 0) yConf.push(pYC);
    if (pYCP && pYCP > 0) yConfPlus.push(pYCP);
    if (pYM && pYM > 0) yMoto.push(pYM);

    if (pHE && pHE > 0) hEco.push(pHE);
    if (pHC && pHC > 0) hConf.push(pHC);
    if (pHS && pHS > 0) hSuv.push(pHS);
    if (pHV && pHV > 0) hVip.push(pHV);

    if (pTME && pTME > 0) tmEco.push(pTME);
    if (pTMC && pTMC > 0) tmConf.push(pTMC);
    if (pTMM && pTMM > 0) tmMoto.push(pTMM);

    if (t.cheaperProvider === 'hero') heroWins++;
    else if (t.cheaperProvider === 'yango') yangoWins++;
  });

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const min = (arr: number[]) => (arr.length ? Math.min(...arr) : 0);

  return {
    yango: {
      eco: { avg: avg(yEco), min: min(yEco), count: yEco.length },
      confort: { avg: avg(yConf), min: min(yConf), count: yConf.length },
      confortPlus: { avg: avg(yConfPlus), min: min(yConfPlus), count: yConfPlus.length },
      moto: { avg: avg(yMoto), min: min(yMoto), count: yMoto.length }
    },
    hero: {
      eco: { avg: avg(hEco), min: min(hEco), count: hEco.length },
      confort: { avg: avg(hConf), min: min(hConf), count: hConf.length },
      suv: { avg: avg(hSuv), min: min(hSuv), count: hSuv.length },
      perKm: { avg: avg(hVip), min: min(hVip), count: hVip.length }
    },
    tripMaster: {
      eco: { avg: avg(tmEco), min: min(tmEco), count: tmEco.length },
      confort: { avg: avg(tmConf), min: min(tmConf), count: tmConf.length },
      moto: { avg: avg(tmMoto), min: min(tmMoto), count: tmMoto.length }
    },
    yangoWins,
    heroWins,
    totalTrips: trips.length
  };
}
