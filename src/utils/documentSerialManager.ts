/**
 * Centralized Document Serial Number Manager
 * Provides stable, progressive, auto-incrementing serial numbers for all document types.
 * Persists counters and associations to localStorage.
 */

export type DocType = 
  | 'exit_permit'       // إذن خروج
  | 'entry_permit'      // إذن دخول
  | 'transfer_letter'   // خطاب تحويل
  | 'checkpoint_letter' // خطاب نقاط التفتيش
  | 'withdrawal_letter' // خطاب سحب سيارة
  | 'carrier_letter';   // تفويض ناقل

const PREFIXES: Record<DocType, string> = {
  exit_permit: 'EXP',
  entry_permit: 'ENT',
  transfer_letter: 'TRF',
  checkpoint_letter: 'ISP',
  withdrawal_letter: 'WDL',
  carrier_letter: 'CAR',
};

const LABELS: Record<DocType, string> = {
  exit_permit: 'إذن خروج',
  entry_permit: 'إذن دخول',
  transfer_letter: 'خطاب تحويل',
  checkpoint_letter: 'خطاب نقاط التفتيش',
  withdrawal_letter: 'خطاب سحب سيارة',
  carrier_letter: 'تفويض ناقل',
};

/**
 * Gets or creates a sequential serial number for a specific document instance.
 * @param type The type of the document
 * @param entityId A unique identifier for the entity (e.g., car ID, VIN, or transfer ID)
 */
export function getDocumentSerial(type: DocType, entityId: string): string {
  if (!entityId) return 'AUTO-SEQ';

  // 1. Check if we already assigned a serial to this specific entityId + type combination
  const associationKey = `doc_serial_assoc_${type}_${entityId}`;
  const existingSerial = localStorage.getItem(associationKey);
  if (existingSerial) {
    return existingSerial;
  }

  // 2. Fetch or initialize the counters
  const countersKey = 'doc_serial_counters_v1';
  let counters: Record<DocType, number> = {
    exit_permit: 1000,
    entry_permit: 1000,
    transfer_letter: 1000,
    checkpoint_letter: 1000,
    withdrawal_letter: 1000,
    carrier_letter: 1000,
  };

  try {
    const saved = localStorage.getItem(countersKey);
    if (saved) {
      counters = { ...counters, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to parse doc serial counters:', e);
  }

  // 3. Increment and save the counter
  const prefix = PREFIXES[type] || 'DOC';
  const nextValue = (counters[type] || 1000) + 1;
  counters[type] = nextValue;

  try {
    localStorage.setItem(countersKey, JSON.stringify(counters));
  } catch (e) {
    console.error('Failed to save doc serial counters:', e);
  }

  // 4. Construct the beautiful formatted serial number
  // e.g. EXP-1001, TRF-1002
  const formattedSerial = `${prefix}-${nextValue}`;

  // 5. Save association to guarantee the same entity gets the same serial next time
  try {
    localStorage.setItem(associationKey, formattedSerial);
  } catch (e) {
    console.error('Failed to save doc serial association:', e);
  }

  return formattedSerial;
}

/**
 * Resets all document counters to initial values if needed by the system
 */
export function resetAllDocumentCounters(): void {
  const countersKey = 'doc_serial_counters_v1';
  const initial: Record<DocType, number> = {
    exit_permit: 1000,
    entry_permit: 1000,
    transfer_letter: 1000,
    checkpoint_letter: 1000,
    withdrawal_letter: 1000,
    carrier_letter: 1000,
  };
  localStorage.setItem(countersKey, JSON.stringify(initial));
}
