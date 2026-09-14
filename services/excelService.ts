import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { OrganizationSettings } from '../types';
import { 
  getResolvedStatusColors, 
  getCarStatusColorInfo, 
  getCarRentalColorInfo, 
  hexToArgb 
} from '../src/utils/statusColors';

export interface SmartExportProgress {
  percent: number;
  stage: string;
  processedRows: number;
  totalRows: number;
}

export interface ExcelExportDiagnostics {
  columnsWidths: { header: string; calculatedWidth: number; longestValue: string }[];
  emptyRowsDetected: number;
  activeRowsExported: number;
  printOrientation: 'portrait' | 'landscape';
}

export class ExcelService {
  /**
   * Helper to execute a batch operation asynchronously to avoid freezing the UI thread.
   */
  static async runBatchAsync<T>(
    items: T[],
    batchSize: number,
    processFn: (chunk: T[], startIndex: number) => Promise<void> | void,
    onProgress?: (progress: SmartExportProgress) => void,
    stageName = 'تصدير البيانات'
  ): Promise<number> {
    const total = items.length;
    let processed = 0;

    while (processed < total) {
      const nextBatchSize = Math.min(batchSize, total - processed);
      const chunk = items.slice(processed, processed + nextBatchSize);
      
      await processFn(chunk, processed);
      processed += nextBatchSize;

      if (onProgress) {
        onProgress({
          percent: Math.round((processed / total) * 100),
          stage: stageName,
          processedRows: processed,
          totalRows: total
        });
      }

      // Yield thread back to browser
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return processed;
  }

  /**
   * Universal advanced worksheet formatter that implements the strict visual styling specifications:
   * - Font Family: Arial, Font Size: 11 pt (reduced & legible) for data, 12 pt for headers
   * - Header: Bold text, Background Slate-900, appropriate height
   * - Data: Unified row height (45px = 33.75pt or 60px = 45pt), Vertical Centered, text wrap enabled
   * - Alignments: Right-align Arabic descriptions, Center-align index and numeric values
   * - Alternating rows: White or #FFFDF5 even, and #F7F7F7 odd rows
   * - Status background overrides: Sold (soft green), Transferred (soft orange), Reserved (soft yellow), Not-for-sale (soft red)
   * - Auto-fitted column widths with safe minimum/maximum limits
   * - Ready for printing: Repeat header row on all pages, margins 0.4, fit to 1 page width
   */
  static formatWorksheet(
    worksheet: ExcelJS.Worksheet,
    options: {
      isRTL: boolean;
      minWidth?: number;
      maxWidth?: number;
      skipRowHeights?: boolean;
      rowHeightPx?: number;
      fontSizePt?: number;
      settings?: OrganizationSettings;
    }
  ) {
    const { 
      isRTL, 
      minWidth = 12, 
      maxWidth = 60, 
      skipRowHeights = false, 
      rowHeightPx = 45, 
      fontSizePt = 11,
      settings 
    } = options;

    // Excel row height in points (1px = 0.75pt):
    // 45px = 33.75pt (unified compact default)
    // 60px = 45.0pt (unified comfortable option)
    const targetRowHeightPt = rowHeightPx ? Number((rowHeightPx * 0.75).toFixed(2)) : 33.75;
    const headerHeightPt = Math.max(28, targetRowHeightPt);

    const colCount = worksheet.columns ? worksheet.columns.length : 10;

    // 1. Dynamic Column Header row detection
    let headerRowIdx = 1;
    if (colCount >= 3) {
      for (let r = 1; r <= 10; r++) {
        const row = worksheet.getRow(r);
        const cell1 = row.getCell(1);
        const cell2 = row.getCell(2);
        const cell3 = row.getCell(3);
        
        if (cell1.value !== null && cell1.value !== undefined && String(cell1.value).trim() !== '' &&
            cell2.value !== null && cell2.value !== undefined && String(cell2.value).trim() !== '' &&
            cell3.value !== null && cell3.value !== undefined && String(cell3.value).trim() !== '') {
          const cell1Addr = cell1.address;
          const cell2MasterAddr = cell2.master ? cell2.master.address : cell2.address;
          if (cell2MasterAddr !== cell1Addr) {
            headerRowIdx = r;
            break;
          }
        }
      }
    }

    // 2. RTL Setting and Frozen Headers (starting from the detected headerRowIdx)
    worksheet.views = [
      {
        rightToLeft: isRTL,
        state: 'frozen',
        xSplit: 0,
        ySplit: headerRowIdx, // Freeze Row containing true headers
        activePane: 'bottomLeft'
      } as any
    ];

    // 3. Enable Auto Filter for the detected Header row
    worksheet.autoFilter = {
      from: { row: headerRowIdx, column: 1 },
      to: { row: headerRowIdx, column: colCount || 1 }
    };

    // 4. Print setup: margins, auto-orientation, repeat header on pages, fit columns to A4 width
    worksheet.pageSetup = {
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0, // dynamic vertical page flow
      orientation: colCount > 7 ? 'landscape' : 'portrait',
      paperSize: 9, // A4
      printTitlesRow: `${headerRowIdx}:${headerRowIdx}`, // Repeat true header row on every printed page!
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2
      }
    };

    // 5. Formatting rows before the header (Title blocks & metadata)
    for (let r = 1; r < headerRowIdx; r++) {
      const row = worksheet.getRow(r);
      if (!skipRowHeights) {
        row.height = Math.max(26, targetRowHeightPt);
      }
      row.eachCell({ includeEmpty: false }, (cell) => {
        // Refined title font size (e.g. 13pt Arial Bold)
        cell.font = {
          name: 'Arial',
          size: Math.min(13, fontSizePt + 2),
          bold: true,
          color: cell.font?.color || { argb: 'FFFFFFFF' } // default white if not specified
        };
        // Preserve fill, but if none, give a slate-800 look
        if (!cell.fill || (cell.fill as any).pattern === 'none') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F2937' } // Slate 800
          };
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
          readingOrder: isRTL ? 'rtl' : 'ltr'
        };
      });
    }

    // 6. Formatting the true Header Row
    const headerRow = worksheet.getRow(headerRowIdx);
    if (!skipRowHeights) {
      headerRow.height = headerHeightPt;
    }
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' } // Slate 900 background
      };
      cell.font = {
        name: 'Arial',
        size: fontSizePt + 1, // e.g. 12pt bold for header
        bold: true,
        color: { argb: 'FFFFFFFF' } // White text
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
        readingOrder: isRTL ? 'rtl' : 'ltr'
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // 7. Formatting Data Rows (Rows after the header row)
    const colLengths = new Array(colCount).fill(0);

    // Detect column indices dynamically to format specific cells
    const carColIndices: number[] = [];
    const statusColIndices: number[] = [];
    const rentalStatusColIndices: number[] = [];
    const colorModelColIndices: number[] = [];
    const cardNumberColIndices: number[] = [];
    const vinMatchingColIndices: number[] = [];

    const totalColsForCheck = Math.max(worksheet.columns ? worksheet.columns.length : 0, worksheet.actualColumnCount, colCount, 1);
    for (let colNum = 1; colNum <= totalColsForCheck; colNum++) {
      const column = worksheet.getColumn(colNum);
      const colHeader = column.header ? String(column.header).trim() : '';

      const isCarCol = colHeader === 'السيارة' || 
                       colHeader === 'المركبة' || 
                       colHeader === 'نوع السيارة' || 
                       colHeader === 'ماركة السيارة' ||
                       colHeader === 'الماركة' ||
                       colHeader === 'الموديل' ||
                       colHeader === 'نوع المركبة' ||
                       colHeader.includes('سيارة') ||
                       colHeader.includes('السيارة') ||
                       colHeader.includes('المركبة') ||
                       column.key === 'car' || 
                       column.key === 'vehicle' || 
                       column.key === 'brand' || 
                       column.key === 'model' || 
                       column.key === 'carName';
      if (isCarCol) {
        carColIndices.push(colNum);
      }

      const isStatusCol = colHeader === 'حالة السيارة' || 
                          colHeader === 'الحالة' || 
                          colHeader === 'حالة المركبة' || 
                          colHeader === 'الحالة والموقع' || 
                          column.key === 'status' || 
                          column.key === 'carStatus';
      if (isStatusCol) {
        statusColIndices.push(colNum);
      }

      const isRentalStatusCol = colHeader === 'حالة التجير' || 
                                colHeader === 'حالة التجهيز' || 
                                colHeader === 'التجهيز' || 
                                colHeader === 'حالة التأجير' || 
                                column.key === 'rental' || 
                                column.key === 'rentalStatus';
      if (isRentalStatusCol) {
        rentalStatusColIndices.push(colNum);
      }

      const isColorModelCol = colHeader === 'اللون والموديل' || 
                              colHeader === 'اللون' || 
                              colHeader === 'اللون والمواصفات' || 
                              colHeader === 'الموديل واللون' || 
                              colHeader === 'الموديل' || 
                              colHeader === 'اللون الخارجي' || 
                              column.key === 'color' || 
                              column.key === 'colorModel' || 
                              column.key === 'color_model' || 
                              column.key === 'colorAndModel';
      if (isColorModelCol) {
        colorModelColIndices.push(colNum);
      }

      const isCardNumberCol = colHeader === 'البطاقة الجمركية' || 
                              colHeader === 'بطاقة جمركية' || 
                              colHeader === 'رقم البطاقة الجمركية' || 
                              colHeader.includes('جمركية') || 
                              column.key === 'cardNumber' || 
                              column.key === 'card_number';
      if (isCardNumberCol) {
        cardNumberColIndices.push(colNum);
      }

      const isVinMatchingCol = colHeader === 'طابق رقم الهيكل' || 
                               colHeader === 'مطابقة الهيكل' || 
                               colHeader.includes('مطابقة') || 
                               column.key === 'vinMatching' || 
                               column.key === 'vin_matching';
      if (isVinMatchingCol) {
        vinMatchingColIndices.push(colNum);
      }
    }

    // Find status column index in header row
    let statusColIdx = -1;
    if (headerRow) {
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (
          val === 'الحالة' || 
          val === 'حالة' || 
          val.includes('status') || 
          val.includes('حالة المركبة') || 
          val.includes('حالة السيارة') || 
          val.includes('حالة المخزون')
        ) {
          statusColIdx = colNumber;
        }
      });
    }

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowIdx) return; // headers and titles already styled

      // Determine if it is a category header or separate group banner row (merged columns)
      let isSpecialRow = false;
      const firstCell = row.getCell(1);
      
      if (row.getCell(2).value === firstCell.value && row.getCell(3).value === firstCell.value) {
        isSpecialRow = true;
      }

      if (isSpecialRow) {
        // Special category/brand group row: Keep background custom color if any, otherwise light grey
        if (!skipRowHeights) {
          row.height = targetRowHeightPt;
        }
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (!cell.fill || (cell.fill as any).pattern === 'none') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF1F5F9' } // light slate grey
            };
          }
          cell.font = {
            name: 'Arial',
            size: fontSizePt + 0.5,
            bold: true,
            color: cell.font?.color || { argb: 'FF0F172A' }
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true,
            readingOrder: isRTL ? 'rtl' : 'ltr'
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        });
        return;
      }

      // Standard Data row height unified per user request (45px = 33.75pt or 60px = 45pt)
      if (!skipRowHeights) {
        row.height = targetRowHeightPt;
      }

      const isEven = rowNumber % 2 === 0;
      // Zebra alternating backgrounds: even gets white, odd gets #F7F7F7
      const defaultBg = isEven ? 'FFFFFFFF' : 'FFF7F7F7';

      // Determine row-level status based on status column or fallback scanning
      let rowStatus = '';
      if (statusColIdx !== -1) {
        rowStatus = String(row.getCell(statusColIdx).value || '').trim();
      } else {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const cellVal = String(cell.value || '').trim();
          if (
            cellVal.includes('مباع') || 
            cellVal.includes('sold') || 
            cellVal.includes('محجوز') || 
            cellVal.includes('reserved') || 
            cellVal.includes('غير معروض') || 
            cellVal.includes('not for sale') ||
            cellVal.includes('متوفر') ||
            cellVal.includes('متاح') ||
            cellVal.includes('available') ||
            cellVal.includes('بالساحة') ||
            cellVal.includes('موجود')
          ) {
            rowStatus = cellVal;
          }
        });
      }

      // Check if the row contains a mismatch (غير مطابق)
      let isMismatch = false;
      row.eachCell({ includeEmpty: false }, (cell) => {
        const cellVal = String(cell.value || '').trim();
        if (cellVal === 'غير مطابق' || cellVal.includes('غير مطابق')) {
          isMismatch = true;
        }
      });

      let rowBg = defaultBg;
      let rowTextColor = 'FF000000';
      let rowBold = false;

      // Map car statuses exactly 100% to application UI colors using central statusColors utility:
      if (isMismatch) {
        const mismatchInfo = getCarStatusColorInfo('غير مطابق', settings);
        rowBg = mismatchInfo.bgArgb;
        rowTextColor = mismatchInfo.textArgb;
        rowBold = true;
      } else if (rowStatus) {
        const statusInfo = getCarStatusColorInfo(rowStatus, settings);
        if (statusInfo.statusType !== 'default') {
          rowBg = statusInfo.bgArgb;
          rowTextColor = statusInfo.textArgb;
          rowBold = true;
        }
      }

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Calculate cell string visual length for autofitting column width
        let cellValStr = '';
        if (cell.value !== null && cell.value !== undefined) {
          if (cell.value instanceof Date) {
            cellValStr = cell.value.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US');
          } else if (typeof cell.value === 'object') {
            cellValStr = (cell.value as any).text || (cell.value as any).result || String(cell.value);
          } else {
            cellValStr = String(cell.value);
          }
        }

        const trimmedVal = cellValStr.trim();
        let visualLength = 0;
        for (let i = 0; i < trimmedVal.length; i++) {
          const code = trimmedVal.charCodeAt(i);
          if (code >= 0x0600 && code <= 0x06FF) {
            visualLength += 1.35; // Wider space multiplier for Arabic cursive characters
          } else {
            visualLength += 1.0;
          }
        }

        if (colNumber <= colLengths.length) {
          if (visualLength > colLengths[colNumber - 1]) {
            colLengths[colNumber - 1] = visualLength;
          }
        }

        // Apply legible, compact Arial font (default 11pt)
        cell.font = {
          name: 'Arial',
          size: fontSizePt,
          bold: rowBold,
          color: { argb: rowTextColor }
        };

        // Align numbers, status, color/model, codes, or dates to center, other Arabic texts to right
        const isIndexCol = colNumber === 1;
        const isNumberOrShort = /^[0-9./-]+$/.test(trimmedVal) || trimmedVal.length <= 10;
        const isCarColCell = carColIndices.includes(colNumber);
        const isStatusColCell = statusColIndices.includes(colNumber);
        const isRentalStatusColCell = rentalStatusColIndices.includes(colNumber);
        const isColorModelColCell = colorModelColIndices.includes(colNumber);

        const shouldCenter = isCarColCell || isIndexCol || isStatusColCell || isRentalStatusColCell || isColorModelColCell || isNumberOrShort;

        cell.alignment = {
          vertical: 'middle',
          horizontal: shouldCenter ? 'center' : (isRTL ? 'right' : 'left'),
          wrapText: true,
          readingOrder: isRTL ? 'rtl' : 'ltr'
        };

        // Thin border
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        // Final background and text color settings
        let cellBg = rowBg;
        let cellTextColor = rowTextColor;
        let cellBold = rowBold;

        // Custom Cell Formatting Rules:
        // 1. Rental column (حالة التجير):
        if (isRentalStatusColCell || rentalStatusColIndices.includes(colNumber)) {
          const rentalInfo = getCarRentalColorInfo(trimmedVal, settings);
          if (rentalInfo.isNotRented) {
            cellBg = rentalInfo.bgArgb;
            cellTextColor = rentalInfo.textArgb;
            cellBold = true;
          }
        }

        // 2. VIN matching column or cell value containing "غير مطابق"
        if (trimmedVal.includes('غير مطابق') || (vinMatchingColIndices.includes(colNumber) && trimmedVal.includes('غير'))) {
          const mismatchInfo = getCarStatusColorInfo('غير مطابق', settings);
          cellBg = mismatchInfo.bgArgb;
          cellTextColor = mismatchInfo.textArgb;
          cellBold = true;
        }

        // 3. Customs Card column (البطاقة الجمركية): number -> normal, text -> Orange (#EA580C)
        if (cardNumberColIndices.includes(colNumber)) {
          if (trimmedVal !== '' && trimmedVal !== '-' && isNaN(Number(trimmedVal.replace(/\s+/g, '')))) {
            cellBg = 'FFEA580C'; // Orange
            cellTextColor = 'FFFFFFFF';
            cellBold = true;
          }
        }

        // Preserve existing cell-level custom backgrounds (such as custom status or explicit fills)
        const existingFill = cell.fill as any;
        if (existingFill && existingFill.fgColor && existingFill.fgColor.argb && existingFill.fgColor.argb !== 'FFFFFFFF' && existingFill.fgColor.argb !== 'FFF7F7F7') {
          cellBg = existingFill.fgColor.argb;
          if (cell.font?.color?.argb) {
            cellTextColor = cell.font.color.argb;
          }
          cellBold = cell.font?.bold ?? true;
        }

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: cellBg }
        };

        cell.font = {
          name: 'Arial',
          size: fontSizePt,
          bold: cellBold,
          color: { argb: cellTextColor }
        };

        // Auto height is disabled per user request
      });
    });

    // 8. Set unified column widths with specific rules
    const totalCols = Math.max(worksheet.columns ? worksheet.columns.length : 0, worksheet.actualColumnCount, colCount, 1);
    
    let hasStatusCol = false;
    let hasRentalStatusCol = false;
    let hasColorModelCol = false;

    for (let colNum = 1; colNum <= totalCols; colNum++) {
      const column = worksheet.getColumn(colNum);
      const colHeader = column.header ? String(column.header).trim() : '';

      const isIndexCol = colNum === 1 || 
                         column.key === 'index' || 
                         colHeader === 'م' || 
                         colHeader === '#' || 
                         colHeader === 'الرقم' ||
                         colHeader === 'ت';

      const isStatusCol = colHeader === 'حالة السيارة' || 
                          colHeader === 'الحالة' || 
                          colHeader === 'حالة المركبة' || 
                          colHeader === 'الحالة والموقع' || 
                          column.key === 'status' || 
                          column.key === 'carStatus';

      const isRentalStatusCol = colHeader === 'حالة التجير' || 
                                colHeader === 'حالة التجهيز' || 
                                colHeader === 'التجهيز' || 
                                colHeader === 'حالة التأجير' || 
                                column.key === 'rental' || 
                                column.key === 'rentalStatus';

      const isColorModelCol = colHeader === 'اللون والموديل' || 
                              colHeader === 'اللون' || 
                              colHeader === 'اللون والمواصفات' || 
                              colHeader === 'الموديل واللون' || 
                              colHeader === 'الموديل' || 
                              colHeader === 'اللون الخارجي' || 
                              column.key === 'color' || 
                              column.key === 'colorModel' || 
                              column.key === 'color_model' || 
                              column.key === 'colorAndModel';

      const isCarCol = colHeader === 'السيارة' || 
                       colHeader === 'المركبة' || 
                       colHeader === 'نوع السيارة' || 
                       colHeader === 'ماركة السيارة' ||
                       colHeader === 'الماركة' ||
                       colHeader === 'الموديل' ||
                       colHeader === 'نوع المركبة' ||
                       colHeader.includes('سيارة') ||
                       colHeader.includes('السيارة') ||
                       colHeader.includes('المركبة') ||
                       column.key === 'car' || 
                       column.key === 'vehicle' || 
                       column.key === 'brand' || 
                       column.key === 'model' || 
                       column.key === 'carName';

      if (isStatusCol) hasStatusCol = true;
      if (isRentalStatusCol) hasRentalStatusCol = true;
      if (isColorModelCol) hasColorModelCol = true;

      if (isIndexCol) {
        // First column (م) fits sequence numbers only (roughly 6.43 characters)
        column.width = 6.43;
      } else if (isStatusCol || isRentalStatusCol) {
        // Status columns must be exactly 177 pixels (approx 24.25 characters in ExcelJS)
        column.width = 24.25;
      } else if (isColorModelCol) {
        // Color & Model columns must be exactly 250 pixels (approx 34.25 characters in ExcelJS)
        column.width = 34.25;
      } else if (isCarCol) {
        // Car/vehicle column must be exactly 325 pixels (44.5 characters in ExcelJS)
        column.width = 44.5;
      } else {
        // All other columns must be exactly 158 pixels
        // 158 pixels is approx 21.43 characters in ExcelJS
        column.width = 21.43;
      }
    }

    // 9. Force unified height of rows:
    // Every single row without exception respects the unified target height (45px = 33.75pt or 60px = 45pt)
    if (!skipRowHeights) {
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber === headerRowIdx) {
          row.height = headerHeightPt;
        } else if (rowNumber < headerRowIdx) {
          row.height = Math.max(26, targetRowHeightPt);
        } else {
          row.height = targetRowHeightPt;
        }
      });
    }
  }

  /**
   * Perfectly configure print setup for printing directly from Excel without overflows.
   */
  static configurePrintSetup(worksheet: ExcelJS.Worksheet, isLandscape?: boolean) {
    const colCount = worksheet.columns ? worksheet.columns.length : 10;
    const finalOrientation = isLandscape !== undefined 
      ? (isLandscape ? 'landscape' : 'portrait')
      : (colCount > 7 ? 'landscape' : 'portrait');

    worksheet.pageSetup = {
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      orientation: finalOrientation,
      paperSize: 9, // A4
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2
      }
    };
  }

  /**
   * Classic theme styling helper. Exists for backward compatibility but routes to formatWorksheet internally.
   */
  static applyThemeStyles(
    worksheet: ExcelJS.Worksheet,
    options: {
      isRTL: boolean;
      headerBgColor?: string;
      headerTextColor?: string;
    }
  ) {
    this.formatWorksheet(worksheet, { isRTL: options.isRTL });
  }

  /**
   * Classic auto fit helper. Exists for backward compatibility but routes to formatWorksheet internally.
   */
  static autoFitColumnsAndRows(
    worksheet: ExcelJS.Worksheet,
    options: {
      isRTL: boolean;
      minWidth?: number;
      maxWidth?: number;
    }
  ): { columnsWidths: { header: string; calculatedWidth: number; longestValue: string }[]; emptyRowsDetected: number; activeRowsExported: number } {
    this.formatWorksheet(worksheet, options);
    
    return {
      columnsWidths: (worksheet.columns || []).map((col: any) => ({
        header: col.header || col.key || 'بدون عنوان',
        calculatedWidth: col.width || 12,
        longestValue: ''
      })),
      emptyRowsDetected: 0,
      activeRowsExported: worksheet.rowCount - 1
    };
  }

  /**
   * Complete professional master wrapper to write workbook to disk and generate diagnostic telemetry.
   */
  static async finalizeAndSaveWorkbook(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet,
    fileName: string,
    isRTL: boolean,
    onFinishTelemetry?: (report: ExcelExportDiagnostics) => void,
    settings?: OrganizationSettings,
    formatOptions?: {
      rowHeightPx?: number;
      fontSizePt?: number;
      skipRowHeights?: boolean;
    }
  ): Promise<ExcelExportDiagnostics> {
    
    // Automatically apply the comprehensive styling and formatting
    this.formatWorksheet(worksheet, { 
      isRTL, 
      settings,
      rowHeightPx: formatOptions?.rowHeightPx,
      fontSizePt: formatOptions?.fontSizePt,
      skipRowHeights: formatOptions?.skipRowHeights
    });

    const diagnostics: ExcelExportDiagnostics = {
      columnsWidths: (worksheet.columns || []).map((col: any) => ({
        header: col.header || col.key || 'بدون عنوان',
        calculatedWidth: col.width || 12,
        longestValue: ''
      })),
      emptyRowsDetected: 0,
      activeRowsExported: worksheet.rowCount - 1,
      printOrientation: (worksheet.columns ? worksheet.columns.length : 10) > 7 ? 'landscape' : 'portrait'
    };

    if (onFinishTelemetry) {
      onFinishTelemetry(diagnostics);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);

    return diagnostics;
  }
}
