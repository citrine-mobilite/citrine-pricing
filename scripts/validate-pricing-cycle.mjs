import fs from 'fs';
import path from 'path';

const base = 'http://localhost:3001';
const logPath = path.join(process.cwd(), 'validation-cycle-log.json');

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  const log = [];

  const citiesRes = await fetchJson(`${base}/api/cities`);
  log.push({ step: 'cities', data: citiesRes });

  const city = Array.isArray(citiesRes.body)
    ? citiesRes.body.find((c) => c && c.active)
    : null;

  if (!city) {
    throw new Error('Aucune ville active trouvée sur l’API.');
  }

  const startRes = await fetchJson(`${base}/api/campaigns/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cityId: city.id,
      sampleLimit: 1,
      triggerType: 'manual',
      triggeredByUserId: 'validation',
      triggeredByUserName: 'Validation User',
      triggeredByUserRole: 'admin',
      selectedClasses: ['econom'],
      scopeMode: 'global',
    }),
  });
  log.push({ step: 'start', data: startRes });

  const campaignId = startRes?.body?.campaign?.id;

  const campaignsAfterStart = await fetchJson(`${base}/api/campaigns`);
  log.push({ step: 'afterStart', data: campaignsAfterStart });

  if (campaignId) {
    const cancelRes = await fetchJson(`${base}/api/campaigns/${campaignId}/cancel`, {
      method: 'POST',
    });
    log.push({ step: 'cancel', data: cancelRes });

    const campaignsAfterCancel = await fetchJson(`${base}/api/campaigns`);
    log.push({ step: 'afterCancel', data: campaignsAfterCancel });

    const deleteRes = await fetchJson(`${base}/api/campaigns/${campaignId}`, {
      method: 'DELETE',
    });
    log.push({ step: 'delete', data: deleteRes });

    const campaignsAfterDelete = await fetchJson(`${base}/api/campaigns`);
    log.push({ step: 'afterDelete', data: campaignsAfterDelete });
  }

  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
  console.log(`validation log written to ${logPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
