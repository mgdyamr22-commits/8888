import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
// @ts-ignore
import html2canvas from 'html2canvas';
import { OrganizationSettings } from '../types';
import { getLogoDataUri } from '../components/OfficialAssets';
import { 
  getResolvedStatusColors, 
  getCarStatusColorInfo, 
  getCarRentalColorInfo 
} from '../src/utils/statusColors';

// Arabic character mapping for shaping (isolated, beginning, medial, final forms)
const arabicMap: { [key: string]: { isolated: string; beginning: string; medial: string; final: string; connectsBefore: boolean; connectsAfter: boolean } } = {
  '\u0621': { isolated: '\uFE80', beginning: '\uFE80', medial: '\uFE80', final: '\uFE80', connectsBefore: false, connectsAfter: false }, // Hamza
  '\u0622': { isolated: '\uFE81', beginning: '\uFE81', medial: '\uFE82', final: '\uFE82', connectsBefore: true, connectsAfter: false }, // Alef Madda
  '\u0623': { isolated: '\uFE83', beginning: '\uFE83', medial: '\uFE84', final: '\uFE84', connectsBefore: true, connectsAfter: false }, // Alef Hamza Above
  '\u0624': { isolated: '\uFE85', beginning: '\uFE85', medial: '\uFE86', final: '\uFE86', connectsBefore: true, connectsAfter: false }, // Waw Hamza Above
  '\u0625': { isolated: '\uFE87', beginning: '\uFE87', medial: '\uFE88', final: '\uFE88', connectsBefore: true, connectsAfter: false }, // Alef Hamza Below
  '\u0626': { isolated: '\uFE89', beginning: '\uFE8B', medial: '\uFE8C', final: '\uFE8A', connectsBefore: true, connectsAfter: true },  // Yeh Hamza Above
  '\u0627': { isolated: '\uFE8D', beginning: '\uFE8D', medial: '\uFE8E', final: '\uFE8E', connectsBefore: true, connectsAfter: false }, // Alef
  '\u0628': { isolated: '\uFE8F', beginning: '\uFE91', medial: '\uFE92', final: '\uFE90', connectsBefore: true, connectsAfter: true },  // Beh
  '\u0629': { isolated: '\uFE93', beginning: '\uFE93', medial: '\uFE94', final: '\uFE94', connectsBefore: true, connectsAfter: false }, // Teh Marbuta
  '\u062A': { isolated: '\uFE95', beginning: '\uFE97', medial: '\uFE98', final: '\uFE96', connectsBefore: true, connectsAfter: true },  // Teh
  '\u062B': { isolated: '\uFE99', beginning: '\uFE9B', medial: '\uFE9C', final: '\uFE9A', connectsBefore: true, connectsAfter: true },  // Theh
  '\u062C': { isolated: '\uFE9D', beginning: '\uFE9F', medial: '\uFEA0', final: '\uFE9E', connectsBefore: true, connectsAfter: true },  // Jeem
  '\u062D': { isolated: '\uFEA1', beginning: '\uFEA3', medial: '\uFEA4', final: '\uFEA2', connectsBefore: true, connectsAfter: true },  // Hah
  '\u062E': { isolated: '\uFEA5', beginning: '\uFEA7', medial: '\uFEA8', final: '\uFEA6', connectsBefore: true, connectsAfter: true },  // Khah
  '\u062F': { isolated: '\uFEA9', beginning: '\uFEA9', medial: '\uFEAA', final: '\uFEAA', connectsBefore: true, connectsAfter: false }, // Dal
  '\u0630': { isolated: '\uFEAB', beginning: '\uFEAB', medial: '\uFEAC', final: '\uFEAC', connectsBefore: true, connectsAfter: false }, // Thal
  '\u0631': { isolated: '\uFEAD', beginning: '\uFEAD', medial: '\uFEAE', final: '\uFEAE', connectsBefore: true, connectsAfter: false }, // Reh
  '\u0632': { isolated: '\uFEAF', beginning: '\uFEAF', medial: '\uFEB0', final: '\uFEB0', connectsBefore: true, connectsAfter: false }, // Zain
  '\u0633': { isolated: '\uFEB1', beginning: '\uFEB3', medial: '\uFEB4', final: '\uFEB2', connectsBefore: true, connectsAfter: true },  // Seen
  '\u0634': { isolated: '\uFEB5', beginning: '\uFEB7', medial: '\uFEB8', final: '\uFEB6', connectsBefore: true, connectsAfter: true },  // Sheen
  '\u0635': { isolated: '\uFEB9', beginning: '\uFEBB', medial: '\uFEBC', final: '\uFEBA', connectsBefore: true, connectsAfter: true },  // Sad
  '\u0636': { isolated: '\uFEBD', beginning: '\uFEBF', medial: '\uFEC0', final: '\uFEBE', connectsBefore: true, connectsAfter: true },  // Dad
  '\u0637': { isolated: '\uFEC1', beginning: '\uFEC3', medial: '\uFEC4', final: '\uFEC2', connectsBefore: true, connectsAfter: true },  // Tah
  '\u0638': { isolated: '\uFEC5', beginning: '\uFEC7', medial: '\uFEC8', final: '\uFEC6', connectsBefore: true, connectsAfter: true },  // Zah
  '\u0639': { isolated: '\uFEC9', beginning: '\uFECB', medial: '\uFECC', final: '\uFECA', connectsBefore: true, connectsAfter: true },  // Ain
  '\u063A': { isolated: '\uFECD', beginning: '\uFECF', medial: '\uFED0', final: '\uFECE', connectsBefore: true, connectsAfter: true },  // Ghain
  '\u0641': { isolated: '\uFED1', beginning: '\uFED3', medial: '\uFED4', final: '\uFED2', connectsBefore: true, connectsAfter: true },  // Feh
  '\u0642': { isolated: '\uFED5', beginning: '\uFED7', medial: '\uFED8', final: '\uFED6', connectsBefore: true, connectsAfter: true },  // Qaf
  '\u0643': { isolated: '\uFED9', beginning: '\uFEDB', medial: '\uFEDC', final: '\uFEDA', connectsBefore: true, connectsAfter: true },  // Kaf
  '\u0644': { isolated: '\uFEDD', beginning: '\uFEDF', medial: '\uFEE0', final: '\uFEDE', connectsBefore: true, connectsAfter: true },  // Lam
  '\u0645': { isolated: '\uFEE1', beginning: '\uFEE3', medial: '\uFEE4', final: '\uFEE2', connectsBefore: true, connectsAfter: true },  // Meem
  '\u0646': { isolated: '\uFEE5', beginning: '\uFEE7', medial: '\uFEE8', final: '\uFEE6', connectsBefore: true, connectsAfter: true },  // Noon
  '\u0647': { isolated: '\uFEE9', beginning: '\uFEEB', medial: '\uFEEC', final: '\uFEEA', connectsBefore: true, connectsAfter: true },  // Heh
  '\u0648': { isolated: '\uFEED', beginning: '\uFEED', medial: '\uFEEE', final: '\uFEEE', connectsBefore: true, connectsAfter: false }, // Waw
  '\u0649': { isolated: '\uFEEF', beginning: '\uFEEF', medial: '\uFEF0', final: '\uFEF0', connectsBefore: true, connectsAfter: false }, // Alef Maksura
  '\u064A': { isolated: '\uFEF1', beginning: '\uFEF3', medial: '\uFEF4', final: '\uFEF2', connectsBefore: true, connectsAfter: true },  // Yeh
  
  // Custom placeholders for pre-merged Lam-Alef ligatures
  '\u06FC0': { isolated: '\uFEF5', beginning: '\uFEF5', medial: '\uFEF6', final: '\uFEF6', connectsBefore: true, connectsAfter: false }, // Lam-Alef Madda
  '\u06FC1': { isolated: '\uFEF7', beginning: '\uFEF7', medial: '\uFEF8', final: '\uFEF8', connectsBefore: true, connectsAfter: false }, // Lam-Alef Hamza Above
  '\u06FC2': { isolated: '\uFEF9', beginning: '\uFEF9', medial: '\uFEFA', final: '\uFEFA', connectsBefore: true, connectsAfter: false }, // Lam-Alef Hamza Below
  '\u06FC3': { isolated: '\uFEFB', beginning: '\uFEFB', medial: '\uFEFC', final: '\uFEFC', connectsBefore: true, connectsAfter: false }  // Lam-Alef
};

