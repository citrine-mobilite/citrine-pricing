import * as XLSX from 'xlsx';

/**
 * Helper to generate standardized campaign export filenames
 * Format requested: campagne_{ville}_{heure} (e.g. campagne_douala_8h15)
 */
export function formatCampaignFileName(cityName: string = 'douala', dateInput?: string | Date): string {
  const cleanCity = (cityName || 'douala')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim() || 'douala';

  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const hours = validDate.getHours();
  const minutes = String(validDate.getMinutes()).padStart(2, '0');

  return `campagne_${cleanCity}_${hours}h${minutes}`;
}

/**
 * Universal price extraction helper for Excel/PDF exports
 * Handles canonical t.prices structure as well as legacy flat properties
 */
export function extractPriceNum(t: any, provider: 'yango' | 'hero' | 'tripmaster', cls: string): number | '—' {
  if (!t) return '—';

  const parseVal = (v: any): number | null => {
    if (v === null || v === undefined || v === '' || v === '—') return null;
    if (typeof v === 'number') return isNaN(v) || v <= 0 ? null : Math.round(v);
    if (typeof v === 'string') {
      const clean = v.replace(/CFA|FCFA|XAF/gi, '').replace(/\s+/g, '').replace(/,/g, '.').replace(/[^\d.]/g, '');
      const num = parseFloat(clean);
      return isNaN(num) || num <= 0 ? null : Math.round(num);
    }
    return null;
  };

  // 1. Check t.prices canonical structure (highest priority)
  if (t.prices) {
    if (provider === 'yango' && t.prices.yango) {
      if (cls === 'eco') { const p = parseVal(t.prices.yango.eco); if (p) return p; }
      if (cls === 'confort') { const p = parseVal(t.prices.yango.confort); if (p) return p; }
      if (cls === 'confortPlus') { const p = parseVal(t.prices.yango.confortPlus); if (p) return p; }
      if (cls === 'moto') { const p = parseVal(t.prices.yango.moto); if (p) return p; }
    }
    if (provider === 'hero' && t.prices.heroCab) {
      if (cls === 'eco') { const p = parseVal(t.prices.heroCab.eco); if (p) return p; }
      if (cls === 'confort') { const p = parseVal(t.prices.heroCab.confort); if (p) return p; }
      if (cls === 'suv') { const p = parseVal(t.prices.heroCab.suv); if (p) return p; }
      if (cls === 'perKm') { const p = parseVal(t.prices.heroCab.perKm); if (p) return p; }
    }
    if (provider === 'tripmaster' && t.prices.tripMaster) {
      if (cls === 'eco') { const p = parseVal(t.prices.tripMaster.eco); if (p) return p; }
      if (cls === 'confort') { const p = parseVal(t.prices.tripMaster.confort); if (p) return p; }
      if (cls === 'moto') { const p = parseVal(t.prices.tripMaster.moto); if (p) return p; }
    }
  }

  // 2. Check flat legacy fields & quote sub-objects
  if (provider === 'yango') {
    if (cls === 'eco') {
      const p = parseVal(t.yango_eco ?? t.priceEconom ?? t.price_econom ?? t.classes?.econom?.price ?? (t.tariffClass === 'econom' ? t.price : null) ?? t.price);
      if (p) return p;
    }
    if (cls === 'confort') {
      const p = parseVal(t.yango_confort ?? t.priceConfort ?? t.price_confort ?? t.classes?.business?.price ?? t.classes?.comfort?.price);
      if (p) return p;
    }
    if (cls === 'confortPlus') {
      const p = parseVal(t.yango_confort_plus ?? t.priceConfortPlus ?? t.price_confort_plus ?? t.classes?.comfortplus?.price);
      if (p) return p;
    }
    if (cls === 'moto') {
      const p = parseVal(t.yango_moto ?? t.priceMoto ?? t.price_moto ?? t.classes?.moto?.price);
      if (p) return p;
    }
  }

  if (provider === 'hero') {
    const hQ = t.heroQuote || {};
    if (cls === 'eco') {
      const p = parseVal(t.hero_eco ?? t.priceHeroStandard ?? t.priceHero ?? hQ.priceStandard ?? hQ.priceEco ?? hQ.price);
      if (p) return p;
    }
    if (cls === 'confort') {
      const p = parseVal(t.hero_confort ?? t.priceHeroConfort ?? hQ.priceConfort ?? hQ.priceComfort);
      if (p) return p;
    }
    if (cls === 'suv') {
      const p = parseVal(t.hero_suv ?? t.priceHeroSuv ?? hQ.priceSuv);
      if (p) return p;
    }
    if (cls === 'perKm') {
      let p = parseVal(t.hero_per_km ?? t.priceHeroPerKm ?? hQ.pricePerKm);
      if (!p && t.distanceKm && t.distanceKm > 0) {
        const baseH = extractPriceNum(t, 'hero', 'eco');
        if (typeof baseH === 'number' && baseH > 0) p = Math.round(baseH / t.distanceKm);
      }
      if (p) return p;
    }
  }

  if (provider === 'tripmaster') {
    const tmQ = t.tripMasterQuote || {};
    if (cls === 'eco') {
      const p = parseVal(t.tripmaster_eco ?? t.priceTripMaster ?? t.priceTripMasterEco ?? tmQ.priceEco ?? tmQ.price);
      if (p) return p;
    }
    if (cls === 'confort') {
      const p = parseVal(t.tripmaster_confort ?? t.priceTripMasterConfort ?? tmQ.priceConfort);
      if (p) return p;
    }
    if (cls === 'moto') {
      const p = parseVal(t.tripmaster_moto ?? t.priceTripMasterMoto ?? tmQ.priceMoto);
      if (p) return p;
    }
  }

  return '—';
}
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  fileName: string = 'export',
  sheetName: string = 'Données'
) {
  if (!data || data.length === 0) {
    alert('Aucune donnée à exporter.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

  // Set column widths based on content length
  const keys = Object.keys(data[0] || {});
  worksheet['!cols'] = keys.map((key) => {
    const maxLen = Math.max(
      key.length,
      ...data.map((row) => (row[key] !== undefined && row[key] !== null ? String(row[key]).length : 0))
    );
    return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
  });

  const fullFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, fullFileName);
}

/**
 * Export ultra-lightweight Canonical JSON (Départ, Arrivée, Prix par Agrégateur et par Classe)
 */
export function exportCanonicalJson(
  trips: any[],
  fileName: string = 'citrine_trajets_canonical',
  campaignName?: string,
  cityName?: string
) {
  if (!trips || trips.length === 0) {
    alert('Aucun trajet à exporter.');
    return;
  }

  const cleanName = (n: string) => (n || '—').replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();

  const formattedTrips = trips.map(t => {
    const orig = cleanName(t.origin || t.startNeighborhoodName || t.startName);
    const dest = cleanName(t.destination || t.endNeighborhoodName || t.endName);

    const yEco = t.prices?.yango?.eco ?? t.yango_eco ?? t.priceEconom ?? t.price ?? null;
    const yConf = t.prices?.yango?.confort ?? t.yango_confort ?? t.priceConfort ?? null;
    const yConfPlus = t.prices?.yango?.confortPlus ?? t.yango_confort_plus ?? t.priceConfortPlus ?? null;
    const yMoto = t.prices?.yango?.moto ?? t.yango_moto ?? t.priceMoto ?? null;

    const hEco = t.prices?.heroCab?.eco ?? t.hero_eco ?? t.priceHeroStandard ?? t.priceHero ?? null;
    const hConf = t.prices?.heroCab?.confort ?? t.hero_confort ?? t.priceHeroConfort ?? null;
    const hSuv = t.prices?.heroCab?.suv ?? t.hero_suv ?? t.priceHeroSuv ?? null;
    const hPerKm = t.prices?.heroCab?.perKm ?? t.hero_per_km ?? t.priceHeroPerKm ?? null;

    const tmEco = t.prices?.tripMaster?.eco ?? t.tripmaster_eco ?? t.priceTripMaster ?? null;
    const tmConf = t.prices?.tripMaster?.confort ?? t.tripmaster_confort ?? t.priceTripMasterConfort ?? null;
    const tmMoto = t.prices?.tripMaster?.moto ?? t.tripmaster_moto ?? t.priceTripMasterMoto ?? null;

    return {
      origin: orig,
      destination: dest,
      distanceKm: t.distanceKm ?? 0,
      durationMin: t.durationMinutes ?? 0,
      prices: {
        yango: {
          eco: yEco,
          confort: yConf,
          confortPlus: yConfPlus,
          moto: yMoto
        },
        heroCab: {
          eco: hEco,
          confort: hConf,
          suv: hSuv,
          perKm: hPerKm
        },
        tripMaster: {
          eco: tmEco,
          confort: tmConf,
          moto: tmMoto
        }
      },
      cheapest: t.cheaperProvider || null
    };
  });

  const payload = {
    format: 'citrine.pricing.canonical.v1',
    campaignName: campaignName || 'Benchmark Trajets',
    cityName: cityName || 'Douala',
    exportedAt: new Date().toISOString(),
    totalTrips: formattedTrips.length,
    trips: formattedTrips
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName.endsWith('.json') ? fileName : `${fileName}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export tabular data to a clean, professionally formatted printable PDF document
 */
export function exportToPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  fileName: string = 'rapport',
  customTheadHtml?: string
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour générer l'export PDF.");
    return;
  }

  const dateStr = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <title>${title} - Citrine Pricing</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 24px;
          font-size: 11px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 18px;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .brand-badge {
          background: #f1f5f9;
          color: #475569;
          font-size: 9px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .meta {
          text-align: right;
          font-size: 10px;
          color: #64748b;
        }
        .title-block {
          margin-bottom: 16px;
        }
        h1 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 4px 0;
          color: #0f172a;
        }
        .subtitle {
          font-size: 11px;
          color: #64748b;
          margin: 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
          font-size: 10.5px;
        }
        th {
          background-color: #f8fafc;
          color: #334155;
          font-weight: 600;
          text-align: left;
          padding: 8px 10px;
          border-bottom: 1.5px solid #cbd5e1;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        td {
          padding: 7px 10px;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
        }
        tr:nth-child(even) {
          background-color: #fafbfc;
        }
        .footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">
            <span>Citrine Pricing</span>
          </div>
        </div>
        <div class="meta">
          <div>Document généré le : <strong>${dateStr}</strong></div>
          <div>Total enregistrements : <strong>${rows.length}</strong></div>
        </div>
      </div>

      <div class="title-block">
        <h1>${title}</h1>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
      </div>

      <table>
        ${customTheadHtml ? customTheadHtml : `
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        `}
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr>
              ${row.map((cell) => `<td>${cell !== null && cell !== undefined ? String(cell) : '-'}</td>`).join('')}
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="footer">
        <span>Citrine Pricing • Usage Interne Confidentiel</span>
        <span>Page 1 / 1</span>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV file for Neighborhood imports
 */
export async function parseNeighborhoodExcelFile(
  file: File,
  cityId: string
): Promise<{
  success: boolean;
  neighborhoods: Array<{
    cityId: string;
    name: string;
    lat: number;
    lng: number;
    zoneType: 'commercial' | 'residential' | 'popular' | 'airport' | 'center';
    active: boolean;
  }>;
  error?: string;
  totalParsed?: number;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { success: false, neighborhoods: [], error: 'Le fichier Excel ne contient aucune feuille de calcul.' };
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      return { success: false, neighborhoods: [], error: 'La feuille Excel est vide.' };
    }

    const neighborhoods: Array<{
      cityId: string;
      name: string;
      lat: number;
      lng: number;
      zoneType: 'commercial' | 'residential' | 'popular' | 'airport' | 'center';
      active: boolean;
    }> = [];

    for (let index = 0; index < rawData.length; index++) {
      const row = rawData[index];
      // Normalize keys: lowercase, remove accents and spaces
      const keys = Object.keys(row);
      const normalizedRow: Record<string, any> = {};
      keys.forEach((k) => {
        const cleanKey = k
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
        normalizedRow[cleanKey] = row[k];
      });

      // Find Name (prioritizing 'adresse complete' / 'adresse' if available, else nom / quartier)
      const nameKey = Object.keys(normalizedRow).find(
        (k) => k.includes('adresse complete') || k.includes('addresse complete') || k.includes('adresse') || k.includes('address')
      ) || Object.keys(normalizedRow).find(
        (k) => k.includes('nom') || k.includes('name') || k.includes('quartier') || k.includes('lieu')
      );
      const name = nameKey ? String(normalizedRow[nameKey]).trim() : '';

      // Find Latitude
      const latKey = Object.keys(normalizedRow).find(
        (k) => k.startsWith('lat') || k.includes('latitude') || k === 'y'
      );
      const latRaw = latKey ? normalizedRow[latKey] : '';
      const lat = parseFloat(String(latRaw).replace(',', '.'));

      // Find Longitude
      const lngKey = Object.keys(normalizedRow).find(
        (k) => k.startsWith('lon') || k.startsWith('lng') || k.includes('longitude') || k === 'x'
      );
      const lngRaw = lngKey ? normalizedRow[lngKey] : '';
      const lng = parseFloat(String(lngRaw).replace(',', '.'));

      // Find Zone Type (optional)
      const zoneKey = Object.keys(normalizedRow).find((k) => k.includes('zone') || k.includes('type'));
      let zoneType: 'commercial' | 'residential' | 'popular' | 'airport' | 'center' = 'commercial';
      if (zoneKey) {
        const z = String(normalizedRow[zoneKey]).toLowerCase();
        if (z.includes('res') || z.includes('habit')) zoneType = 'residential';
        else if (z.includes('pop') || z.includes('dens')) zoneType = 'popular';
        else if (z.includes('aero') || z.includes('airp') || z.includes('vol')) zoneType = 'airport';
        else if (z.includes('cent') || z.includes('vill')) zoneType = 'center';
        else zoneType = 'commercial';
      }

      if (name && !isNaN(lat) && !isNaN(lng)) {
        neighborhoods.push({
          cityId,
          name,
          lat,
          lng,
          zoneType,
          active: true
        });
      }
    }

    if (neighborhoods.length === 0) {
      return {
        success: false,
        neighborhoods: [],
        error:
          "Impossible de lire les colonnes du fichier. Assurez-vous d'avoir au moins les colonnes 'Nom', 'Latitude' et 'Longitude'."
      };
    }

    return {
      success: true,
      neighborhoods,
      totalParsed: neighborhoods.length
    };
  } catch (err: any) {
    return {
      success: false,
      neighborhoods: [],
      error: err.message || 'Erreur lors du traitement du fichier Excel.'
    };
  }
}

export interface ConsolidatedCampaignData {
  campaignName: string;
  cityName: string;
  dateStr: string;
  trips: any[];
}

export function exportConsolidatedExcel(
  campaignsData: ConsolidatedCampaignData[],
  fileName: string = 'rapport_consolide'
) {
  if (!campaignsData || campaignsData.length === 0) {
    alert('Aucune donnée à consolider.');
    return;
  }

  const flatRows: any[] = [];
  const merges: any[] = [];
  let currentRow = 1; // row 0 is header of sheet (column names)

  campaignsData.forEach((camp) => {
    // Add merge across all 16 columns (indices 0 to 15)
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 15 } });

    const separatorText = `=== PRICING DU ${camp.dateStr.toUpperCase()} — ${camp.cityName.toUpperCase()} | ${camp.campaignName.toUpperCase()} (${camp.trips.length} TRAJETS) ===`;
    
    flatRows.push({
      'Date & Heure': separatorText,
      'Campagne / Ville': '',
      'Départ': '',
      'Destination': '',
      'Dist.': '',
      'Yango Éco': '',
      'Yango Confort': '',
      'Yango Confort+': '',
      'Yango Moto': '',
      'Hero Éco': '',
      'Hero Confort': '',
      'Hero SUV': '',
      'Hero PerKm': '',
      'Trip Master Éco': '',
      'Trip Master Confort': '',
      'Trip Master Moto': ''
    });

    currentRow++;

    // Content Rows
    camp.trips.forEach((t) => {
      flatRows.push({
        'Date & Heure': camp.dateStr,
        'Campagne / Ville': `${camp.campaignName} (${camp.cityName})`,
        'Départ': (t.origin || t.startNeighborhoodName || '—').replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim(),
        'Destination': (t.destination || t.endNeighborhoodName || '—').replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim(),
        'Dist.': t.distanceKm ? `${t.distanceKm} km` : '—',
        'Yango Éco': extractPriceNum(t, 'yango', 'eco'),
        'Yango Confort': extractPriceNum(t, 'yango', 'confort'),
        'Yango Confort+': extractPriceNum(t, 'yango', 'confortPlus'),
        'Yango Moto': extractPriceNum(t, 'yango', 'moto'),
        'Hero Éco': extractPriceNum(t, 'hero', 'eco'),
        'Hero Confort': extractPriceNum(t, 'hero', 'confort'),
        'Hero SUV': extractPriceNum(t, 'hero', 'suv'),
        'Hero PerKm': extractPriceNum(t, 'hero', 'perKm'),
        'Trip Master Éco': extractPriceNum(t, 'tripmaster', 'eco'),
        'Trip Master Confort': extractPriceNum(t, 'tripmaster', 'confort'),
        'Trip Master Moto': extractPriceNum(t, 'tripmaster', 'moto')
      });
      currentRow++;
    });

    // Spacer
    flatRows.push({
      'Date & Heure': '',
      'Campagne / Ville': '',
      'Départ': '',
      'Destination': '',
      'Dist.': '',
      'Yango Éco': '',
      'Yango Confort': '',
      'Yango Confort+': '',
      'Yango Moto': '',
      'Hero Éco': '',
      'Hero Confort': '',
      'Hero SUV': '',
      'Hero PerKm': '',
      'Trip Master Éco': '',
      'Trip Master Confort': '',
      'Trip Master Moto': ''
    });
    currentRow++;
  });

  const worksheet = XLSX.utils.json_to_sheet(flatRows);
  worksheet['!merges'] = merges;
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidation');

  const keys = Object.keys(flatRows[0] || {});
  worksheet['!cols'] = keys.map((key) => {
    return { wch: key === 'Campagne / Ville' || key === 'Date & Heure' ? 26 : 15 };
  });

  const fullFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, fullFileName);
}

export function exportConsolidatedPdf(
  campaignsData: ConsolidatedCampaignData[],
  title: string = 'Rapport Consolidé Multi-Campagnes',
  fileName: string = 'rapport_consolide'
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour générer l'export PDF.");
    return;
  }

  const dateStr = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getPriceStr = (...vals: any[]) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && v !== 0 && v !== '' && v !== '—') {
        const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
        if (!isNaN(num) && num > 0) return `${Math.round(num).toLocaleString('fr-FR')} F`;
      }
    }
    return '—';
  };

  const tablesHtml = campaignsData.map((camp, idx) => {
    return `
      <div class="campaign-section" style="${idx > 0 ? 'page-break-before: always; margin-top: 30px;' : ''}">
        <div class="campaign-banner" style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #1F4F4A; margin-bottom: 12px; display: flex; flex-direction: column; align-items: center; text-align: center;">
          <h2 style="margin: 0; font-size: 13px; color: #0f172a; font-weight: 700;">
            PRICING DU ${camp.dateStr.toUpperCase()} — ${camp.cityName.toUpperCase()} (${camp.campaignName.toUpperCase()})
          </h2>
          <div style="font-size: 10px; color: #475569; margin-top: 4px; display: flex; gap: 15px;">
            <span>Date d'exécution : <strong>${camp.dateStr}</strong></span>
            <span>Nombre de trajets : <strong>${camp.trips.length}</strong></span>
          </div>
        </div>

        <table>
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 1.5px solid #cbd5e1; font-size: 10px;">
              <th rowspan="2" style="padding: 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; font-weight: 700; color: #1e293b;">Départ</th>
              <th rowspan="2" style="padding: 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; font-weight: 700; color: #1e293b;">Destination</th>
              <th rowspan="2" style="padding: 8px; text-align: right; border-bottom: 1.5px solid #cbd5e1; font-weight: 700; color: #1e293b;">Dist.</th>
              <th colspan="4" style="text-align: center; border-bottom: 1px solid #cbd5e1; font-weight: 700; color: #1F4F4A; background-color: #f1f5f9; padding: 6px;">Yango</th>
              <th colspan="4" style="text-align: center; border-bottom: 1px solid #cbd5e1; font-weight: 700; color: #1F4F4A; background-color: #f1f5f9; padding: 6px;">Hero Cab</th>
              <th colspan="3" style="text-align: center; border-bottom: 1px solid #cbd5e1; font-weight: 700; color: #1F4F4A; background-color: #f1f5f9; padding: 6px;">Trip Master</th>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1.5px solid #cbd5e1; font-size: 8px; color: #475569;">
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #e2e8f0; padding: 4px;">Éco</th>
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #e2e8f0; padding: 4px;">Confort</th>
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #e2e8f0; padding: 4px;">Confort+</th>
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #cbd5e1; padding: 4px;">Moto</th>
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #e2e8f0; padding: 4px;">Éco</th>
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #e2e8f0; padding: 4px;">Confort</th>
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #e2e8f0; padding: 4px;">SUV</th>
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #cbd5e1; padding: 4px;">PerKm</th>
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #e2e8f0; padding: 4px;">Éco</th>
              <th style="text-align: center; text-transform: uppercase; font-weight: 700; border-right: 1px solid #e2e8f0; padding: 4px;">Confort</th>
              <th style="text-align: center; text-transform: uppercase; padding: 4px;">Moto</th>
            </tr>
          </thead>
          <tbody>
            ${camp.trips.map(t => {
              const dNmStart = (t.origin || t.startNeighborhoodName || '—').replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();
              const dNmEnd = (t.destination || t.endNeighborhoodName || '—').replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();
              
              const formatPrice = (p: number | '—') => (typeof p === 'number' ? `${p.toLocaleString('fr-FR')} F` : '—');

              const yEco = formatPrice(extractPriceNum(t, 'yango', 'eco'));
              const yConf = formatPrice(extractPriceNum(t, 'yango', 'confort'));
              const yConfPlus = formatPrice(extractPriceNum(t, 'yango', 'confortPlus'));
              const yMoto = formatPrice(extractPriceNum(t, 'yango', 'moto'));

              const hEco = formatPrice(extractPriceNum(t, 'hero', 'eco'));
              const hConf = formatPrice(extractPriceNum(t, 'hero', 'confort'));
              const hSuv = formatPrice(extractPriceNum(t, 'hero', 'suv'));
              const hPerKm = formatPrice(extractPriceNum(t, 'hero', 'perKm'));

              const tmEco = formatPrice(extractPriceNum(t, 'tripmaster', 'eco'));
              const tmConf = formatPrice(extractPriceNum(t, 'tripmaster', 'confort'));
              const tmMoto = formatPrice(extractPriceNum(t, 'tripmaster', 'moto'));

              return `
                <tr style="font-size: 9.5px;">
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${dNmStart}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${dNmEnd}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">${t.distanceKm ? t.distanceKm + ' km' : '—'}</td>
                  
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">${yEco}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">${yConf}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">${yConfPlus}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; border-right: 1px solid #e2e8f0;">${yMoto}</td>
                  
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; color: #0d9488; font-weight: 600;">${hEco}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; color: #0d9488; font-weight: 600;">${hConf}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; color: #0d9488; font-weight: 600;">${hSuv}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; color: #0d9488; font-weight: 600; border-right: 1px solid #e2e8f0;">${hPerKm}</td>
                  
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">${tmEco}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">${tmConf}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">${tmMoto}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <title>${title} - Citrine Pricing</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 15px;
          font-size: 10px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 12px;
          margin-bottom: 15px;
        }
        .brand {
          font-weight: 700;
          font-size: 16px;
          color: #0f172a;
        }
        .meta {
          text-align: right;
          font-size: 9px;
          color: #64748b;
        }
        h1 {
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 15px 0;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }
        th, td {
          border: 1px solid #e2e8f0;
        }
        th {
          padding: 6px;
          font-size: 8.5px;
          background-color: #f8fafc;
        }
        td {
          padding: 4px 6px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">Citrine Pricing</div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Plateforme Multi-Classes Cameroun</div>
        </div>
        <div class="meta">
          <div>Consolidation éditée le : <strong>${dateStr}</strong></div>
          <div>Nombre de campagnes : <strong>${campaignsData.length}</strong></div>
        </div>
      </div>

      <h1>${title}</h1>

      ${tablesHtml}

      <div class="footer">
        <span>Citrine Pricing • Usage Interne Confidentiel</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
