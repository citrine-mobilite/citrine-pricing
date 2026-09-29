import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Crisp Citrine / Hero Cab brand SVG
const svgStandard = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="104" fill="#1F4F4A"/>
  <circle cx="256" cy="256" r="190" stroke="#3D8B85" stroke-width="18" fill="#1A433F" />
  <circle cx="256" cy="256" r="140" stroke="#D4A82F" stroke-width="10" stroke-dasharray="16 12" />
  
  <!-- Compass / Crosshair axes -->
  <line x1="96" y1="256" x2="416" y2="256" stroke="#D4A82F" stroke-width="12" stroke-linecap="round"/>
  <line x1="256" y1="96" x2="256" y2="416" stroke="#D4A82F" stroke-width="12" stroke-linecap="round"/>
  
  <!-- Central Diamond / Pulse -->
  <polygon points="256,190 322,256 256,322 190,256" fill="#D4A82F" />
  <circle cx="256" cy="256" r="32" fill="#1F4F4A" stroke="#FFFFFF" stroke-width="6" />
  <circle cx="256" cy="256" r="14" fill="#D4A82F" />
  
  <!-- Accent dots -->
  <circle cx="160" cy="160" r="10" fill="#3D8B85" />
  <circle cx="352" cy="160" r="10" fill="#3D8B85" />
  <circle cx="160" cy="352" r="10" fill="#3D8B85" />
  <circle cx="352" cy="352" r="10" fill="#3D8B85" />
</svg>
`;

// Maskable icon with 15% inner safe margin
const svgMaskable = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#1F4F4A"/>
  <!-- Scaled content inside 80% safe zone (center 410x410) -->
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <circle cx="256" cy="256" r="190" stroke="#3D8B85" stroke-width="18" fill="#1A433F" />
    <circle cx="256" cy="256" r="140" stroke="#D4A82F" stroke-width="10" stroke-dasharray="16 12" />
    <line x1="96" y1="256" x2="416" y2="256" stroke="#D4A82F" stroke-width="12" stroke-linecap="round"/>
    <line x1="256" y1="96" x2="256" y2="416" stroke="#D4A82F" stroke-width="12" stroke-linecap="round"/>
    <polygon points="256,190 322,256 256,322 190,256" fill="#D4A82F" />
    <circle cx="256" cy="256" r="32" fill="#1F4F4A" stroke="#FFFFFF" stroke-width="6" />
    <circle cx="256" cy="256" r="14" fill="#D4A82F" />
  </g>
</svg>
`;

async function generate() {
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgStandard.trim());
  console.log('Saved icon.svg');

  // 192x192 PNG
  await sharp(Buffer.from(svgStandard))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 512x512 PNG
  await sharp(Buffer.from(svgStandard))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 512x512 Maskable PNG
  await sharp(Buffer.from(svgMaskable))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // 180x180 Apple Touch Icon
  await sharp(Buffer.from(svgStandard))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 64x64 favicon
  await sharp(Buffer.from(svgStandard))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Generated favicon.ico');
}

generate().catch(console.error);
