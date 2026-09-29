import React from 'react';
import { TripResult } from '../../types';

export const cleanNeighborhoodName = (name: string | null | undefined): string => {
  if (!name) return '—';
  // Enlever uniquement le suffixe pays redondant (ex: ", Cameroun" ou ", Cameroon") et conserver le nom complet
  return name.replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();
};

export const parseAnyPrice = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) || val <= 0 ? null : Math.round(val);
  }
  if (typeof val === 'string') {
    const clean = val.replace(/CFA|FCFA|XAF/gi, '').replace(/\s+/g, '').replace(/,/g, '.').replace(/[^\d.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) || num <= 0 ? null : Math.round(num);
  }
  return null;
};

export const renderCellPrice = (price: any, accent?: 'yango' | 'hero' | 'tripmaster') => {
  const p = parseAnyPrice(price);
  if (!p) {
    return <span className="text-slate-300 font-mono text-[11px]">—</span>;
  }
  let color = 'text-slate-900 font-bold';
  if (accent === 'hero') color = 'text-teal-700 font-bold';
  else if (accent === 'tripmaster') color = 'text-blue-700 font-bold';
  return (
    <span className={`font-mono text-xs ${color}`}>
      {p.toLocaleString('fr-FR')} <span className="text-[10px] text-slate-400 font-normal">F</span>
    </span>
  );
};

export const getYangoPrice = (t: TripResult, className: 'econom' | 'business' | 'comfortplus' | 'moto'): number | null => {
  if (!t) return null;

  // 1. Direct clean access from t.prices.yango
  if (t.prices?.yango) {
    if (className === 'econom') return parseAnyPrice(t.prices.yango.eco);
    if (className === 'business') return parseAnyPrice(t.prices.yango.confort);
    if (className === 'comfortplus') return parseAnyPrice(t.prices.yango.confortPlus);
    if (className === 'moto') return parseAnyPrice(t.prices.yango.moto);
  }

  // 2. Fallback for legacy cached structures
  const anyT = t as any;
  if (className === 'econom') {
    return parseAnyPrice(
      anyT.yango_eco ??
      t.priceEconom ??
      anyT.price_econom ??
      t.classes?.econom?.price ??
      (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'econom')?.price ??
      (t.tariffClass === 'econom' ? t.price : null) ??
      t.price
    );
  }
  if (className === 'business') {
    return parseAnyPrice(
      anyT.yango_confort ??
      t.priceConfort ??
      anyT.price_confort ??
      t.classes?.business?.price ??
      t.classes?.comfort?.price ??
      (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'confort' || c.className?.toLowerCase() === 'business')?.price
    );
  }
  if (className === 'comfortplus') {
    return parseAnyPrice(
      anyT.yango_confort_plus ??
      t.priceConfortPlus ??
      anyT.price_confort_plus ??
      t.classes?.comfortplus?.price ??
      (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'comfortplus' || c.className?.toLowerCase() === 'confort+')?.price
    );
  }
  if (className === 'moto') {
    return parseAnyPrice(
      anyT.yango_moto ??
      t.priceMoto ??
      anyT.price_moto ??
      t.classes?.moto?.price ??
      (Object.values(t.classes || {}) as any[]).find((c: any) => c.className?.toLowerCase() === 'moto')?.price
    );
  }
  return null;
};

export const getHeroPrice = (t: TripResult, className: 'eco' | 'confort' | 'suv' | 'perkm'): number | null => {
  if (!t) return null;

  // 1. Direct clean access from t.prices.heroCab
  if (t.prices?.heroCab) {
    if (className === 'eco') return parseAnyPrice(t.prices.heroCab.eco);
    if (className === 'confort') return parseAnyPrice(t.prices.heroCab.confort);
    if (className === 'suv') return parseAnyPrice(t.prices.heroCab.suv);
    if (className === 'perkm') return parseAnyPrice(t.prices.heroCab.perKm);
  }

  // 2. Fallback for legacy cached structures
  const anyT = t as any;
  const hQ = t.heroQuote as any;

  if (className === 'eco') {
    let p = parseAnyPrice(
      anyT.hero_eco ??
      t.priceHeroStandard ??
      anyT.price_hero_standard ??
      t.priceHero ??
      hQ?.priceStandard ??
      hQ?.priceEco ??
      hQ?.price
    );
    if (!p && hQ?.classes) {
      const found = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'standard' || c.className?.toLowerCase() === 'eco');
      p = parseAnyPrice(found?.price);
    }
    return p;
  }
  if (className === 'confort') {
    let p = parseAnyPrice(
      anyT.hero_confort ??
      t.priceHeroConfort ??
      anyT.price_hero_confort ??
      hQ?.priceConfort ??
      hQ?.priceComfort
    );
    if (!p && hQ?.classes) {
      const found = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'confort' || c.className?.toLowerCase() === 'comfort');
      p = parseAnyPrice(found?.price);
    }
    return p;
  }
  if (className === 'suv') {
    let p = parseAnyPrice(
      anyT.hero_suv ??
      t.priceHeroSuv ??
      anyT.price_hero_suv ??
      hQ?.priceSuv
    );
    if (!p && hQ?.classes) {
      const found = (Object.values(hQ.classes) as any[]).find((c: any) => c.className?.toLowerCase() === 'suv');
      p = parseAnyPrice(found?.price);
    }
    return p;
  }
  if (className === 'perkm') {
    let p = parseAnyPrice(
      anyT.hero_per_km ??
      t.priceHeroPerKm ??
      anyT.price_hero_per_km ??
      hQ?.pricePerKm
    );
    if (!p && t.distanceKm && t.distanceKm > 0) {
      const heroBasePrice = getHeroPrice(t, 'eco') || getHeroPrice(t, 'confort');
      if (heroBasePrice && heroBasePrice > 0) {
        p = Math.round(heroBasePrice / t.distanceKm);
      }
    }
    return p;
  }
  return null;
};

export const getTripMasterPrice = (t: TripResult, className: 'eco' | 'confort' | 'moto'): number | null => {
  if (!t) return null;

  // 1. Direct clean access from t.prices.tripMaster
  if (t.prices?.tripMaster) {
    if (className === 'eco') return parseAnyPrice(t.prices.tripMaster.eco);
    if (className === 'confort') return parseAnyPrice(t.prices.tripMaster.confort);
    if (className === 'moto') return parseAnyPrice(t.prices.tripMaster.moto);
  }

  // 2. Fallback for legacy cached structures
  const anyT = t as any;
  const tmQ = t.tripMasterQuote as any;

  if (className === 'eco') {
    return parseAnyPrice(
      anyT.tripmaster_eco ??
      t.priceTripMaster ??
      anyT.priceTripMasterEco ??
      anyT.price_tripmaster_eco ??
      anyT.tripMasterPrices?.eco ??
      tmQ?.priceEco ??
      tmQ?.price
    );
  }
  if (className === 'confort') {
    return parseAnyPrice(
      anyT.tripmaster_confort ??
      t.priceTripMasterConfort ??
      anyT.priceTripMasterConf ??
      anyT.price_tripmaster_confort ??
      anyT.tripMasterPrices?.confort ??
      tmQ?.priceConfort
    );
  }
  if (className === 'moto') {
    return parseAnyPrice(
      anyT.tripmaster_moto ??
      t.priceTripMasterMoto ??
      anyT.priceTripMasterMotorcycle ??
      anyT.price_tripmaster_moto ??
      anyT.tripMasterPrices?.moto ??
      tmQ?.priceMoto
    );
  }
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
