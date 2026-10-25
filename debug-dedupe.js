function normalizeCampaignKey(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/^camp(?:aign)?[_:-]?/i, '').replace(/^uuid[_:-]?/i, '');
}
function dedupeCampaigns(campaigns) {
  const seen = new Map();
  const ordered = [];
  for (const camp of campaigns) {
    const candidateKeys = [
      normalizeCampaignKey(camp.id),
      normalizeCampaignKey(camp.uuid),
      String(camp.id ?? ''),
      String(camp.uuid ?? ''),
      `id:${String(camp.id ?? '')}`,
      `uuid:${String(camp.uuid ?? '')}`
    ].filter(Boolean);

    const existingMatch = candidateKeys.find(key => seen.has(key));
    if (existingMatch) {
      const previousCamp = seen.get(existingMatch);
      for (const key of candidateKeys) seen.set(key, camp);
      const prevIndex = ordered.indexOf(previousCamp);
      if (prevIndex >= 0) ordered[prevIndex] = camp;
      continue;
    }

    for (const key of candidateKeys) seen.set(key, camp);
    ordered.push(camp);
  }
  return ordered;
}

const payload = [
  { id: 29, uuid: '37f4108b-3e6f-4a79-9c90-1b57695a1ddd', status: 'in_progress' },
  { id: 29, uuid: '37f4108b-3e6f-4a79-9c90-1b57695a1ddd', status: 'in_progress' }
];
const result = dedupeCampaigns(payload);
const fs = require('fs');
fs.writeFileSync('dedupe-proof.json', JSON.stringify({ unique: result.length, ids: result.map(c => String(c.id)) }, null, 2));
