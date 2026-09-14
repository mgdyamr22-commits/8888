import { OrganizationSettings } from '../../types';
import { getLogoDataUri } from '../../components/OfficialAssets';

export interface BilingualHeaderOptions {
  docSerial?: string;
  showSerial?: boolean;
}

export function getBilingualPrintHeaderHtml(settings?: OrganizationSettings, options?: BilingualHeaderOptions): string {
  const currentSettings = settings || ({} as OrganizationSettings);
  
  const arOrgType = currentSettings.orgType || 'مؤسسة';
  const arName = currentSettings.name || 'سما الفرسان للتجارة';
  const arCr = currentSettings.commercialRegister || '5950007763';
  const arVat = currentSettings.taxNumber || '';
  const arPhone = currentSettings.contactNumber || '';
  const arAddress = currentSettings.address || 'المملكة العربية السعودية';

  const defaultEnType = arOrgType === 'شركة' ? 'Company' : 'Est.';
  const enOrgType = currentSettings.orgTypeEn || defaultEnType;
  const enName = currentSettings.nameEn || currentSettings.name || 'AL-FORSAN TRADING';
  const enActivity = currentSettings.activityEn || 'For Cars Exhibition & Trading';
  const enCr = currentSettings.commercialRegisterEn || currentSettings.commercialRegister || '5950007763';
  const enVat = currentSettings.taxNumberEn || currentSettings.taxNumber || '';
  const enPhone = currentSettings.contactNumberEn || currentSettings.contactNumber || '';
  const enAddress = currentSettings.addressEn || 'Kingdom of Saudi Arabia';

  const logoSrc = currentSettings.logoUrl || getLogoDataUri(currentSettings.name, currentSettings.orgType);

  return `
    <div class="bilingual-header-box">
      <!-- Arabic Info (Right) -->
      <div class="bilingual-header-side bilingual-header-ar">
        <div class="bilingual-title-ar">${arOrgType} ${arName}</div>
        ${arCr ? `<div class="bilingual-line-ar"><span class="lbl-ar">سجل تجاري :</span> <span class="val-mono">${arCr}</span></div>` : ''}
        ${arVat ? `<div class="bilingual-line-ar"><span class="lbl-ar">الرقم الضريبي :</span> <span class="val-mono">${arVat}</span></div>` : ''}
        ${arPhone ? `<div class="bilingual-line-ar"><span class="lbl-ar">رقم التواصل :</span> <span class="val-mono">${arPhone}</span></div>` : ''}
        ${arAddress ? `<div class="bilingual-line-ar"><span class="lbl-ar">${arAddress}</span></div>` : ''}
      </div>

      <!-- Centered Logo (Middle) -->
      <div class="bilingual-header-center">
        <img src="${logoSrc}" class="bilingual-logo" alt="Logo" />
      </div>

      <!-- English Info (Left) -->
      <div class="bilingual-header-side bilingual-header-en">
        <div class="bilingual-title-en">${enOrgType} ${enName}</div>
        ${enActivity ? `<div class="bilingual-line-en">${enActivity}</div>` : ''}
        ${enCr ? `<div class="bilingual-line-en"><span class="lbl-en">C.R :</span> <span class="val-mono">${enCr}</span></div>` : ''}
        ${enVat ? `<div class="bilingual-line-en"><span class="lbl-en">VAT :</span> <span class="val-mono">${enVat}</span></div>` : ''}
        ${enPhone ? `<div class="bilingual-line-en"><span class="lbl-en">Tel :</span> <span class="val-mono">${enPhone}</span></div>` : ''}
        ${enAddress ? `<div class="bilingual-line-en"><span class="lbl-en">${enAddress}</span></div>` : ''}
      </div>
    </div>
  `;
}

export function getBilingualPrintHeaderCss(): string {
  return `
    .bilingual-header-box {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      width: 100% !important;
      margin-bottom: 4px !important;
      padding: 2px 4px 6px 4px !important;
      border-bottom: 2px solid #000 !important;
      box-sizing: border-box !important;
    }
    .bilingual-header-side {
      flex: 1 1 36% !important;
      max-width: 38% !important;
    }
    .bilingual-header-ar {
      text-align: right !important;
      direction: rtl !important;
      font-size: 8.5pt !important;
      font-weight: 700 !important;
      line-height: 1.35 !important;
      color: #000 !important;
    }
    .bilingual-title-ar {
      font-size: 11pt !important;
      font-weight: 900 !important;
      color: #000 !important;
      margin-bottom: 2px !important;
      letter-spacing: normal !important;
    }
    .bilingual-line-ar {
      margin-top: 1px !important;
    }
    .bilingual-header-center {
      flex: 0 0 24% !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      padding: 0 4px !important;
    }
    .bilingual-logo {
      max-width: 130px !important;
      max-height: 65px !important;
      object-fit: contain !important;
      display: block !important;
      margin: 0 auto !important;
    }
    .bilingual-header-en {
      text-align: left !important;
      direction: ltr !important;
      font-size: 8pt !important;
      font-weight: 700 !important;
      line-height: 1.35 !important;
      color: #000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
    }
    .bilingual-title-en {
      font-size: 10pt !important;
      font-weight: 900 !important;
      color: #000 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.3px !important;
      margin-bottom: 2px !important;
    }
    .bilingual-line-en {
      margin-top: 1px !important;
    }
    .val-mono {
      font-family: monospace, Courier, sans-serif !important;
      font-weight: bold !important;
    }
    .lbl-ar, .lbl-en {
      font-weight: 900 !important;
    }
  `;
}
