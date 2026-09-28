import * as XLSX from 'xlsx';

/**
 * Export data array directly to a genuine Microsoft Excel (.xlsx) file
 */
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

    const getVal = (...vals: any[]) => {
      for (const v of vals) {
        if (v !== undefined && v !== null && v !== 0 && v !== '' && v !== '—') {
          const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
          if (!isNaN(num) && num > 0) return Math.round(num);
        }
      }
      return '—';
    };

    // Content Rows
    camp.trips.forEach((t) => {
      flatRows.push({
        'Date & Heure': camp.dateStr,
        'Campagne / Ville': `${camp.campaignName} (${camp.cityName})`,
        'Départ': t.startNeighborhoodName || '—',
        'Destination': t.endNeighborhoodName || '—',
        'Dist.': t.distanceKm ? `${t.distanceKm} km` : '—',
        'Yango Éco': getVal(t.yango_eco, t.price, t.priceEconom, t.vehiclePrices?.eco, t.vehiclePrices?.standard),
        'Yango Confort': getVal(t.yango_confort, t.priceConfort, t.vehiclePrices?.confort),
        'Yango Confort+': getVal(t.yango_confort_plus, t.priceConfortPlus, t.vehiclePrices?.confort_plus),
        'Yango Moto': getVal(t.yango_moto, t.priceMoto, t.vehiclePrices?.moto),
        'Hero Éco': getVal(t.hero_eco, t.priceHero, t.priceHeroStandard, t.heroPrices?.eco, t.heroPrices?.standard),
        'Hero Confort': getVal(t.hero_confort, t.priceHeroConfort, t.heroPrices?.confort),
        'Hero SUV': getVal(t.hero_suv, t.priceHeroSuv, t.heroPrices?.suv),
        'Hero PerKm': getVal(t.hero_per_km, t.priceHeroPerKm, t.heroPrices?.perKm),
        'Trip Master Éco': getVal(t.tripmaster_eco, t.priceTripMasterEco, t.tripMasterPrices?.eco),
        'Trip Master Confort': getVal(t.tripmaster_confort, t.priceTripMasterConfort, t.tripMasterPrices?.confort),
        'Trip Master Moto': getVal(t.tripmaster_moto, t.priceTripMasterMoto, t.tripMasterPrices?.moto)
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
              const dNmStart = t.startNeighborhoodName && t.startNeighborhoodName.includes(',') ? t.startNeighborhoodName.split(',')[0].trim() : (t.startNeighborhoodName || '—');
              const dNmEnd = t.endNeighborhoodName && t.endNeighborhoodName.includes(',') ? t.endNeighborhoodName.split(',')[0].trim() : (t.endNeighborhoodName || '—');
              
              const yEco = getPriceStr(t.yango_eco, t.price, t.priceEconom, t.vehiclePrices?.eco, t.vehiclePrices?.standard);
              const yConf = getPriceStr(t.yango_confort, t.priceConfort, t.vehiclePrices?.confort);
              const yConfPlus = getPriceStr(t.yango_confort_plus, t.priceConfortPlus, t.vehiclePrices?.confort_plus);
              const yMoto = getPriceStr(t.yango_moto, t.priceMoto, t.vehiclePrices?.moto);

              const hEco = getPriceStr(t.hero_eco, t.priceHero, t.priceHeroStandard, t.heroPrices?.eco, t.heroPrices?.standard);
              const hConf = getPriceStr(t.hero_confort, t.priceHeroConfort, t.heroPrices?.confort);
              const hSuv = getPriceStr(t.hero_suv, t.priceHeroSuv, t.heroPrices?.suv);
              const hPerKm = getPriceStr(t.hero_per_km, t.priceHeroPerKm, t.heroPrices?.perKm);

              const tmEco = getPriceStr(t.tripmaster_eco, t.priceTripMasterEco, t.tripMasterPrices?.eco);
              const tmConf = getPriceStr(t.tripmaster_confort, t.priceTripMasterConfort, t.tripMasterPrices?.confort);
              const tmMoto = getPriceStr(t.tripmaster_moto, t.priceTripMasterMoto, t.tripMasterPrices?.moto);

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
