import React, { useState } from 'react';
import { TripResult } from '../types';
import { X, Scale, CheckCircle2, ArrowRight } from 'lucide-react';
import { InspectorComparisonTab } from './inspector/InspectorComparisonTab';
import { InspectorJsonTab } from './inspector/InspectorJsonTab';
import { InspectorRequestTab } from './inspector/InspectorRequestTab';

interface YangoResponseInspectorModalProps {
  trip: TripResult | null;
  onClose: () => void;
}

export const YangoResponseInspectorModal: React.FC<YangoResponseInspectorModalProps> = ({
  trip,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'4prices' | 'yango_json' | 'hero_json' | 'tripmaster_json' | 'request'>('4prices');
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

  const pYangoEco = trip.priceEconom || trip.classes?.econom?.price || (trip.tariffClass === 'econom' ? trip.price : null);
  const pYangoConf = trip.priceConfort || trip.classes?.business?.price || trip.classes?.comfort?.price || (trip.tariffClass === 'comfort' ? trip.price : null);
  const pYangoConfPlus = trip.priceConfortPlus || trip.classes?.comfortplus?.price;
  const pYangoMoto = trip.priceMoto || trip.classes?.moto?.price;

  const pHeroEco = trip.priceHeroStandard || trip.heroQuote?.priceStandard || trip.priceHero;
  const pHeroConf = trip.priceHeroConfort || trip.heroQuote?.priceConfort;
  const pHeroSuv = trip.priceHeroSuv || trip.heroQuote?.priceSuv;

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
              <span className="p-1 rounded-md bg-[#1F4F4A]/10 text-[#1F4F4A]">
                <Scale className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">
                Inspecteur Multi-Agrégateurs : Yango, Hero Cab & Trip Master
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Live Data
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-0.5">
              <span className="font-semibold text-slate-900">{trip.startNeighborhoodName}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span className="font-semibold text-slate-900">{trip.endNeighborhoodName}</span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-600">{trip.distanceKm} km</span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-600">~{trip.durationMinutes} min</span>
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
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveTab('4prices')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === '4prices' ? 'border-[#1F4F4A] text-[#1F4F4A]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Comparatif & Tarifs
          </button>
          <button
            onClick={() => setActiveTab('yango_json')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'yango_json' ? 'border-[#1F4F4A] text-[#1F4F4A]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            JSON Yango
          </button>
          <button
            onClick={() => setActiveTab('hero_json')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'hero_json' ? 'border-[#1F4F4A] text-[#1F4F4A]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            JSON Hero Cab
          </button>
          <button
            onClick={() => setActiveTab('tripmaster_json')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'tripmaster_json' ? 'border-[#1F4F4A] text-[#1F4F4A]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            JSON Trip Master
          </button>
          <button
            onClick={() => setActiveTab('request')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'request' ? 'border-[#1F4F4A] text-[#1F4F4A]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Requête & Headers
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === '4prices' && (
            <InspectorComparisonTab
              trip={trip}
              pYangoEco={pYangoEco}
              pYangoConf={pYangoConf}
              pYangoConfPlus={pYangoConfPlus}
              pYangoMoto={pYangoMoto}
              pHeroEco={pHeroEco}
              pHeroConf={pHeroConf}
              pHeroSuv={pHeroSuv}
              pTripMasterEco={pTripMasterEco}
              pTripMasterConf={pTripMasterConf}
              pTripMasterMoto={pTripMasterMoto}
            />
          )}

          {activeTab === 'yango_json' && (
            <InspectorJsonTab jsonString={yangoJsonString} onCopy={handleCopy} copied={copied} />
          )}

          {activeTab === 'hero_json' && (
            <InspectorJsonTab jsonString={heroJsonString} onCopy={handleCopy} copied={copied} />
          )}

          {activeTab === 'tripmaster_json' && (
            <InspectorJsonTab jsonString={tripMasterJsonString} onCopy={handleCopy} copied={copied} />
          )}

          {activeTab === 'request' && <InspectorRequestTab trip={trip} />}
        </div>
      </div>
    </div>
  );
};
