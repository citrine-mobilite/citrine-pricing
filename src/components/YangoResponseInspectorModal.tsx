import React, { useState } from 'react';
import { TripResult } from '../types';
import {
  X,
  Code,
  Copy,
  Check,
  Send,
  Zap,
  Clock,
  Car,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowRight,
  Scale,
  Award,
  Users
} from 'lucide-react';

interface YangoResponseInspectorModalProps {
  trip: TripResult | null;
  onClose: () => void;
}

export const YangoResponseInspectorModal: React.FC<YangoResponseInspectorModalProps> = ({
  trip,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'4prices' | 'yango_json' | 'hero_json' | 'tripmaster_json' | 'request'>(
    (trip && (!trip.priceEconom && !trip.price)) ? 'yango_json' : '4prices'
  );
  const [copied, setCopied] = useState(false);

  if (!trip) return null;

  const yangoJsonString = trip.rawResponse
    ? JSON.stringify(trip.rawResponse, null, 2)
    : (trip.apiCallDetails?.rawResponseBody
      ? JSON.stringify(trip.apiCallDetails.rawResponseBody, null, 2)
      : 'Aucune réponse brute Yango enregistrée.');

  const heroJsonString = trip.heroQuote?.rawResponse
    ? JSON.stringify(trip.heroQuote.rawResponse, null, 2)
    : 'Aucune réponse brute Hero Cab enregistrée.';

  const tripMasterJsonString = trip.tripMasterQuote?.rawResponse
    ? JSON.stringify(trip.tripMasterQuote.rawResponse, null, 2)
    : 'Aucune réponse brute Trip Master enregistrée.';

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLive = trip.source === 'yango_live';
  const apiDetails = trip.apiCallDetails;

  const pYangoEco = trip.priceEconom || trip.classes?.econom?.price || (trip.tariffClass === 'econom' ? trip.price : null);
  const pYangoConf = trip.priceConfort || trip.classes?.business?.price || trip.classes?.comfort?.price || (trip.tariffClass === 'comfort' ? trip.price : null);
  const pHeroEco = trip.priceHeroStandard || trip.heroQuote?.priceStandard || trip.priceHero;
  const pHeroConf = trip.priceHeroConfort || trip.heroQuote?.priceConfort;
  const pTripMasterEco = trip.priceTripMaster || trip.tripMasterQuote?.priceEco;
  const pTripMasterConf = trip.priceTripMasterConfort || trip.tripMasterQuote?.priceConfort;
  const pTripMasterMoto = trip.priceTripMasterMoto || trip.tripMasterQuote?.priceMoto;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-[#3D8B85]/10 text-[#3D8B85]">
                <Scale className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">
                Inspecteur Multi-Agrégateurs : Yango, Hero Cab & Trip Master
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                100% Live Direct (Aucun fallback)
              </span>
            </div>

            {/* Route & Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-0.5">
              <span className="font-semibold text-slate-900">{trip.startNeighborhoodName}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span className="font-semibold text-slate-900">{trip.endNeighborhoodName}</span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-600">{trip.distanceKm} km</span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-600">~{trip.durationMinutes} min</span>
              {apiDetails?.latencyMs && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Latence: {apiDetails.latencyMs} ms
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center justify-between px-6 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('4prices')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === '4prices'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Comparatif & Tarifs
            </button>
            <button
              onClick={() => setActiveTab('yango_json')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'yango_json'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              JSON Yango
            </button>
            <button
              onClick={() => setActiveTab('hero_json')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'hero_json'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              JSON Hero Cab
            </button>
            <button
              onClick={() => setActiveTab('tripmaster_json')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'tripmaster_json'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              JSON Trip Master
            </button>
            <button
              onClick={() => setActiveTab('request')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'request'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Payload & GPS
            </button>
          </div>

          {(activeTab === 'yango_json' || activeTab === 'hero_json' || activeTab === 'tripmaster_json') && (
            <button
              onClick={() => handleCopy(activeTab === 'yango_json' ? yangoJsonString : (activeTab === 'hero_json' ? heroJsonString : tripMasterJsonString))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier JSON</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
          
          {/* TAB 1: 4 PRICES & BENCHMARK */}
          {activeTab === '4prices' && (
            <div className="space-y-5">
              
              {/* Top summary banner */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[#3D8B85]" />
                    <span>Comparatif Tarifaire Direct : {trip.startNeighborhoodName} ➔ {trip.endNeighborhoodName}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Relevé simultané en parallèle des deux opérateurs de VTC.
                  </p>
                </div>

                {trip.cheaperProvider && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    trip.cheaperProvider === 'hero'
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : trip.cheaperProvider === 'yango'
                      ? 'bg-rose-100 text-rose-900 border-rose-300'
                      : 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}>
                    🏆 {trip.cheaperProvider === 'hero' ? 'Hero Cab est moins cher' : (trip.cheaperProvider === 'yango' ? 'Yango est moins cher' : 'Tarifs équivalents')}
                    {trip.deltaPriceYangoVsHero !== undefined && trip.deltaPriceYangoVsHero !== 0 && (
                      <span className="ml-1 font-mono">
                        (Écart : {Math.abs(trip.deltaPriceYangoVsHero)} FCFA)
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Dynamic Prices Grid for All Classes */}
              {(() => {
                const yangoList: Array<{ label: string; price: number; subtitle: string; badge: string; provider: string }> = [];
                if (trip.classes) {
                  for (const [k, q] of Object.entries(trip.classes)) {
                    const qc = q as any;
                    if (qc && qc.price > 0) {
                      yangoList.push({ label: `Yango ${qc.className || k}`, price: qc.price, subtitle: `${Math.round(qc.price / (trip.distanceKm || 1))} FCFA/km`, badge: qc.className || k, provider: 'yango' });
                    }
                  }
                }
                if (yangoList.length === 0) {
                  if (pYangoEco) yangoList.push({ label: 'Yango Éco', price: pYangoEco, subtitle: `${Math.round(pYangoEco / (trip.distanceKm || 1))} FCFA/km`, badge: 'Standard', provider: 'yango' });
                  if (pYangoConf) yangoList.push({ label: 'Yango Confort', price: pYangoConf, subtitle: `${Math.round(pYangoConf / (trip.distanceKm || 1))} FCFA/km`, badge: 'Business', provider: 'yango' });
                  if (trip.priceConfortPlus) yangoList.push({ label: 'Yango Confort+', price: trip.priceConfortPlus, subtitle: `${Math.round(trip.priceConfortPlus / (trip.distanceKm || 1))} FCFA/km`, badge: 'Confort+', provider: 'yango' });
                  if (trip.priceMoto) yangoList.push({ label: 'Yango Moto', price: trip.priceMoto, subtitle: `${Math.round(trip.priceMoto / (trip.distanceKm || 1))} FCFA/km`, badge: 'Moto', provider: 'yango' });
                }

                const heroList: Array<{ label: string; price: number; subtitle: string; badge: string; provider: string }> = [];
                const hQ = trip.heroQuote as any;
                if (hQ) {
                  if (pHeroEco) heroList.push({ label: 'Hero Cab Éco', price: pHeroEco, subtitle: `${trip.heroDriversCount || hQ.availableDriversCount || 0} chauffeurs Hero`, badge: 'Standard', provider: 'hero' });
                  if (pHeroConf) heroList.push({ label: 'Hero Cab Confort', price: pHeroConf, subtitle: 'Véhicule VIP climatisé', badge: 'VIP', provider: 'hero' });
                  if (hQ.priceSuv) heroList.push({ label: 'Hero SUV', price: hQ.priceSuv, subtitle: 'SUV spacieux', badge: 'SUV', provider: 'hero' });
                  if (hQ.priceVip) heroList.push({ label: 'Hero PerKm', price: hQ.priceVip, subtitle: 'Tarif par kilomètre', badge: 'PerKm', provider: 'hero' });
                  for (const [k, v] of Object.entries(hQ)) {
                    if (k.startsWith('price') && typeof v === 'number' && v > 0) {
                      const subName = k.replace('price', '');
                      if (!['Standard', 'Eco', 'Confort', 'Suv', 'Vip', 'PerKm', 'GrossStandard', 'GrossConfort'].includes(subName) && subName) {
                        heroList.push({ label: `Hero ${subName}`, price: v, subtitle: 'Flotte Hero', badge: subName, provider: 'hero' });
                      }
                    }
                  }
                }

                const tmList: Array<{ label: string; price: number; subtitle: string; badge: string; provider: string }> = [];
                if (pTripMasterEco) tmList.push({ label: 'Trip Master Éco', price: pTripMasterEco, subtitle: 'Trip Master Live', badge: 'Standard', provider: 'tripmaster' });
                if (pTripMasterConf) tmList.push({ label: 'Trip Master Confort', price: pTripMasterConf, subtitle: 'Trip Master Berline', badge: 'Business', provider: 'tripmaster' });
                if (pTripMasterMoto) tmList.push({ label: 'Trip Master Moto', price: pTripMasterMoto, subtitle: 'Trip Master Moto', badge: 'Moto', provider: 'tripmaster' });
                const tmQ = trip.tripMasterQuote;
                if (tmQ) {
                  for (const [k, v] of Object.entries(tmQ)) {
                    if (k.startsWith('price') && typeof v === 'number' && v > 0) {
                      const subName = k.replace('price', '');
                      if (!['Eco', 'Confort', 'Moto'].includes(subName) && subName) {
                        tmList.push({ label: `Trip Master ${subName}`, price: v, subtitle: 'Trip Master', badge: subName, provider: 'tripmaster' });
                      }
                    }
                  }
                }

                const combinedClasses = [...yangoList, ...heroList, ...tmList];

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {combinedClasses.map((cls, idx) => {
                      const cardBg = cls.provider === 'yango'
                        ? 'bg-red-500/10 border-red-500/30'
                        : cls.provider === 'hero'
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-blue-500/10 border-blue-500/30';

                      const badgeBg = cls.provider === 'yango'
                        ? 'bg-red-500/20 text-red-900'
                        : cls.provider === 'hero'
                        ? 'bg-emerald-500/20 text-emerald-900'
                        : 'bg-blue-500/20 text-blue-900';

                      return (
                        <div key={idx} className={`rounded-xl p-3.5 border space-y-1.5 shadow-xs backdrop-blur-xs ${cardBg}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{cls.label}</span>
                            <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${badgeBg}`}>{cls.badge}</span>
                          </div>
                          <div className="text-lg font-extrabold text-slate-900">
                            {cls.price && cls.price > 0 ? `${cls.price.toLocaleString('fr-FR')} FCFA` : <span className="text-xs text-slate-400">Non disponible</span>}
                          </div>
                          <div className="text-[10px] text-slate-600">{cls.subtitle}</div>
                        </div>
                      );
                    })}
                    {combinedClasses.length === 0 && (
                      <div className="col-span-full text-xs text-slate-500 text-center py-4">Aucun tarif disponible pour ce trajet.</div>
                    )}
                  </div>
                );
              })()}

            </div>
          )}

          {/* TAB 2: YANGO RAW JSON */}
          {activeTab === 'yango_json' && (
            <div className="space-y-3">
              {(apiDetails?.error || (trip.httpStatus && trip.httpStatus !== 200) || (!trip.priceEconom && !trip.price)) && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Statut de la réponse Yango : {trip.httpStatus ? `HTTP ${trip.httpStatus}` : 'Échec ou réponse absente'}</span>
                  </div>
                  {apiDetails?.error && (
                    <div className="text-[11px] text-rose-700 font-mono">
                      Message d'erreur : {apiDetails.error}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Réponse brute retournée par ya-authproxy.yango.com :</span>
                <span className="font-mono text-[11px] text-slate-400">{yangoJsonString.length} octets</span>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner">
                <pre className="p-4 text-xs font-mono text-emerald-400 leading-relaxed overflow-x-auto max-h-[55vh]">
                  {yangoJsonString}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: HERO RAW JSON */}
          {activeTab === 'hero_json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Réponse brute retournée par l’API Hero Cab :</span>
                <span className="font-mono text-[11px] text-slate-400">{heroJsonString.length} octets</span>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner">
                <pre className="p-4 text-xs font-mono text-sky-400 leading-relaxed overflow-x-auto max-h-[55vh]">
                  {heroJsonString}
                </pre>
              </div>
            </div>
          )}

          {/* TAB: TRIP MASTER RAW JSON */}
          {activeTab === 'tripmaster_json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Réponse brute retournée par tripmastercameroon.com (/get-distance & /search-vehicle) :</span>
                <span className="font-mono text-[11px] text-slate-400">{tripMasterJsonString.length} octets</span>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner">
                <pre className="p-4 text-xs font-mono text-amber-400 leading-relaxed overflow-x-auto max-h-[55vh]">
                  {tripMasterJsonString}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: REQUEST PAYLOAD */}
          {activeTab === 'request' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#3D8B85]" />
                  <span>Endpoints Exécutés en Parallèle</span>
                </div>
                <div className="font-mono text-xs bg-slate-100 p-2.5 rounded-lg text-slate-800 space-y-1">
                  <div>🔴 POST https://ya-authproxy.yango.com/3.0/routestats</div>
                  <div>🔵 POST https://demos.bbcsproducts.net/herocabpro/booking/cx-get_available_driver_list.php</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="font-semibold text-slate-700">Origine (Départ)</div>
                  <div className="font-mono text-slate-600">
                    Lat: {trip.startCoordinates?.[0] || '-'}, Lng: {trip.startCoordinates?.[1] || '-'}
                  </div>
                  <div className="text-[11px] text-slate-400">{trip.startNeighborhoodName}</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="font-semibold text-slate-700">Destination (Arrivée)</div>
                  <div className="font-mono text-slate-600">
                    Lat: {trip.endCoordinates?.[0] || '-'}, Lng: {trip.endCoordinates?.[1] || '-'}
                  </div>
                  <div className="text-[11px] text-slate-400">{trip.endNeighborhoodName}</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
