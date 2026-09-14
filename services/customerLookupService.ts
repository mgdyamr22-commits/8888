import { Car } from '../types';

export interface CustomerLookupResult {
  phone?: string;
  name?: string;
  nationality?: string;
}

/**
 * Automatically searches for a customer by nationalId/CR number across local storage records 
 * and existing cars sales history.
 */
export function lookupCustomerById(idNumber: string, cars?: Car[]): CustomerLookupResult | null {
  const cleanId = (idNumber || '').trim();
  if (!cleanId || cleanId.length < 3) return null;

  // 1. Search in LocalStorage customer stores
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.toLowerCase().includes('customer')) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed)) {
              const matched = parsed.find((c: any) => c && c.nationalId && c.nationalId.trim() === cleanId);
              if (matched) {
                return {
                  phone: matched.phone?.trim() || undefined,
                  name: matched.name?.trim() || undefined,
                };
              }
            }
          } catch (e) {
            // ignore JSON parse errors for encrypted/non-JSON storage items
          }
        }
      }
    }
  } catch (err) {
    console.error('Error querying customers storage:', err);
  }

  // 2. Search in cars history
  if (cars && Array.isArray(cars)) {
    for (const car of cars) {
      if (car.exitData) {
        if (car.exitData.receiverId && car.exitData.receiverId.trim() === cleanId) {
          if (car.exitData.receiverPhone || car.exitData.receiverName) {
            return {
              phone: car.exitData.receiverPhone?.trim() || undefined,
              name: car.exitData.receiverName?.trim() || undefined,
              nationality: car.exitData.nationality?.trim() || undefined,
            };
          }
        }
      }
      if (car.customData) {
        if (car.customData.representativeId && car.customData.representativeId.trim() === cleanId) {
          if (car.customData.representativePhone || car.customData.representativeName) {
            return {
              phone: car.customData.representativePhone?.trim() || undefined,
              name: car.customData.representativeName?.trim() || undefined,
            };
          }
        }
      }
    }
  }

  return null;
}
