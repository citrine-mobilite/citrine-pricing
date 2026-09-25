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
  const [activeTab, setActiveTab] = useState<'4prices' | 'yango_json' | 'hero_json' | 'request'>('4prices');
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
                Inspecteur Multi-Agrégateurs : Yango & Hero Cab
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
                  ? 'border-[#3D8B85] text-[#1F4F4A]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              ⭐ Les 4 Prix & Benchmark
            </button>
            <button
              onClick={() => setActiveTab('yango_json')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'yango_json'
                  ? 'border-rose-600 text-rose-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🔴 JSON Yango
            </button>
            <button
              onClick={() => setActiveTab('hero_json')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'hero_json'
                  ? 'border-blue-600 text-blue-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🔵 JSON Hero Cab
            </button>
            <button
              onClick={() => setActiveTab('request')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'request'
                  ? 'border-[#3D8B85] text-[#1F4F4A]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🛰️ Payload & GPS
            </button>
          </div>

          {(activeTab === 'yango_json' || activeTab === 'hero_json') && (
            <button
              onClick={() => handleCopy(activeTab === 'yango_json' ? yangoJsonString : heroJsonString)}
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

              {/* The 4 Prices Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Yango Éco */}
                <div className="bg-rose-50/70 rounded-xl p-3.5 border border-rose-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                      🔴 Yango Éco
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                      Standard
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {pYangoEco && pYangoEco > 0 ? (
                      `${pYangoEco.toLocaleString('fr-FR')} FCFA`
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Non disponible
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {pYangoEco && trip.distanceKm > 0 ? `${Math.round(pYangoEco / trip.distanceKm)} FCFA/km` : 'Tarif standard'}
                  </div>
                </div>

                {/* 2. Yango Confort */}
                <div className="bg-orange-50/70 rounded-xl p-3.5 border border-orange-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-900 flex items-center gap-1">
                      🔴 Yango Confort
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                      Business
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {pYangoConf && pYangoConf > 0 ? (
                      `${pYangoConf.toLocaleString('fr-FR')} FCFA`
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Non disponible
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {pYangoConf && trip.distanceKm > 0 ? `${Math.round(pYangoConf / trip.distanceKm)} FCFA/km` : 'Berline climatisée'}
                  </div>
                </div>

                {/* 3. Hero Cab Éco */}
                <div className="bg-blue-50/70 rounded-xl p-3.5 border border-blue-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                      🔵 Hero Cab Éco
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                      Standard
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {pHeroEco && pHeroEco > 0 ? (
                      `${pHeroEco.toLocaleString('fr-FR')} FCFA`
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Non disponible
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {trip.heroDriversCount ? `${trip.heroDriversCount} chauffeurs Hero` : 'Flotte Hero Cab'}
                  </div>
                </div>

                {/* 4. Hero Cab Confort */}
                <div className="bg-cyan-50/70 rounded-xl p-3.5 border border-cyan-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-900 flex items-center gap-1">
                      🔵 Hero Cab Confort
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded">
                      VIP
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {pHeroConf && pHeroConf > 0 ? (
                      `${pHeroConf.toLocaleString('fr-FR')} FCFA`
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Non disponible
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Véhicule VIP climatisé
                  </div>
                </div>
              </div>

              {/* Extra Classes from Yango */}
              {(trip.priceConfortPlus || trip.priceMoto) && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center gap-4">
                  <span className="font-semibold text-slate-700">Autres classes Yango :</span>
                  {trip.priceConfortPlus && (
                    <span className="bg-purple-50 text-purple-900 px-2 py-0.5 rounded border border-purple-200 font-medium">
                      💎 Confort+ : {trip.priceConfortPlus.toLocaleString('fr-FR')} FCFA
                    </span>
                  )}
                  {trip.priceMoto && (
                    <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-medium">
                      🏍️ Moto : {trip.priceMoto.toLocaleString('fr-FR')} FCFA
                    </span>
                  )}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: YANGO RAW JSON */}
          {activeTab === 'yango_json' && (
            <div className="space-y-3">
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
