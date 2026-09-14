/**
 * Official Assets of Sama Al Foursan Trading Est. (مؤسسة سما الفرسان للتجارة)
 * Includes highly accurate vector logos and stamps designed in SVG and exported as Data URIs.
 */

// A beautiful, highly detailed royal blue circular stamp matching the uploaded reference image
const OFFICIAL_STAMP_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <!-- Top Arc Path: starts at left (25,100) and curves clockwise to right (175,100) -->
    <path id="top-stamp-path" d="M 28,100 A 72,72 0 1,1 172,100" fill="none" />
    <!-- Bottom Arc Path: starts at right (175,100) and curves clockwise through the bottom to left (25,100) -->
    <path id="bottom-stamp-path" d="M 172,100 A 72,72 0 0,1 28,100" fill="none" />
    
    <!-- Fine SVG Filter to give the stamp a realistic ink/stamp texture -->
    <filter id="ink-texture" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="3" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="displaced" />
      <feBlend mode="multiply" in="SourceGraphic" in2="displaced" />
    </filter>
  </defs>

  <style>
    .stamp-blue {
      fill: none;
      stroke: #1e40af;
    }
    .stamp-text {
      font-family: 'Cairo', 'sans-serif';
      font-size: 11px;
      font-weight: 900;
      fill: #1e40af;
      letter-spacing: 0.8px;
    }
    .stamp-text-en {
      font-family: 'Inter', 'sans-serif';
      font-size: 9px;
      font-weight: 800;
      fill: #1e40af;
      letter-spacing: 1px;
    }
    .stamp-inner-title {
      font-family: 'Cairo', 'sans-serif';
      font-size: 7.5px;
      font-weight: 800;
      fill: #1e40af;
    }
    .stamp-inner-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 900;
      fill: #1e40af;
      letter-spacing: 0.5px;
    }
  </style>

  <g filter="url(#ink-texture)" opacity="0.92">
    <!-- Double Outer Boundary Rings -->
    <circle cx="100" cy="100" r="95" class="stamp-blue" stroke-width="2.5" />
    <circle cx="100" cy="100" r="88" class="stamp-blue" stroke-width="0.8" />

    <!-- Core Inner Boundary Rings -->
    <circle cx="100" cy="100" r="62" class="stamp-blue" stroke-width="1.8" />
    <circle cx="100" cy="100" r="58" class="stamp-blue" stroke-width="0.6" />

    <!-- Curved Corporate Texts -->
    <text class="stamp-text">
      <textPath href="#top-stamp-path" startOffset="50%" text-anchor="middle">مؤسسة سما الفرسان للتجارة</textPath>
    </text>
    
    <text class="stamp-text-en">
      <textPath href="#bottom-stamp-path" startOffset="50%" text-anchor="middle">Sama Al Foursan Trading Est.</textPath>
    </text>

    <!-- Five-Point Star Graphic Accents on Left & Right -->
    <g fill="#1e40af" transform="translate(16, 97) scale(0.75)">
      <polygon points="5,0 1.5,3.5 2,8.5 -2.5,6 -7,8.5 -6.5,3.5 -10,0 -5,-0.5 -2.5,-5.5 0,-0.5" />
    </g>
    <g fill="#1e40af" transform="translate(184, 97) scale(0.75)">
      <polygon points="5,0 1.5,3.5 2,8.5 -2.5,6 -7,8.5 -6.5,3.5 -10,0 -5,-0.5 -2.5,-5.5 0,-0.5" />
    </g>

    <!-- Center Winged Horse (Sama Pegasus) Graphic Symbol -->
    <g transform="translate(100, 92) scale(0.8)" fill="#1e40af">
      <!-- Wing Path -->
      <path d="M -5,-15 C -2,-25 10,-35 25,-32 C 32,-30 35,-24 30,-18 C 24,-12 12,-10 5,-15 Z" />
      <path d="M -8,-10 C -5,-18 5,-25 15,-24 C 20,-23 22,-18 18,-14 C 13,-10 4,-8 -8,-10 Z" opacity="0.85" />
      <path d="M -10,-5 C -8,-12 0,-18 8,-17 C 12,-16 13,-12 10,-9 C 6,-6 -2,-5 -10,-5 Z" opacity="0.7" />
      
      <!-- Horse Body & Head silhouette -->
      <path d="M -32,-4 Q -35,-8 -32,-11 Q -28,-14 -22,-12 Q -18,-10 -15,-6 Q -12, -2 -8,-4 Q -4,-6 0,-10 C 2,-12 6,-14 9,-11 C 11,-8 8,-4 6,0 C 4,3 0,5 -3,4 C -6,3 -9,0 -12,0 C -15,0 -18,2 -20,6 C -21,8 -24,8 -26,6 Q -29,3 -32,-4 Z" />
      
      <!-- Front Legs (Proudly Raised) -->
      <path d="M -12,0 C -10,5 -8,11 -5,14 Q -2,17 0,15 C 2,13 1,9 -2,5 Q -5,1 -12,0" />
      <path d="M -15,1 C -13,7 -12,13 -9,16 Q -7,18 -5,16 C -3,14 -5,9 -9,4 Q -12,0 -15,1" opacity="0.85" />

      <!-- Back of Horse & Tail -->
      <path d="M -30,-8 C -33,-12 -38,-15 -42,-14 C -45,-13 -45,-8 -40,-2 C -36,3 -32,2 -30,-8 Z" />
    </g>

    <!-- Inner Core Info: CR Info -->
    <text x="100" y="131" text-anchor="middle" class="stamp-inner-title">سجل تجاري رقم</text>
    <text x="100" y="144" text-anchor="middle" class="stamp-inner-id">5950007763</text>
  </g>
