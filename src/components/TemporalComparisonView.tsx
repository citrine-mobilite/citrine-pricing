import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PricingCampaign, City } from '../types';
import { SearchableSelect, SearchableOption } from './SearchableSelect';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  LineChart as LineChartIcon,
  BarChart3,
  PieChart as PieChartIcon,
  Filter,
  RotateCcw,
  MapPin,
  Building2,
  Zap
} from 'lucide-react';
import Highcharts from 'highcharts';

interface TemporalComparisonViewProps {
  campaigns: PricingCampaign[];
  cities?: City[];
  onSelectCampaign?: (campaignId: string) => void;
}

type ComparisonMode =
  | 'campaign_pair'
  | 'today'
  | 'yesterday_today'
  | 'week'
  | 'month'
  | 'three_months'
  | 'six_months'
  | 'current_year'
  | 'custom_date';

type VehicleClassKey = 'eco' | 'confort';
type ChartType = 'spline' | 'column' | 'pie';

interface VehicleClassConfig {
  key: VehicleClassKey;
  label: string;
}

const VEHICLE_CLASSES: VehicleClassConfig[] = [
  { key: 'eco', label: 'Standard / Éco' },
  { key: 'confort', label: 'Confort' }
];

export const TemporalComparisonView: React.FC<TemporalComparisonViewProps> = ({
  campaigns,
  cities = []
}) => {
  const [selectedClass, setSelectedClass] = useState<VehicleClassKey>('eco');
  const [mode, setMode] = useState<ComparisonMode>('campaign_pair');
  const [chartType, setChartType] = useState<ChartType>('spline');

  // Filtres analytiques de l'historique d'évolution
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'city_wide' | 'arrondissement' | 'test_sample'>('all');
  const [arrondissementFilter, setArrondissementFilter] = useState<string>('all');
  const [jamsFilter, setJamsFilter] = useState<'all' | 'with_jams' | 'without_jams'>('all');

  const availableArrondissements = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach(c => {
      if (c.arrondissement) set.add(c.arrondissement);
    });
    ['Douala 1er', 'Douala 2e', 'Douala 3e', 'Douala 4e', 'Douala 5e', 'Yaoundé 1er', 'Yaoundé 2e', 'Yaoundé 3e', 'Yaoundé 4e', 'Yaoundé 5e', 'Yaoundé 6e', 'Yaoundé 7e'].forEach(a => set.add(a));
    return Array.from(set).sort();
  }, [campaigns]);

  // Campagnes filtrées pour l'évolution temporelle
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (cityFilter !== 'all' && c.cityId !== cityFilter) return false;

      const isSample = Boolean(c.isTestSample || (c.sampleLimit && c.sampleLimit <= 50) || (c.totalPairs && c.totalPairs <= 50));
      const isIntra = Boolean(c.scopeMode === 'intra' || c.arrondissement);

      if (scopeFilter === 'test_sample' && !isSample) return false;
      if (scopeFilter === 'city_wide' && (isSample || isIntra)) return false;
      if (scopeFilter === 'arrondissement') {
        if (!isIntra) return false;
        if (arrondissementFilter !== 'all' && c.arrondissement !== arrondissementFilter) return false;
      }

      if (jamsFilter === 'with_jams') {
        if (!c.hasJamsCount || c.hasJamsCount <= 0) return false;
      } else if (jamsFilter === 'without_jams') {
        if (c.hasJamsCount && c.hasJamsCount > 0) return false;
      }

      return true;
    });
  }, [campaigns, cityFilter, scopeFilter, arrondissementFilter, jamsFilter]);

  // Format default custom date to today YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);
  const [customDate, setCustomDate] = useState<string>(todayStr);

  // Sort campaigns chronologically descending (newest first)
  const sorted = useMemo(() => {
    return [...filteredCampaigns].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [filteredCampaigns]);

  // Initial selection for pairwise mode: most recent (B) vs previous (A)
  const [campaignAId, setCampaignAId] = useState<string>(sorted[1]?.id || sorted[0]?.id || '');
  const [campaignBId, setCampaignBId] = useState<string>(sorted[0]?.id || '');

  useEffect(() => {
    if (sorted.length > 0) {
      if (!sorted.some(c => c.id === campaignBId)) {
        setCampaignBId(sorted[0]?.id || '');
      }
      if (!sorted.some(c => c.id === campaignAId)) {
        setCampaignAId(sorted[1]?.id || sorted[0]?.id || '');
      }
    }
  }, [sorted]);

  // Helper to extract class price for a campaign
  const getClassPrice = (c: PricingCampaign, op: 'yango' | 'hero' | 'tripmaster', cls: VehicleClassKey): number => {
    if (!c) return 0;
    const basePrice = c.avgPrice || 0;
    const heroBase = c.heroStats?.avgPrice || 0;
    const tmBase = c.tripMasterStats?.avgPrice || 0;

    if (cls === 'eco') {
      if (op === 'yango') return c.classStats?.econom?.avgPrice || basePrice;
      if (op === 'hero') return heroBase;
      return tmBase;
    }
    if (cls === 'confort') {
      if (op === 'yango') return c.classStats?.business?.avgPrice || (basePrice ? Math.round(basePrice * 1.35) : 0);
      if (op === 'hero') return c.classesStats?.confort?.avgPrice || (heroBase ? Math.round(heroBase * 1.35) : 0);
      return tmBase ? Math.round(tmBase * 1.35) : 0;
    }
    if (cls === 'suv') {
      if (op === 'yango') return c.classStats?.comfortplus?.avgPrice || (basePrice ? Math.round(basePrice * 1.75) : 0);
      if (op === 'hero') return c.classesStats?.suv?.avgPrice || (heroBase ? Math.round(heroBase * 1.75) : 0);
      return tmBase ? Math.round(tmBase * 1.75) : 0;
    }
    if (cls === 'moto') {
      if (op === 'yango') return c.classStats?.moto?.avgPrice || (basePrice ? Math.round(basePrice * 0.45) : 0);
      if (op === 'hero') return c.classesStats?.moto?.avgPrice || (heroBase ? Math.round(heroBase * 0.45) : 0);
      return tmBase ? Math.round(tmBase * 0.45) : 0;
    }
    return 0;
  };

  // Helper to aggregate list of campaigns for the chosen vehicle class
  const aggregateClassPrices = (list: PricingCampaign[], cls: VehicleClassKey) => {
    if (list.length === 0) return { yango: 0, hero: 0, tripmaster: 0, count: 0 };
    let sumY = 0, countY = 0;
    let sumH = 0, countH = 0;
    let sumT = 0, countT = 0;

    for (const c of list) {
      const y = getClassPrice(c, 'yango', cls);
      const h = getClassPrice(c, 'hero', cls);
      const t = getClassPrice(c, 'tripmaster', cls);

      if (y > 0) { sumY += y; countY++; }
      if (h > 0) { sumH += h; countH++; }
      if (t > 0) { sumT += t; countT++; }
    }

    return {
      yango: countY > 0 ? Math.round(sumY / countY) : 0,
      hero: countH > 0 ? Math.round(sumH / countH) : 0,
      tripmaster: countT > 0 ? Math.round(sumT / countT) : 0,
      count: list.length
    };
  };

  // Group campaigns into time windows (pure client-side execution)
  const timeBuckets = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 3600 * 1000;
    const startOf7DaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
    const startOf14DaysAgo = now.getTime() - 14 * 24 * 3600 * 1000;
    const startOf30DaysAgo = now.getTime() - 30 * 24 * 3600 * 1000;
    const startOf60DaysAgo = now.getTime() - 60 * 24 * 3600 * 1000;
    const startOf90DaysAgo = now.getTime() - 90 * 24 * 3600 * 1000;
    const startOf180DaysAgo = now.getTime() - 180 * 24 * 3600 * 1000;
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1).getTime();

    // Specific Custom Date window
    const customDateStart = customDate ? new Date(`${customDate}T00:00:00`).getTime() : 0;
    const customDateEnd = customDateStart + 24 * 3600 * 1000;
    const customDatePrevStart = customDateStart - 24 * 3600 * 1000;

    return {
      today: sorted.filter(c => new Date(c.startedAt).getTime() >= startOfToday),
      yesterday: sorted.filter(c => {
        const t = new Date(c.startedAt).getTime();
        return t >= startOfYesterday && t < startOfToday;
      }),
      thisWeek: sorted.filter(c => new Date(c.startedAt).getTime() >= startOf7DaysAgo),
      lastWeek: sorted.filter(c => {
        const t = new Date(c.startedAt).getTime();
        return t >= startOf14DaysAgo && t < startOf7DaysAgo;
      }),
      thisMonth: sorted.filter(c => new Date(c.startedAt).getTime() >= startOf30DaysAgo),
      lastMonth: sorted.filter(c => {
        const t = new Date(c.startedAt).getTime();
        return t >= startOf60DaysAgo && t < startOf30DaysAgo;
      }),
      threeMonths: sorted.filter(c => new Date(c.startedAt).getTime() >= startOf90DaysAgo),
      sixMonths: sorted.filter(c => new Date(c.startedAt).getTime() >= startOf180DaysAgo),
      currentYear: sorted.filter(c => new Date(c.startedAt).getTime() >= startOfYear),
      previousYear: sorted.filter(c => {
        const t = new Date(c.startedAt).getTime();
        return t >= startOfPrevYear && t < startOfYear;
      }),
      customDateCampaigns: sorted.filter(c => {
        const t = new Date(c.startedAt).getTime();
        return t >= customDateStart && t < customDateEnd;
      }),
      customDatePrevCampaigns: sorted.filter(c => {
        const t = new Date(c.startedAt).getTime();
        return t >= customDatePrevStart && t < customDateStart;
      })
    };
  }, [sorted, customDate]);

  // Main computed comparison metrics
  const comparison = useMemo(() => {
    let labelA = '';
    let labelB = '';
    let statsA = { yango: 0, hero: 0, tripmaster: 0, count: 0 };
    let statsB = { yango: 0, hero: 0, tripmaster: 0, count: 0 };
    let relevantCampaigns: PricingCampaign[] = [];

    if (mode === 'campaign_pair') {
      const campA = sorted.find(c => c.id === campaignAId);
      const campB = sorted.find(c => c.id === campaignBId);
      if (!campA || !campB) return null;

      labelA = `${campA.cityName} (${new Date(campA.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})`;
      labelB = `${campB.cityName} (${new Date(campB.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})`;
      statsA = aggregateClassPrices([campA], selectedClass);
      statsB = aggregateClassPrices([campB], selectedClass);
      relevantCampaigns = [campB, campA];
    } else if (mode === 'today') {
      labelA = 'Matin';
      labelB = 'Plus récent';
      if (timeBuckets.today.length >= 2) {
        const oldest = timeBuckets.today[timeBuckets.today.length - 1];
        const latest = timeBuckets.today[0];
        labelA = new Date(oldest.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        labelB = new Date(latest.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        statsA = aggregateClassPrices([oldest], selectedClass);
        statsB = aggregateClassPrices([latest], selectedClass);
      } else {
        statsA = aggregateClassPrices(timeBuckets.today, selectedClass);
        statsB = aggregateClassPrices(timeBuckets.today, selectedClass);
      }
      relevantCampaigns = timeBuckets.today.length > 0 ? timeBuckets.today : sorted.slice(0, 5);
    } else if (mode === 'yesterday_today') {
      labelA = 'Hier';
      labelB = "Aujourd'hui";
      statsA = aggregateClassPrices(timeBuckets.yesterday, selectedClass);
      statsB = aggregateClassPrices(timeBuckets.today, selectedClass);
      relevantCampaigns = [...timeBuckets.today, ...timeBuckets.yesterday];
    } else if (mode === 'week') {
      labelA = 'Semaine précédente';
      labelB = 'Cette semaine (7j)';
      statsA = aggregateClassPrices(timeBuckets.lastWeek, selectedClass);
      statsB = aggregateClassPrices(timeBuckets.thisWeek, selectedClass);
      relevantCampaigns = timeBuckets.thisWeek;
    } else if (mode === 'month') {
      labelA = 'Mois précédent';
      labelB = 'Ce mois (30j)';
      statsA = aggregateClassPrices(timeBuckets.lastMonth, selectedClass);
      statsB = aggregateClassPrices(timeBuckets.thisMonth, selectedClass);
      relevantCampaigns = timeBuckets.thisMonth;
    } else if (mode === 'three_months') {
      labelA = 'Trimestre précédent';
      labelB = '3 Derniers Mois';
      statsA = aggregateClassPrices(timeBuckets.sixMonths.slice(timeBuckets.threeMonths.length), selectedClass);
      statsB = aggregateClassPrices(timeBuckets.threeMonths, selectedClass);
      relevantCampaigns = timeBuckets.threeMonths;
    } else if (mode === 'six_months') {
      labelA = 'Semestre précédent';
      labelB = '6 Derniers Mois';
      statsA = aggregateClassPrices(sorted.slice(timeBuckets.sixMonths.length), selectedClass);
      statsB = aggregateClassPrices(timeBuckets.sixMonths, selectedClass);
      relevantCampaigns = timeBuckets.sixMonths;
    } else if (mode === 'current_year') {
      const year = new Date().getFullYear();
      labelA = `Année ${year - 1}`;
      labelB = `Année en cours (${year})`;
      statsA = aggregateClassPrices(timeBuckets.previousYear, selectedClass);
      statsB = aggregateClassPrices(timeBuckets.currentYear, selectedClass);
      relevantCampaigns = timeBuckets.currentYear;
    } else if (mode === 'custom_date') {
      const formattedDate = new Date(`${customDate}T12:00:00`).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      labelA = 'Jour précédent';
      labelB = formattedDate;
      statsA = aggregateClassPrices(timeBuckets.customDatePrevCampaigns, selectedClass);
      statsB = aggregateClassPrices(timeBuckets.customDateCampaigns, selectedClass);
      relevantCampaigns = timeBuckets.customDateCampaigns;
    }

    const calcDelta = (a: number, b: number) => {
      const delta = b - a;
      const pct = a > 0 ? Number(((delta / a) * 100).toFixed(1)) : 0;
      return { a, b, delta, pct };
    };

    return {
      labelA,
      labelB,
      yango: calcDelta(statsA.yango, statsB.yango),
      hero: calcDelta(statsA.hero, statsB.hero),
      tripmaster: calcDelta(statsA.tripmaster, statsB.tripmaster),
      relevantCampaigns: relevantCampaigns.length > 0 ? relevantCampaigns : sorted.slice(0, 10)
    };
  }, [mode, sorted, campaignAId, campaignBId, selectedClass, timeBuckets, customDate]);

  // Highcharts Options configuration
  const highchartsOptions = useMemo<Highcharts.Options>(() => {
    if (!comparison || comparison.relevantCampaigns.length === 0) {
      return {
        title: { text: undefined },
        series: []
      };
    }

    // Sort chronologically oldest -> newest for the X axis
    const ordered = [...comparison.relevantCampaigns].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );

    const categories = ordered.map((c) => {
      const dateObj = new Date(c.startedAt);
      if (isNaN(dateObj.getTime())) return '—';

      const now = new Date();
      const todayStr = now.toLocaleDateString('fr-FR');

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString('fr-FR');

      const dStr = dateObj.toLocaleDateString('fr-FR');
      const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      if (dStr === todayStr) {
        return `Aujourd'hui ${timeStr}`;
      } else if (dStr === yesterdayStr) {
        return `Hier ${timeStr}`;
      } else {
        const dayMonth = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        return `${dayMonth} à ${timeStr}`;
      }
    });

    const heroData = ordered.map((c) => {
      const p = getClassPrice(c, 'hero', selectedClass);
      return p > 0 ? p : null;
    });

    const yangoData = ordered.map((c) => {
      const p = getClassPrice(c, 'yango', selectedClass);
      return p > 0 ? p : null;
    });

    const tripmasterData = ordered.map((c) => {
      const p = getClassPrice(c, 'tripmaster', selectedClass);
      return p > 0 ? p : null;
    });

    const currentClassLabel = VEHICLE_CLASSES.find(v => v.key === selectedClass)?.label || '';
    const isPie = chartType === 'pie';

    // Calculate overall averages for pie chart
    const heroValid = heroData.filter(v => v !== null && v > 0) as number[];
    const yangoValid = yangoData.filter(v => v !== null && v > 0) as number[];
    const tripmasterValid = tripmasterData.filter(v => v !== null && v > 0) as number[];

    const avgHero = heroValid.length ? Math.round(heroValid.reduce((a, b) => a + b, 0) / heroValid.length) : 0;
    const avgYango = yangoValid.length ? Math.round(yangoValid.reduce((a, b) => a + b, 0) / yangoValid.length) : 0;
    const avgTripMaster = tripmasterValid.length ? Math.round(tripmasterValid.reduce((a, b) => a + b, 0) / tripmasterValid.length) : 0;

    return {
      chart: {
        type: chartType,
        backgroundColor: '#FFFFFF',
        style: {
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        },
        height: 330
      },
      title: {
        text: undefined
      },
      credits: {
        enabled: false
      },
      exporting: {
        enabled: false
      },
      xAxis: isPie ? undefined : {
        categories,
        crosshair: {
          width: 1,
          color: '#CBD5E1',
          dashStyle: 'ShortDash'
        },
        labels: {
          style: {
            color: '#64748B',
            fontSize: '11px'
          }
        },
        lineColor: '#E2E8F0',
        tickColor: '#E2E8F0'
      },
      yAxis: isPie ? undefined : {
        title: {
          text: 'Prix Moyen (FCFA)',
          style: {
            color: '#64748B',
            fontSize: '11px'
          }
        },
        labels: {
          formatter: function () {
            return `${Number(this.value).toLocaleString('fr-FR')} F`;
          },
          style: {
            color: '#64748B',
            fontSize: '11px'
          }
        },
        gridLineColor: '#F1F5F9',
        gridLineDashStyle: 'Dash'
      },
      tooltip: isPie
        ? {
            useHTML: true,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#334155',
            borderRadius: 8,
            shadow: true,
            style: { color: '#FFFFFF' },
            formatter: function (this: any) {
              const name = this.key || this.point?.name || '';
              const color = this.color || this.point?.color || '#1F4F4A';
              const val = this.y != null ? Number(this.y).toLocaleString('fr-FR') : '0';
              const pct = this.percentage ? this.percentage.toFixed(1) : '0';
              return `<div style="font-size: 11px; padding: 4px;">
                <div style="font-weight: 700; color: ${color}; font-size: 12px; margin-bottom: 3px;">● ${name}</div>
                <div style="font-family: monospace; font-size: 12px; font-weight: 700; color: #FFF;">
                  Prix Moyen : ${val} FCFA
                </div>
                <div style="color: #94A3B8; font-size: 10.5px; margin-top: 3px;">
                  Part du tarif comparé : ${pct}%
                </div>
              </div>`;
            }
          }
        : {
            shared: true,
            useHTML: true,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#334155',
            borderRadius: 8,
            shadow: true,
            style: {
              color: '#FFFFFF'
            },
            formatter: function () {
              let s = `<div style="font-size: 11px; padding: 4px; min-width: 190px;">`;
              s += `<div style="font-weight: 600; color: #E2E8F0; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">${this.x}</div>`;
              let heroVal: number | null = null;
              let yangoVal: number | null = null;
              (this.points || []).forEach(point => {
                const val = point.y != null ? `${Number(point.y).toLocaleString('fr-FR')} FCFA` : '—';
                if (point.series.name === 'Hero Cab') heroVal = point.y as number;
                if (point.series.name === 'Yango') yangoVal = point.y as number;
                s += `<div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 3px;">
                  <span style="color: ${point.color}; font-weight: 600;">● ${point.series.name}:</span>
                  <span style="font-family: monospace; font-weight: 700; color: #FFFFFF;">${val}</span>
                </div>`;
              });
              if (heroVal !== null && yangoVal !== null && heroVal > 0 && yangoVal > 0) {
                const diff = heroVal - yangoVal;
                const pct = ((diff / yangoVal) * 100).toFixed(1);
                const isHeroCheaper = diff < 0;
                const diffColor = isHeroCheaper ? '#34D399' : (diff > 0 ? '#F87171' : '#94A3B8');
                const diffLabel = isHeroCheaper
                  ? `Hero -${Math.abs(diff).toLocaleString('fr-FR')} F (${pct}%)`
                  : (diff > 0 ? `Hero +${diff.toLocaleString('fr-FR')} F (+${pct}%)` : 'Tarifs identiques');
                s += `<div style="margin-top: 6px; padding-top: 5px; border-top: 1px dashed #334155; display: flex; align-items: center; justify-content: space-between; font-size: 10.5px;">
                  <span style="color: #94A3B8;">Écart Hero/Yango:</span>
                  <span style="color: ${diffColor}; font-weight: 700;">${diffLabel}</span>
                </div>`;
              }
              s += `</div>`;
              return s;
            }
          },
      legend: {
        align: 'right',
        verticalAlign: 'top',
        itemStyle: {
          color: '#1E293B',
          fontSize: '12px',
          fontWeight: '600'
        },
        itemHoverStyle: {
          color: '#0F172A'
        }
      },
      plotOptions: {
        series: {
          borderWidth: 0,
          borderRadius: 4
        },
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: {
            enabled: true,
            format: '<b>{point.name}</b><br/>{point.y:,.0f} FCFA ({point.percentage:.1f}%)',
            style: { fontSize: '11px', color: '#1E293B', fontWeight: '600' }
          },
          showInLegend: true
        },
        spline: {
          lineWidth: 2.5,
          marker: { radius: 3.5, symbol: 'circle' }
        },
        column: {
          groupPadding: 0.15,
          pointPadding: 0.05
        }
      },
      series: isPie
        ? [
            {
              type: 'pie',
              name: 'Prix Moyen',
              innerSize: '40%',
              data: [
                { name: 'Hero Cab', y: avgHero, color: '#1F4F4A' },
                { name: 'Yango', y: avgYango, color: '#F43F5E' },
                { name: 'Trip Master', y: avgTripMaster, color: '#2563EB' }
              ].filter(p => p.y > 0)
            }
          ]
        : [
            {
              type: chartType as any,
              name: 'Hero Cab',
              data: heroData,
              color: '#1F4F4A',
              lineWidth: 3,
              marker: {
                fillColor: '#1F4F4A',
                lineWidth: 2,
                lineColor: '#FFFFFF'
              }
            },
            {
              type: chartType as any,
              name: 'Yango',
              data: yangoData,
              color: '#F43F5E',
              marker: {
                fillColor: '#F43F5E',
                lineWidth: 2,
                lineColor: '#FFFFFF'
              }
            },
            {
              type: chartType as any,
              name: 'Trip Master',
              data: tripmasterData,
              color: '#2563EB',
              marker: {
                fillColor: '#2563EB',
                lineWidth: 2,
                lineColor: '#FFFFFF'
              }
            }
          ]
    };
  }, [comparison, mode, selectedClass, chartType]);

  // Ref and Lifecycle for direct Highcharts DOM attachment (100% stable, no wrapper errors)
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.destroy();
      } catch {
        // Safe destroy
      }
      chartInstanceRef.current = null;
    }

    if (highchartsOptions.series && highchartsOptions.series.length > 0) {
      try {
        chartInstanceRef.current = Highcharts.chart(chartContainerRef.current, highchartsOptions);
      } catch (err) {
        console.error('Highcharts init error:', err);
      }
    }

    return () => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy();
        } catch {
          // Safe destroy
        }
        chartInstanceRef.current = null;
      }
    };
  }, [highchartsOptions]);

  const renderDelta = (pct: number, delta: number) => {
    if (pct > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
          <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
          <span>+{pct}% (+{delta.toLocaleString('fr-FR')} F)</span>
        </span>
      );
    }
    if (pct < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
          <span>{pct}% ({delta.toLocaleString('fr-FR')} F)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
        <Minus className="w-3.5 h-3.5 text-slate-400" />
        <span>0%</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* 0. Barre de filtres de l'évolution temporelle */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#1F4F4A] flex items-center justify-center">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span>Filtrer l'Historique d'Évolution</span>
                <span className="text-[11px] font-semibold text-[#1F4F4A] bg-teal-50 px-2 py-0.5 rounded-full normal-case">
                  {filteredCampaigns.length} / {campaigns.length} relevé(s) analysé(s)
                </span>
              </h3>
            </div>
          </div>

          {(cityFilter !== 'all' || scopeFilter !== 'all' || arrondissementFilter !== 'all' || jamsFilter !== 'all') && (
            <button
              onClick={() => {
                setCityFilter('all');
                setScopeFilter('all');
                setArrondissementFilter('all');
                setJamsFilter('all');
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser les filtres</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          {/* Ville */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
              <Building2 className="w-3 h-3 text-[#1F4F4A]" />
              <span>Ville</span>
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
            >
              <option value="all">Toutes les villes</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Périmètre */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#1F4F4A]" />
              <span>Périmètre</span>
            </label>
            <select
              value={scopeFilter}
              onChange={(e) => {
                setScopeFilter(e.target.value as any);
                if (e.target.value !== 'arrondissement') setArrondissementFilter('all');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
            >
              <option value="all">Tous les périmètres</option>
              <option value="city_wide">Ville entière</option>
              <option value="arrondissement">Par Arrondissement</option>
              <option value="test_sample">Échantillons test (&le; 50)</option>
            </select>
          </div>

          {/* Arrondissement Spécifique si sélectionné */}
          {scopeFilter === 'arrondissement' ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                <MapPin className="w-3 h-3 text-teal-600" />
                <span>Arrondissement</span>
              </label>
              <select
                value={arrondissementFilter}
                onChange={(e) => setArrondissementFilter(e.target.value)}
                className="w-full bg-teal-50 border border-teal-300 text-teal-900 rounded-lg px-2.5 py-1.5 font-medium text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
              >
                <option value="all">Tous les arrondissements</option>
                {availableArrondissements.map((arr) => (
                  <option key={arr} value={arr}>{arr}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Trafic / Heures de pointe</span>
              </label>
              <select
                value={jamsFilter}
                onChange={(e) => setJamsFilter(e.target.value as any)}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-medium text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none ${
                  jamsFilter === 'with_jams'
                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">Tous (Pointe & Fluide)</option>
                <option value="with_jams">🚗 En pointe / trafic dense (jams)</option>
                <option value="without_jams">🟢 Fluide uniquement</option>
              </select>
            </div>
          )}

          {/* 4e colonne si scopeFilter === 'arrondissement' */}
          {scopeFilter === 'arrondissement' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Trafic / Heures de pointe</span>
              </label>
              <select
                value={jamsFilter}
                onChange={(e) => setJamsFilter(e.target.value as any)}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-medium text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none ${
                  jamsFilter === 'with_jams'
                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">Tous (Pointe & Fluide)</option>
                <option value="with_jams">🚗 En pointe / trafic dense (jams)</option>
                <option value="without_jams">🟢 Fluide uniquement</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Header and Controls */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs space-y-3">
        
        {/* Title & Vehicle Class Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Évolution des Prix
          </h1>

          {/* Vehicle Class Selector (Dropdown Searchable & Buttons) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">Classe de Véhicule :</span>
            <SearchableSelect
              options={VEHICLE_CLASSES.map((vc) => ({
                value: vc.key,
                label: vc.label,
                sublabel: vc.key === 'eco' ? 'Tarif Standard Yango & Hero Cab' : 'Gamme Confort'
              }))}
              value={selectedClass}
              onChange={(v) => setSelectedClass(v as VehicleClassKey)}
              searchPlaceholder="Choisir Éco ou Confort..."
            />
          </div>
        </div>

        {/* Extended Period Mode Selector */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => setMode('campaign_pair')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
              mode === 'campaign_pair'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Relevé vs Relevé
          </button>
          <button
            onClick={() => setMode('today')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
              mode === 'today'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setMode('yesterday_today')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
              mode === 'yesterday_today'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Hier vs Aujourd'hui
          </button>
          <button
            onClick={() => setMode('week')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
              mode === 'week'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            7 Jours
          </button>
          <button
            onClick={() => setMode('month')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
              mode === 'month'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            30 Jours
          </button>
          <button
            onClick={() => setMode('three_months')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
              mode === 'three_months'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            3 Mois
          </button>
          <button
            onClick={() => setMode('six_months')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
              mode === 'six_months'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            6 Mois
          </button>
          <button
            onClick={() => setMode('current_year')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
              mode === 'current_year'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Année en cours
          </button>
          <button
            onClick={() => setMode('custom_date')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
              mode === 'custom_date'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Date précise</span>
          </button>
        </div>

        {/* Date Selector for Custom Date Mode */}
        {mode === 'custom_date' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <label className="text-slate-500 font-medium">Choisir un jour :</label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
            />
          </div>
        )}

        {/* Pair Pickers (if pairwise mode) */}
        {mode === 'campaign_pair' && sorted.length >= 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Période A (Référence)</label>
              <SearchableSelect
                options={sorted.map((c) => ({
                  value: c.id,
                  label: `${c.cityName} — ${new Date(c.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
                  sublabel: `${c.completedPairs || 0} trajets - Moyenne: ${c.avgPrice ? c.avgPrice + ' F' : '—'}`
                }))}
                value={campaignAId}
                onChange={setCampaignAId}
                searchPlaceholder="Rechercher une campagne A..."
                className="w-full"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Période B (Comparée)</label>
              <SearchableSelect
                options={sorted.map((c) => ({
                  value: c.id,
                  label: `${c.cityName} — ${new Date(c.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
                  sublabel: `${c.completedPairs || 0} trajets - Moyenne: ${c.avgPrice ? c.avgPrice + ' F' : '—'}`
                }))}
                value={campaignBId}
                onChange={setCampaignBId}
                searchPlaceholder="Rechercher une campagne B..."
                className="w-full"
              />
            </div>
          </div>
        )}

      </div>

      {/* Summary Comparison Table (Top) */}
      {comparison && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2.5 px-4">Opérateur ({VEHICLE_CLASSES.find(v => v.key === selectedClass)?.label})</th>
                  <th className="py-2.5 px-3 text-right">{comparison.labelA}</th>
                  <th className="py-2.5 px-3 text-right">{comparison.labelB}</th>
                  <th className="py-2.5 px-4 text-right">Variation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                
                {/* Yango Row */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-sans font-medium text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    <span>Yango</span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {comparison.yango.a > 0 ? `${comparison.yango.a.toLocaleString('fr-FR')} F` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-900">
                    {comparison.yango.b > 0 ? `${comparison.yango.b.toLocaleString('fr-FR')} F` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {renderDelta(comparison.yango.pct, comparison.yango.delta)}
                  </td>
                </tr>

                {/* Hero Cab Row */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-sans font-medium text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1F4F4A] shrink-0" />
                    <span>Hero Cab</span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {comparison.hero.a > 0 ? `${comparison.hero.a.toLocaleString('fr-FR')} F` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-[#1F4F4A]">
                    {comparison.hero.b > 0 ? `${comparison.hero.b.toLocaleString('fr-FR')} F` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {renderDelta(comparison.hero.pct, comparison.hero.delta)}
                  </td>
                </tr>

                {/* Trip Master Row */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-sans font-medium text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                    <span>Trip Master</span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {comparison.tripmaster.a > 0 ? `${comparison.tripmaster.a.toLocaleString('fr-FR')} F` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-800">
                    {comparison.tripmaster.b > 0 ? `${comparison.tripmaster.b.toLocaleString('fr-FR')} F` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {renderDelta(comparison.tripmaster.pct, comparison.tripmaster.delta)}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HIGHCHARTS CARD WITH 3 LINES AND BUILT-IN EXPORTING */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        
        {/* Card Header & Chart Type Selector */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <LineChartIcon className="w-4 h-4 text-[#1F4F4A]" />
            <h2 className="text-xs font-bold text-slate-900 tracking-tight">
              Graphique d'Évolution des Tarifs ({VEHICLE_CLASSES.find(v => v.key === selectedClass)?.label})
            </h2>
          </div>

          {/* Chart Type Selector Dropdown / Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Type de graphique :</span>
            <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-lg shadow-2xs">
              <button
                type="button"
                onClick={() => setChartType('spline')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  chartType === 'spline' ? 'bg-[#1F4F4A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Courbes d'évolution"
              >
                <LineChartIcon className="w-3.5 h-3.5" />
                <span>Courbes</span>
              </button>

              <button
                type="button"
                onClick={() => setChartType('column')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  chartType === 'column' ? 'bg-[#1F4F4A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Histogramme / Barres"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Barres</span>
              </button>

              <button
                type="button"
                onClick={() => setChartType('pie')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  chartType === 'pie' ? 'bg-[#1F4F4A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Répartition Camembert"
              >
                <PieChartIcon className="w-3.5 h-3.5" />
                <span>Camembert</span>
              </button>
            </div>
          </div>
        </div>

        {/* Highcharts Render Container */}
        <div className="p-3 sm:p-5">
          {comparison && comparison.relevantCampaigns.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Aucun relevé disponible pour afficher le graphique sur cette période.
            </div>
          ) : (
            <div ref={chartContainerRef} className="w-full min-h-[320px]" />
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {comparison?.relevantCampaigns.length || 0} relevés analysés pour la classe <b>{VEHICLE_CLASSES.find(v => v.key === selectedClass)?.label}</b>
          </span>
          <span className="font-medium text-slate-600">
            Comparatif en direct Yango vs Hero Cab vs Trip Master
          </span>
        </div>

      </div>

    </div>
  );
};
