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
  fileName: string = 'rapport'
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
            <span class="brand-badge">Plateforme VTC Cameroun</span>
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Intelligence Tarifaire & Benchmark Yango</div>
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
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
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