// Merge "Lam" and subsequent "Alef" variants into single placeholder characters
function mergeLamAlef(text: string): string {
  return text
    .replace(/\u0644\u0622/g, '\u06FC0')
    .replace(/\u0644\u0623/g, '\u06FC1')
    .replace(/\u0644\u0625/g, '\u06FC2')
    .replace(/\u0644\u0627/g, '\u06FC3');
}

// Shapes Arabic text so that characters are cursive and joined correctly
export function shapeArabic(text: string): string {
  if (!text) return '';
  const mergedText = mergeLamAlef(text);
  const chars = Array.from(mergedText);
  const result: string[] = [];
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const config = arabicMap[char];
    
    if (!config) {
      result.push(char);
      continue;
    }
    
    let linkBefore = false;
    if (i > 0) {
      const prevChar = chars[i - 1];
      const prevConfig = arabicMap[prevChar];
      if (prevConfig && prevConfig.connectsAfter && config.connectsBefore) {
        linkBefore = true;
      }
    }
    
    let linkAfter = false;
    if (i < chars.length - 1) {
      const nextChar = chars[i + 1];
      const nextConfig = arabicMap[nextChar];
      if (nextConfig && nextConfig.connectsBefore && config.connectsAfter) {
        linkAfter = true;
      }
    }
    
    if (linkBefore && linkAfter) {
      result.push(config.medial);
    } else if (linkBefore) {
      result.push(config.final);
    } else if (linkAfter) {
      result.push(config.beginning);
    } else {
      result.push(config.isolated);
    }
  }
  
  return result.join('');
}

// Bidi reordering: shapes Arabic text and reverses it, keeping numbers/English left-to-right
export function bidiReorder(text: string): string {
  if (!text) return '';
  
  // Shape standard Arabic text first
  const shaped = shapeArabic(text);
  
  const isRtlChar = (char: string): boolean => {
    const code = char.charCodeAt(0);
    // Standard Arabic range
    if (code >= 0x0600 && code <= 0x06FF) return true;
    // Arabic Presentation Forms
    if (code >= 0xFE70 && code <= 0xFEFF) return true;
    return false;
  };
  
  // Split the shaped string by spaces to perform word-level reordering
  const words = shaped.split(/(\s+)/);
  const processedWords = words.map(word => {
    let hasRtl = false;
    for (let i = 0; i < word.length; i++) {
      if (isRtlChar(word[i])) {
        hasRtl = true;
        break;
      }
    }
    
    if (hasRtl) {
      // Reverse Arabic character sequences
      const chars = Array.from(word).reverse();
      const swapped = chars.map(c => {
        if (c === '(') return ')';
        if (c === ')') return '(';
        if (c === '[') return ']';
        if (c === ']') return '[';
        if (c === '{') return '}';
        if (c === '}') return '{';
        if (c === '<') return '>';
        if (c === '>') return '<';
        return c;
      });
      return swapped.join('');
    }
    
    return word;
  });
  
  // Reverse word sequence for full RTL layout
  return processedWords.reverse().join('');
}

export interface ExportPDFOptions {
  reportTitle: string;
  settings?: OrganizationSettings;
  orientation?: 'portrait' | 'landscape';
  delayMs?: number;
  filename?: string;
  openPreviewModal?: boolean;
}

export interface TablePDFColumn {
  header: string;
  dataKey: string;
  width?: string;
  align?: 'right' | 'center' | 'left';
  format?: (value: any, row: any) => string;
}

export interface ExportTablePDFOptions {
  title: string;
  subtitle?: string;
  filename?: string;
  columns: TablePDFColumn[];
  data: Record<string, any>[];
  settings?: OrganizationSettings;
  orientation?: 'portrait' | 'landscape';
  summaryStats?: { label: string; value: string | number; color?: string }[];
  showSignatures?: boolean;
  rowHeightPx?: number;
  fontSizePt?: number;
}