</svg>
`;

// A beautiful matching royal blue modern company logo/emblem
const OFFICIAL_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
  <style>
    .logo-text-primary {
      font-family: 'Cairo', 'sans-serif';
      font-size: 19px;
      font-weight: 900;
      fill: #1e40af;
    }
    .logo-text-secondary {
      font-family: 'Cairo', 'sans-serif';
      font-size: 9.5px;
      font-weight: 700;
      fill: #64748b;
      letter-spacing: 0.5px;
    }
    .logo-en-sub {
      font-family: 'Inter', sans-serif;
      font-size: 8px;
      font-weight: 600;
      fill: #94a3b8;
      letter-spacing: 1px;
    }
  </style>

  <!-- Winged Horse Logo Graphic (Sama Pegasus) -->
  <g transform="translate(10, 12)">
    <!-- Decorative Circle Backdrop -->
    <circle cx="38" cy="38" r="36" fill="#f0fdf4" stroke="#dbeafe" stroke-width="1.5" />
    <circle cx="38" cy="38" r="30" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4 2" />
    
    <!-- Miniature Golden/Blue Pegasus Emblem inside circle -->
    <g transform="translate(38, 36) scale(0.6)" fill="#1e40af">
      <path d="M -5,-15 C -2,-25 10,-35 25,-32 C 32,-30 35,-24 30,-18 C 24,-12 12,-10 5,-15 Z" />
      <path d="M -8,-10 C -5,-18 5,-25 15,-24 C 20,-23 22,-18 18,-14 C 13,-10 4,-8 -8,-10 Z" opacity="0.85" fill="#3b82f6" />
      <path d="M -32,-4 Q -35,-8 -32,-11 Q -28,-14 -22,-12 Q -18,-10 -15,-6 Q -12, -2 -8,-4 Q -4,-6 0,-10 C 2,-12 6,-14 9,-11 C 11,-8 8,-4 6,0 C 4,3 0,5 -3,4 C -6,3 -9,0 -12,0 C -15,0 -18,2 -20,6 C -21,8 -24,8 -26,6 Q -29,3 -32,-4 Z" />
      <path d="M -12,0 C -10,5 -8,11 -5,14 Q -2,17 0,15 C 2,13 1,9 -2,5 Q -5,1 -12,0" />
      <path d="M -30,-8 C -33,-12 -38,-15 -42,-14 C -45,-13 -45,-8 -40,-2 C -36,3 -32,2 -30,-8 Z" />
    </g>
  </g>

  <!-- Branding Texts -->
  <text x="94" y="38" class="logo-text-primary" text-anchor="start">مؤسسة سما الفرسان للتجارة</text>
  <text x="94" y="56" class="logo-text-secondary" text-anchor="start">بوابة جرد السيارات والتحقق الرقمي للمخزون</text>
  <text x="94" y="70" class="logo-en-sub" text-anchor="start">SAMA AL FOURSAN TRADING EST.</text>
</svg>
`;

/**
 * Converts a raw SVG string to a cross-browser, responsive Data URI.
 * This guarantees offline capability and instant rendering inside sandboxed printing iframes.
 */
const toBase64 = (str: string): string => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    try {
      return window.btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      // Fallback
    }
  }
  return Buffer.from(str, 'utf-8').toString('base64');
};

const logoCache: Record<string, string> = {};
const stampCache: Record<string, string> = {};

export const getStampDataUri = (companyName?: string, cr?: string, orgType?: string): string => {
  const cacheKey = `${companyName || ''}_${cr || ''}_${orgType || ''}`;
  if (stampCache[cacheKey]) {
    return stampCache[cacheKey];
  }
  let svg = OFFICIAL_STAMP_SVG;
  if (companyName) {
    svg = svg.replace('مؤسسة سما الفرسان للتجارة', companyName);
    if (companyName.includes('شركة')) {
      svg = svg.replace(/Sama Al Foursan Trading Est\./gi, 'Sama Al Foursan Trading Co.');
    }
  } else {
    const defaultName = `${orgType || 'مؤسسة'} سما الفرسان للتجارة`;
    svg = svg.replace('مؤسسة سما الفرسان للتجارة', defaultName);
    if (orgType === 'شركة') {
      svg = svg.replace(/Sama Al Foursan Trading Est\./gi, 'Sama Al Foursan Trading Co.');
    }
  }
  if (cr) {
    svg = svg.replace(/5950007763/g, cr);
  }
  const cleaned = svg.trim().replace(/\s+/g, ' ');
  const result = `data:image/svg+xml;base64,${toBase64(cleaned)}`;
  stampCache[cacheKey] = result;
  return result;
};

export const getLogoDataUri = (companyName?: string, orgType?: string): string => {
  const cacheKey = `${companyName || ''}_${orgType || ''}`;
  if (logoCache[cacheKey]) {
    return logoCache[cacheKey];
  }
  let svg = OFFICIAL_LOGO_SVG;
  if (companyName) {
    svg = svg.replace('مؤسسة سما الفرسان للتجارة', companyName);
    svg = svg.replace('SAMA AL FOURSAN TRADING EST.', '');
  } else {
    const defaultName = `${orgType || 'مؤسسة'} سما الفرسان للتجارة`;
    svg = svg.replace('مؤسسة سما الفرسان للتجارة', defaultName);
    if (orgType === 'شركة') {
      svg = svg.replace('SAMA AL FOURSAN TRADING EST.', 'SAMA AL FOURSAN TRADING CO.');
    }
  }
  const cleaned = svg.trim().replace(/\s+/g, ' ');
  const result = `data:image/svg+xml;base64,${toBase64(cleaned)}`;
  logoCache[cacheKey] = result;
  return result;
};