/**
 * Directly exports and downloads a standalone .pdf file with high resolution (scale: 2),
 * complete Arabic typography, tables, headers, and formatting using html2canvas + jsPDF.
 */
export async function exportHTMLToDirectPDF(
  htmlContent: string,
  options: ExportPDFOptions
): Promise<void> {
  const sanitizedTitle = (options.filename || options.reportTitle || 'document')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');
  
  const dateStr = new Date().toISOString().split('T')[0];
  const outputFileName = `${sanitizedTitle}_${dateStr}.pdf`;
  // Clean the HTML
  const cleanHtml = (htmlContent || '')
    .replace(/window\.close\(\);?/gi, '')
    .replace(/window\.print\(\);?/gi, '')
    .trim();

  if (!cleanHtml) {
    console.warn('exportHTMLToDirectPDF: Empty HTML content provided');
    return;
  }

  // Parse HTML string to safely extract body, styles, and links
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(cleanHtml, 'text/html');

  // Intelligent column count detection to dynamically scale fonts and choose orientation
  const detectedTables = Array.from(parsedDoc.querySelectorAll('table'));
  let maxColsInDoc = 0;
  detectedTables.forEach(t => {
    const rows = Array.from(t.querySelectorAll('tr'));
    rows.forEach(r => {
      const cellCount = r.querySelectorAll('th, td').length;
      if (cellCount > maxColsInDoc) maxColsInDoc = cellCount;
    });
  });

  // Auto-upgrade to landscape if report has many columns (>= 7 cols) and orientation wasn't strictly forced
  const orientation = options.orientation || (maxColsInDoc >= 7 ? 'landscape' : 'portrait');
  const isLandscape = orientation === 'landscape';

  // Standard A4 dimensions in mm
  const a4WidthMm = isLandscape ? 297 : 210;
  const a4HeightMm = isLandscape ? 210 : 297;

  // Reference width in pixels for desktop layout rendering (wider canvas for dense multi-column tables)
  let widthPx = isLandscape ? 1122 : 794;
  if (maxColsInDoc >= 7) {
    widthPx = Math.max(widthPx, maxColsInDoc * 130);
  }

  // Create an off-screen render sandbox attached to body with exact geometry
  const container = document.createElement('div');
  container.id = 'direct-pdf-sandbox-' + Date.now();
  container.style.position = 'fixed';
  container.style.top = '0px';
  container.style.left = '0px';
  container.style.width = `${widthPx}px`;
  container.style.minHeight = '400px';
  container.style.zIndex = '-99999';
  container.style.opacity = '1';
  container.style.visibility = 'visible';
  container.style.pointerEvents = 'none';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.direction = 'rtl';
  container.style.boxSizing = 'border-box';
  container.style.overflow = 'visible';
  container.style.transform = 'none';

  // Inject essential base & print styles:
  // Strictly enforce letter-spacing: 0 and word-break: keep-all to prevent Arabic letters from getting broken or separated
  const baseStyle = document.createElement('style');
  baseStyle.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap');
    #${container.id} {
      font-family: 'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif !important;
      direction: rtl !important;
      text-align: right !important;
      background-color: #ffffff !important;
      color: #0f172a !important;
      line-height: 1.4 !important;
      letter-spacing: 0 !important;
    }
    #${container.id} * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      letter-spacing: 0 !important;
      word-spacing: normal !important;
      font-variant-ligatures: contextual !important;
      font-feature-settings: "liga" 1, "calt" 1 !important;
      -webkit-font-smoothing: antialiased !important;
      text-rendering: optimizeLegibility !important;
    }
    #${container.id} table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-bottom: 12px !important;
      table-layout: auto !important;
    }
    #${container.id} tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    #${container.id} tbody tr, #${container.id} tr.data-row, #${container.id} tr.table-data-row {
      height: 60px !important;
      min-height: 60px !important;
      max-height: 60px !important;
    }
    #${container.id} thead tr {
      height: 45px !important;
    }
    #${container.id} th, #${container.id} td {
      page-break-inside: avoid !important;
      word-break: keep-all !important;
      overflow-wrap: normal !important;
      white-space: normal !important;
      hyphens: none !important;
      vertical-align: middle !important;
      letter-spacing: 0 !important;
    }
    #${container.id} tbody td, #${container.id} tr.data-row td, #${container.id} tr.table-data-row td {
      height: 60px !important;
      min-height: 60px !important;
      max-height: 60px !important;
      vertical-align: middle !important;
    }
    #${container.id} img {
      max-width: 100% !important;
      height: auto !important;
    }
    #${container.id} .no-print, #${container.id} .print-hidden {
      display: none !important;
    }
  `;
  container.appendChild(baseStyle);

  // Copy all <style> and <link rel="stylesheet"> elements from parsedDoc
  const allStyles = Array.from(parsedDoc.querySelectorAll('style, link[rel="stylesheet"]'));
  for (const styleNode of allStyles) {
    container.appendChild(styleNode.cloneNode(true));
  }

  // Create inner wrapper with extracted body content
  const innerWrapper = document.createElement('div');
  innerWrapper.className = 'pdf-inner-content-wrapper';
  innerWrapper.style.width = '100%';
  innerWrapper.style.backgroundColor = '#ffffff';
  innerWrapper.style.padding = '12px';
  innerWrapper.style.boxSizing = 'border-box';
  innerWrapper.innerHTML = parsedDoc.body ? parsedDoc.body.innerHTML : cleanHtml;

  // Post-process all rendered tables to guarantee perfect Arabic font sizing, 60px row height and prevent letter chopping
  const tables = Array.from(innerWrapper.querySelectorAll('table'));
  tables.forEach(table => {
    table.style.width = '100%';
    table.style.tableLayout = 'auto';

    const hasCustomFont = table.getAttribute('data-custom-font') === 'true';

    const rows = Array.from(table.querySelectorAll('tr'));
    let tCols = 0;
    rows.forEach(r => {
      const c = r.querySelectorAll('th, td').length;
      if (c > tCols) tCols = c;
      const isHeader = r.parentElement?.tagName.toLowerCase() === 'thead';
      if (!isHeader) {
        (r as HTMLElement).style.setProperty('height', '60px', 'important');
        (r as HTMLElement).style.setProperty('min-height', '60px', 'important');
        (r as HTMLElement).style.setProperty('max-height', '60px', 'important');
      }
    });

    let targetFontPt = 7.5;
    let targetPadding = '4px 3.5px';

    if (tCols >= 14) {
      targetFontPt = 5.8;
      targetPadding = '2px 2px';
    } else if (tCols >= 11) {
      targetFontPt = 6.4;
      targetPadding = '3px 2.5px';
    } else if (tCols >= 9) {
      targetFontPt = 7.0;
      targetPadding = '3.5px 3px';
    }

    const cells = table.querySelectorAll('th, td');
    cells.forEach(c => {
      const el = c as HTMLElement;
      if (!hasCustomFont) {
        el.style.setProperty('font-size', `${targetFontPt}pt`, 'important');
      }
      el.style.setProperty('padding', targetPadding, 'important');
      el.style.setProperty('word-break', 'keep-all', 'important');
      el.style.setProperty('overflow-wrap', 'normal', 'important');
      el.style.setProperty('white-space', 'normal', 'important');
      el.style.setProperty('hyphens', 'none', 'important');
      el.style.setProperty('line-height', '1.3', 'important');
      el.style.setProperty('letter-spacing', '0', 'important');
      el.style.setProperty('vertical-align', 'middle', 'important');

      if (el.tagName.toLowerCase() === 'td') {
        el.style.setProperty('height', '60px', 'important');
        el.style.setProperty('min-height', '60px', 'important');
        el.style.setProperty('max-height', '60px', 'important');
      }

      // Protect strictly non-Arabic alphanumeric codes like VIN, Customs card
      const text = el.textContent?.trim() || '';
      const isStrictAscii = /^[a-zA-Z0-9\-_/ ]+$/.test(text);
      if (text.length >= 8 && isStrictAscii) {
        el.style.setProperty('white-space', 'nowrap', 'important');
        el.style.setProperty('font-family', 'monospace, sans-serif', 'important');
        el.style.setProperty('direction', 'ltr', 'important');
      }
    });
  });

  container.appendChild(innerWrapper);

  document.body.appendChild(container);

  try {
    // Wait for fonts to be ready
    if (document.fonts) {
      try {
        await Promise.race([
          Promise.all([
            document.fonts.load("400 12px Cairo"),
            document.fonts.load("700 12px Cairo"),
            document.fonts.load("900 12px Cairo"),
            document.fonts.ready
          ]),
          new Promise((r) => setTimeout(r, 1500))
        ]);
      } catch (e) {
        // ignore
      }
    }

    // Wait for all images inside container to load
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length > 0) {
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve(true);
          return new Promise((resolve) => {
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(true);
            img.onerror = () => resolve(true);
            setTimeout(() => resolve(true), 2000);
          });
        })
      );
    }

    // Settle layout
    const delay = Math.max(options.delayMs || 350, 350);
    await new Promise((resolve) => setTimeout(resolve, delay));

    // --- Root-cause fix for column clipping ---
    // Table cells are rendered with `table-layout: auto`, and cells holding long
    // ASCII codes (VIN numbers, plate numbers, etc.) are forced to `white-space: nowrap`
    // a few lines above. When a table has many columns or several of these unbreakable
    // values, its natural (min-content) rendered width can exceed the container's
    // estimated `widthPx` even though the table itself is styled `width: 100%` —
    // in auto table layout, a table is allowed to grow past its declared width to fit
    // content that can't wrap. html2canvas only ever captures the exact pixel rectangle
    // it's told to (`width`/`windowWidth` below), so any part of the table that spilled
    // past that rectangle was silently cut off, regardless of any layout/print settings.
    // Fix: after layout has settled, measure the actual rendered width of the widest
    // table (and the wrapper itself), and if it's wider than our estimate, grow the
    // container — and the capture width — to match before taking the screenshot.
    let measuredContentWidth = widthPx;
    const allMeasurableTables = Array.from(innerWrapper.querySelectorAll('table'));
    allMeasurableTables.forEach(t => {
      measuredContentWidth = Math.max(measuredContentWidth, (t as HTMLElement).scrollWidth);
    });
    measuredContentWidth = Math.max(measuredContentWidth, innerWrapper.scrollWidth);

    if (measuredContentWidth > widthPx) {
      // Small buffer for borders/rounding, then lock the container to the true content width
      widthPx = Math.ceil(measuredContentWidth) + 4;
      container.style.width = `${widthPx}px`;
      // Force a reflow so the new width takes effect before capture
      void container.offsetWidth;
      // Give the browser a brief moment to finish re-layout (font metrics, wrapping, etc.)
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    const totalHeight = Math.max(container.scrollHeight, container.offsetHeight, 400);

    // Direct high-res html2canvas rendering
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: widthPx,
      width: widthPx,
      height: totalHeight,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas render produced empty output');
    }

    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const pageCanvasHeight = Math.floor((canvasWidth * a4HeightMm) / a4WidthMm);
    const totalPages = Math.max(1, Math.ceil(canvasHeight / pageCanvasHeight));

    for (let page = 0; page < totalPages; page++) {
      const srcY = page * pageCanvasHeight;
      const currentSliceHeight = Math.min(pageCanvasHeight, canvasHeight - srcY);

      if (currentSliceHeight <= 0) break;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvasWidth;
      pageCanvas.height = pageCanvasHeight;

      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvasHeight);
        pageCtx.drawImage(
          canvas,
          0,
          srcY,
          canvasWidth,
          currentSliceHeight,
          0,
          0,
          canvasWidth,
          currentSliceHeight
        );
      }

      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.98);

      if (page > 0) {
        pdf.addPage([a4WidthMm, a4HeightMm], orientation);
      }

      pdf.addImage(
        pageImgData,
        'JPEG',
        0,
        0,
        a4WidthMm,
        a4HeightMm,
        undefined,
        'FAST'
      );
    }

    pdf.save(outputFileName);
  } catch (err) {
    console.error('Direct PDF export error, falling back to print dialog:', err);
    // Fallback: open print preview or trigger print
    if (typeof (window as any).showPrintPreview === 'function') {
      (window as any).showPrintPreview(cleanHtml);
    } else {
      window.print();
    }
  } finally {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
}

/**
 * html2canvas has notoriously unreliable support for <img src="data:image/svg+xml...">
 * — depending on the SVG's content it frequently rasterizes as a blank/invisible area
 * even though the exact same data URI displays fine as a normal <img> in the page or in
 * a native browser print (window.print()). That mismatch is exactly why this logo showed
 * up in every "normal" report (native print) but not in this "direct" PDF export
 * (html2canvas + jsPDF).
 *
 * We first try to pre-rasterize the SVG into a plain PNG data URI ourselves (via an
 * offscreen canvas), since PNG <img> tags are rendered reliably by html2canvas. BUT:
 * drawing certain SVGs onto a <canvas> and then reading it back with toDataURL() can
 * itself throw a SecurityError ("tainted canvas") in some browsers — silently reproducing
 * the exact same blank result. So this now returns '' on ANY failure (instead of the
 * original broken SVG), so the caller can fall back to a plain-HTML badge instead of an
 * image at all — see buildLogoBadgeHtml() below, which cannot suffer this class of bug
 * because it never touches <img>, SVG, or <canvas>.
 */
async function rasterizeSvgDataUriToPng(dataUri: string, targetWidthPx = 640): Promise<string> {
  if (!dataUri || !dataUri.startsWith('data:image/svg+xml')) return dataUri;

  try {
    const img = new Image();
    img.decoding = 'sync' as any;
    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = dataUri;
    });

    const naturalW = loaded.naturalWidth || 320;
    const naturalH = loaded.naturalHeight || 100;
    const scale = targetWidthPx / naturalW;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(naturalW * scale);
    canvas.height = Math.round(naturalH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Transparent background so the PNG composites correctly over the report's white header.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(loaded, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('rasterizeSvgDataUriToPng: failed to rasterize SVG logo (likely a tainted-canvas restriction), falling back to a plain HTML badge instead:', e);
    return '';
  }
}

/**
 * Pure HTML/CSS fallback brand mark — used whenever there is no real uploaded logo, or the
 * uploaded/generated logo is an SVG that could not be safely rasterized to PNG (see above).
 * Deliberately contains NO <img> and NO embedded SVG/canvas of any kind: html2canvas renders
 * plain styled DOM elements (divs, text, borders, gradients) with total reliability — the
 * same way it already renders every table cell in this report — so this can never reproduce
 * the "blank logo" failure that image-based approaches did.
 */
function buildLogoBadgeHtml(orgName: string, orgType: string): string {
  const safeOrgName = orgName || 'مؤسسة معرض السيارات';
  const initial = Array.from(safeOrgName.trim())[0] || 'م';
  return `
    <div style="display: inline-flex; align-items: center; gap: 8px; justify-content: center; direction: rtl;">
      <div style="width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background-color: #1e3a8a; display: flex; align-items: center; justify-content: center;">
        <span style="color: #ffffff; font-size: 18pt; font-weight: 900; font-family: 'Cairo', sans-serif; line-height: 1;">${initial}</span>
      </div>
      <div style="text-align: right; line-height: 1.25;">
        <div style="font-size: 10pt; font-weight: 900; color: #1e3a8a; font-family: 'Cairo', sans-serif;">${orgType || 'مؤسسة'}</div>
        <div style="font-size: 9pt; font-weight: 700; color: #334155; font-family: 'Cairo', sans-serif;">${safeOrgName}</div>
      </div>
    </div>
  `;
}


/**
 * Resolves any logo/image URL (relative path, absolute URL from the PHP backend, or blob URL)
 * into a self-contained base64 data URI. This guarantees the image survives the html2canvas
 * rasterization step regardless of CORS headers, mixed-content restrictions, or Electron's
 * file:// origin quirks — the exact reason the organization logo was silently missing from
 * exported PDFs (a cross-origin image load failure was being swallowed and treated as "loaded").
 * If the image is already a data: URI it is returned unchanged (no network round-trip).
 * On any failure the original URL is returned as a best-effort fallback.
 */
async function resolveImageToDataUri(url?: string | null): Promise<string> {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;

  try {
    const response = await fetch(trimmed, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('resolveImageToDataUri: failed to inline image, falling back to original URL:', trimmed, e);
    return trimmed;
  }
}

/**
 * High-performance direct Table data export to a beautifully formatted PDF document
 * with company header, logo, summary stats, badges, and signatures.
 */
export async function exportTableDataToPDF(options: ExportTablePDFOptions): Promise<void> {
  const { title, subtitle, columns, data, settings, summaryStats, showSignatures = true } = options;

  const rawTitle = (title && String(title).trim().length > 0)
    ? String(title).trim()
    : ((options as any).reportTitle && String((options as any).reportTitle).trim().length > 0)
      ? String((options as any).reportTitle).trim()
      : '';

  const rawSubtitle = (subtitle && String(subtitle).trim().length > 0) ? String(subtitle).trim() : '';

  const cleanFilename = (options.filename && String(options.filename).trim().length > 0)
    ? String(options.filename).replace(/[_\-\.]+/g, ' ').trim()
    : '';

  const finalTitle = rawTitle || rawSubtitle || cleanFilename || 'تقرير جدول مخزون السيارات';
  
  let finalSubtitle = '';
  if (rawSubtitle && rawSubtitle !== finalTitle) {
    finalSubtitle = rawSubtitle;
  } else if (cleanFilename && cleanFilename !== finalTitle) {
    finalSubtitle = cleanFilename;
  }

  const colCount = columns.length;
  // Automatically select landscape orientation if table has 7 or more columns
  const orientation = options.orientation || (colCount >= 7 ? 'landscape' : 'portrait');
  const rowHeightPx = options.rowHeightPx || 60;

  // Dynamically calculate font size and padding based on column count or user preference
  let baseFontSizePt = options.fontSizePt || 8.5;
  let headerFontSizePt = options.fontSizePt ? Math.max(options.fontSizePt + 0.8, 7.5) : 9.5;
  let cellPadding = '4px 6px';
  let headerPadding = '8px 6px';

  if (!options.fontSizePt) {
    if (colCount >= 14) {
      baseFontSizePt = 5.8;
      headerFontSizePt = 6.6;
      cellPadding = '2.5px 2px';
      headerPadding = '4px 3px';
    } else if (colCount >= 11) {
      baseFontSizePt = 6.4;
      headerFontSizePt = 7.2;
      cellPadding = '3.5px 2.5px';
      headerPadding = '5px 3.5px';
    } else if (colCount >= 9) {
      baseFontSizePt = 7.0;
      headerFontSizePt = 7.8;
      cellPadding = '4px 3px';
      headerPadding = '6px 4px';
    } else if (colCount >= 7) {
      baseFontSizePt = 7.8;
      headerFontSizePt = 8.6;
      cellPadding = '5px 4px';
      headerPadding = '7px 5px';
    }
  }

  const orgName = settings?.name || 'مؤسسة معرض السيارات';
  const orgType = settings?.orgType || 'مؤسسة';
  const cr = settings?.commercialRegister || '';
  const vat = settings?.taxNumber || '';
  const phone = settings?.contactNumber || '';
  const address = settings?.address || 'المملكة العربية السعودية';

  // Resolve the logo with a guaranteed-safe fallback chain:
  //   1) A real uploaded raster logo (PNG/JPG data URI) → use directly, no image
  //      processing needed, always renders fine in html2canvas.
  //   2) A real uploaded logo that happens to be an SVG, or the auto-generated
  //      branded SVG placeholder → try to rasterize it to PNG.
  //   3) If there is no logo at all, OR the rasterization attempt fails for any
  //      reason (including a tainted-canvas SecurityError) → use a pure HTML/CSS
  //      badge that contains no <img>/SVG/<canvas> at all, so it cannot suffer
  //      from this whole class of "blank logo" bug.
  const resolvedLogoUrl = await resolveImageToDataUri(settings?.logoUrl);

  let logoImageUrl = '';
  if (resolvedLogoUrl && !resolvedLogoUrl.startsWith('data:image/svg+xml')) {
    // Already a raster image (the common case for a real uploaded logo file).
    logoImageUrl = resolvedLogoUrl;
  } else {
    const svgSource = resolvedLogoUrl || getLogoDataUri(settings?.name, settings?.orgType);
    logoImageUrl = await rasterizeSvgDataUriToPng(svgSource, 640);
  }
  const logoBadgeHtml = logoImageUrl ? '' : buildLogoBadgeHtml(orgName, orgType);

  const resolvedStampUrl = await resolveImageToDataUri(settings?.stampUrl);
  let stampUrl = '';
  if (resolvedStampUrl) {
    stampUrl = resolvedStampUrl.startsWith('data:image/svg+xml')
      ? await rasterizeSvgDataUriToPng(resolvedStampUrl, 340)
      : resolvedStampUrl;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA');
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  // Render Stats Cards HTML
  let statsHtml = '';
  if (summaryStats && summaryStats.length > 0) {
    statsHtml = `
      <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
        ${summaryStats.map(stat => `
          <div style="flex: 1; min-width: 140px; background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; text-align: center;">
            <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">${stat.label}</div>
            <div style="font-size: 13pt; color: ${stat.color || '#1e3a8a'}; font-weight: 900;">${stat.value}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Render Table Header & Rows
  const tableHeaderHtml = `
    <thead>
      <tr style="background-color: #0f172a; color: #ffffff; height: 45px !important;">
        <th style="padding: ${headerPadding}; border: 1px solid #334155; font-size: ${headerFontSizePt}pt; font-weight: 900; text-align: center; width: 38px; height: 45px !important; vertical-align: middle !important; letter-spacing: 0 !important;">#</th>
        ${columns.map(col => `
          <th style="padding: ${headerPadding}; border: 1px solid #334155; font-size: ${headerFontSizePt}pt; font-weight: 900; text-align: ${col.align || 'center'}; word-break: keep-all; overflow-wrap: normal; white-space: normal; hyphens: none; letter-spacing: 0 !important; height: 45px !important; vertical-align: middle !important; ${col.width ? `width: ${col.width};` : ''}">
            ${col.header}
          </th>
        `).join('')}
      </tr>
    </thead>
  `;

  const tableBodyHtml = `
    <tbody>
      ${data.map((row, idx) => {
        const isCarRow = Boolean(row.status || row.carStatus || row.vin || row.brand);
        const statusInfo = isCarRow ? getCarStatusColorInfo(row, settings) : null;
        const defaultBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const rowBg = statusInfo && statusInfo.statusType !== 'default' ? statusInfo.bg : defaultBg;
        const rowTextColor = statusInfo && statusInfo.statusType !== 'default' ? statusInfo.text : '#1e293b';
        const isRowBold = statusInfo && statusInfo.statusType !== 'default';

        return `
          <tr style="background-color: ${rowBg} !important; color: ${rowTextColor} !important; border-bottom: 1px solid #cbd5e1; height: ${rowHeightPx}px !important; min-height: ${rowHeightPx}px !important; max-height: ${rowHeightPx}px !important;">
            <td style="padding: ${cellPadding}; border: 1px solid #94a3b8; font-size: ${baseFontSizePt}pt; font-weight: bold; text-align: center; color: ${rowTextColor}; background-color: ${rowBg}; height: ${rowHeightPx}px !important; min-height: ${rowHeightPx}px !important; max-height: ${rowHeightPx}px !important; vertical-align: middle !important; letter-spacing: 0 !important;">${idx + 1}</td>
            ${columns.map(col => {
              const rawVal = row[col.dataKey];
              let formattedVal = col.format ? col.format(rawVal, row) : (rawVal !== undefined && rawVal !== null ? String(rawVal) : '-');
              let cellBg = rowBg;
              let cellTextColor = rowTextColor;
              let cellBold = isRowBold;

              // Status formatting badge
              if (col.dataKey === 'status' || col.dataKey === 'carStatus' || col.header?.includes('حالة')) {
                const cellStatusInfo = getCarStatusColorInfo(rawVal || row, settings);
                if (cellStatusInfo.statusType !== 'default') {
                  formattedVal = `<span style="background-color: ${cellStatusInfo.badgeBg}; color: ${cellStatusInfo.badgeColor}; border: 1px solid ${cellStatusInfo.badgeBorder}; padding: 2px 6px; border-radius: 4px; font-weight: 900; font-size: ${baseFontSizePt}pt; display: inline-block; white-space: nowrap;">${formattedVal}</span>`;
                }
              }

              // Rental status formatting
              if (col.dataKey === 'rental' || col.dataKey === 'rentalStatus' || col.header?.includes('تجير') || col.header?.includes('تجهيز')) {
                const rentalInfo = getCarRentalColorInfo(rawVal || row, settings);
                if (rentalInfo.isNotRented) {
                  cellBg = rentalInfo.bg;
                  cellTextColor = rentalInfo.text;
                  cellBold = true;
                  formattedVal = `<span style="background-color: ${rentalInfo.bg}; color: ${rentalInfo.text}; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: ${baseFontSizePt}pt; display: inline-block; white-space: nowrap;">${formattedVal}</span>`;
                }
              }

              // VIN Matching formatting
              if (col.dataKey === 'vinMatching' || col.dataKey === 'vin_matching' || col.header?.includes('مطابقة')) {
                const isMismatch = String(rawVal).includes('غير') || String(rawVal) === 'غير مطابق';
                if (isMismatch) {
                  const mismatchInfo = getCarStatusColorInfo('غير مطابق', settings);
                  cellBg = mismatchInfo.bg;
                  cellTextColor = mismatchInfo.text;
                  cellBold = true;
                  formattedVal = `<span style="background-color: ${mismatchInfo.badgeBg}; color: ${mismatchInfo.badgeColor}; padding: 2px 6px; border-radius: 4px; font-weight: 900; font-size: ${baseFontSizePt}pt; display: inline-block; white-space: nowrap;">${formattedVal}</span>`;
                }
              }

              // Long alphanumeric codes like VIN, Customs Card
              const isAlphanumericCode = (col.dataKey === 'vin' || col.dataKey === 'customsCard' || (typeof rawVal === 'string' && rawVal.length >= 10 && !rawVal.includes(' ') && /^[a-zA-Z0-9\-_/]+$/.test(rawVal)));
              const codeStyle = isAlphanumericCode ? `white-space: nowrap !important; font-family: monospace, sans-serif !important; font-size: ${Math.max(4.8, baseFontSizePt - 0.5)}pt !important; direction: ltr; display: inline-block;` : '';

              return `
                <td style="padding: ${cellPadding}; border: 1px solid #94a3b8; font-size: ${baseFontSizePt}pt; background-color: ${cellBg} !important; color: ${cellTextColor} !important; text-align: ${col.align || 'center'}; font-weight: ${cellBold || col.align === 'right' ? '700' : 'normal'}; line-height: 1.3; height: ${rowHeightPx}px !important; min-height: ${rowHeightPx}px !important; max-height: ${rowHeightPx}px !important; vertical-align: middle !important; word-break: keep-all; overflow-wrap: normal; white-space: normal; hyphens: none; letter-spacing: 0 !important;">
                  <span style="${codeStyle}">${formattedVal}</span>
                </td>
              `;
            }).join('')}
          </tr>
        `;
      }).join('')}
    </tbody>
  `;

  // Render Signatures block
  const signaturesHtml = showSignatures ? `
    <div style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 20px; page-break-inside: avoid;">
      <div style="text-align: center; width: 200px;">
        <div style="font-size: 9.5pt; font-weight: bold; color: #475569; margin-bottom: 35px;">إعداد وتدقيق المسؤول</div>
        <div style="border-top: 1.5px dashed #94a3b8; padding-top: 5px; font-size: 8.5pt; color: #64748b;">التوقيع: ________________</div>
      </div>

      <div style="text-align: center; width: 200px; position: relative;">
        <div style="font-size: 9.5pt; font-weight: bold; color: #475569; margin-bottom: 35px;">اعتماد إدارة الفرع والختم</div>
        <div style="border-top: 1.5px dashed #94a3b8; padding-top: 5px; font-size: 8.5pt; color: #64748b;">الختم الرسمي للمؤسسة</div>
        ${stampUrl ? `<img src="${stampUrl}" style="position: absolute; top: -10px; left: 40px; width: 85px; height: 85px; opacity: 0.85; pointer-events: none;" alt="ختم" />` : ''}
      </div>
    </div>
  ` : '';

  // Large centered watermark logo shown faintly (28% opacity) above/behind the report header.
  // Only rendered when we have a real image — the plain-HTML badge fallback is skipped here
  // (it's designed as a compact header mark, not a large translucent background graphic).
  const watermarkLogoHtml = logoImageUrl ? `
    <div style="position: absolute; top: 6px; left: 0; right: 0; display: flex; justify-content: center; pointer-events: none; z-index: 0;">
      <img src="${logoImageUrl}" style="width: 200px; max-width: 45%; height: auto; object-fit: contain; opacity: 0.28;" alt="العلامة المائية لشعار المؤسسة" />
    </div>
  ` : '';

  const reportHtml = `
    <div style="position: relative; padding: 16px; background-color: #ffffff; color: #0f172a; direction: rtl; font-family: 'Cairo', sans-serif;">
      ${watermarkLogoHtml}
      <div style="position: relative; z-index: 1;">
      <!-- Header -->
      <table style="width: 100% !important; border-collapse: collapse !important; border: none !important; border-bottom: 2px solid #0f172a !important; margin-bottom: 16px !important; background: transparent !important;">
        <tr>
          <td style="width: 35% !important; text-align: right !important; vertical-align: middle !important; border: none !important; padding: 0 0 10px 0 !important;">
            <div style="font-size: 13pt; font-weight: 900; color: #0f172a;">${orgType} ${orgName}</div>
            ${cr ? `<div style="font-size: 8.5pt; color: #475569; margin-top: 2px;">سجل تجاري: <strong style="color: #0f172a;">${cr}</strong></div>` : ''}
            ${vat ? `<div style="font-size: 8.5pt; color: #475569;">الرقم الضريبي: <strong style="color: #0f172a;">${vat}</strong></div>` : ''}
            ${phone ? `<div style="font-size: 8.5pt; color: #475569;">هاتف: <strong style="color: #0f172a;">${phone}</strong></div>` : ''}
          </td>
          <td style="width: 30% !important; text-align: center !important; vertical-align: middle !important; border: none !important; padding: 0 0 10px 0 !important;">
            ${logoImageUrl ? `<img src="${logoImageUrl}" style="max-height: 60px; max-width: 150px; object-fit: contain;" alt="الشعار" />` : logoBadgeHtml}
          </td>
          <td style="width: 35% !important; text-align: left !important; vertical-align: middle !important; border: none !important; padding: 0 0 10px 0 !important;">
            <div style="font-size: 8.5pt; color: #64748b;">المملكة العربية السعودية</div>
            <div style="font-size: 8.5pt; color: #475569; margin-top: 2px;">تاريخ التصدير: <strong style="color: #0f172a;">${dateStr}</strong></div>
            <div style="font-size: 8.5pt; color: #475569;">الوقت: <strong style="color: #0f172a;">${timeStr}</strong></div>
            ${address ? `<div style="font-size: 8pt; color: #64748b; margin-top: 2px;">${address}</div>` : ''}
          </td>
        </tr>
      </table>

      <!-- Report Title Container -->
      <table style="margin: 0 auto 16px auto !important; border-collapse: collapse !important; border: none !important; width: auto !important; max-width: 90% !important; background: transparent !important;">
        <tr>
          <td style="background-color: #f1f5f9 !important; border: 2px solid #cbd5e1 !important; border-radius: 10px !important; padding: 10px 36px !important; text-align: center !important; vertical-align: middle !important;">
            <div style="margin: 0 !important; padding: 0 !important; font-size: 14pt !important; font-weight: 900 !important; color: #0f172a !important; font-family: 'Cairo', 'Tajawal', Tahoma, sans-serif !important; line-height: 1.4 !important; text-align: center !important;">
              ${finalTitle}
            </div>
            ${finalSubtitle ? `
              <div style="margin-top: 4px !important; padding: 0 !important; font-size: 10pt !important; color: #475569 !important; font-weight: 700 !important; font-family: 'Cairo', 'Tajawal', Tahoma, sans-serif !important; text-align: center !important;">
                ${finalSubtitle}
              </div>
            ` : ''}
          </td>
        </tr>
      </table>

      <!-- Summary Stats -->
      ${statsHtml}

      <!-- Main Data Table -->
      <table data-custom-font="${options.fontSizePt ? 'true' : 'false'}" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: 'Cairo', 'Tajawal', Tahoma, sans-serif;">
        ${tableHeaderHtml}
        ${tableBodyHtml}
      </table>

      <!-- Signatures & Footer -->
      ${signaturesHtml}

      <div style="text-align: center; margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 8pt; color: #94a3b8;">
        تم استخراج هذا التقرير آلياً عبر نظام إدارة المخزون والمبيعات • ${orgName} • صفحة رسمية معتمدة
      </div>
      </div>
    </div>
  `;

  await printReportHtmlNatively(reportHtml, orientation, options.filename || title);
}

/**
 * Opens the exact same native browser print flow used by every other report in the app
 * (window.print() via the shared print-preview modal, or a hidden iframe as fallback) —
 * instead of the html2canvas + jsPDF direct-download pipeline. The user can still choose
 * "Save as PDF" from the browser's print dialog, but rendering is done natively by the
 * browser, which is exactly why the logo (and everything else) always displays correctly
 * in those other reports regardless of it being a real image or an SVG.
 */
async function printReportHtmlNatively(
  bodyHtml: string,
  orientation: 'portrait' | 'landscape',
  documentTitle: string
): Promise<void> {
  const fullDoc = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>${documentTitle}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap');
        @page { size: A4 ${orientation}; margin: 8mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; font-family: 'Cairo', 'Tajawal', Tahoma, sans-serif; direction: rtl; background: #ffffff; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; }
        thead { display: table-header-group; }
      </style>
    </head>
    <body>
      ${bodyHtml}
      <script>
        window.onload = function () {
          setTimeout(function () { window.print(); }, 600);
        };
      </script>
    </body>
    </html>
  `;

  if (typeof (window as any).showPrintPreview === 'function') {
    (window as any).showPrintPreview(fullDoc);
    return;
  }

  // Fallback: same hidden-iframe + native print approach used across the rest of the app.
  const iframeHtml = fullDoc.replace(/window\.print\(\);?/g, '');
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.bottom = '0';
  iframe.style.right = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(iframeHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Print failed:', e);
      }
      setTimeout(() => {
        try {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        } catch (err) {
          console.error(err);
        }
      }, 3000);
    }, 700);
  }
}

/**
 * Creates and downloads a professional, high-fidelity PDF from an HTML container string or DOM element.
 * Defaults to direct PDF file download. If openPreviewModal is explicitly true, opens the preview modal.
 */
export async function exportHTMLToPDF(
  htmlContent: string,
  options: ExportPDFOptions
): Promise<void> {
  const cleanHtml = htmlContent
    .replace(/window\.close\(\);?/gi, '')
    .replace(/window\.print\(\);?/gi, '')
    .trim();

  // If user requested modal preview explicitly
  if (options.openPreviewModal && typeof (window as any).showPrintPreview === 'function') {
    (window as any).showPrintPreview(cleanHtml);
    return;
  }

  // Direct PDF export and download
  await exportHTMLToDirectPDF(cleanHtml, options);
}
