import { Car, MovementEvent, CarStatus } from '../types';

export interface DetailedCar {
  id: string;
  brand: string;
  model: string;
  name: string;
  vin: string;
  seller?: string;
  notes?: string;
  isTransfer?: boolean;
  transferNo?: string;
  transferSender?: string;
  transferReceiver?: string;
  movementType?: 'sale' | 'transfer' | 'general';
}

function parseDatePart(val: string | null | undefined): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s) return '';
  if (s.includes('T')) return s.split('T')[0];
  if (s.includes(' ')) return s.split(' ')[0];
  return s;
}

export function isCarExited(car: Car): boolean {
  if (!car) return false;
  // A car is ONLY exited if explicitly outbound, sold, or currently in transfer process (outbound transfer)
  if (car.isOutbound) return true;
  const statusStr = String(car.status || '');
  if (
    car.status === CarStatus.SOLD || 
    statusStr === 'مباع' || 
    statusStr === 'مباعة' ||
    car.status === CarStatus.IN_TRANSFER ||
    statusStr === 'in_transfer' ||
    statusStr === 'في التحويل' ||
    statusStr === 'تحويل صادر'
  ) {
    return true;
  }
  return false;
}

export function isCarNotArrived(car: Car): boolean {
  if (!car) return false;
  if (isCarExited(car)) return false;
  if (car.isPresentInShowroom === false) return true;
  const statusStr = String(car.status || '');
  return (
    car.status === CarStatus.NOT_ARRIVED ||
    car.status === CarStatus.NOT_ARRIVED_SHOWROOM ||
    statusStr === 'لم تصل المعرض' ||
    statusStr === 'لم تصل بعد' ||
    statusStr === 'غير واصل'
  );
}

export function getCarExitDate(car: Car): string {
  if (!isCarExited(car)) return '';
  return parseDatePart(car.exitData?.exitDate || car.transferDate);
}

export function getCarEntryDate(car: Car): string {
  return parseDatePart(car.entryDate || (!car.isOutbound ? car.transferDate : undefined));
}

function checkIsTransfer(car?: Car, m?: MovementEvent): { isTransfer: boolean; transferNo?: string; transferSender?: string; transferReceiver?: string } {
  const statusStr = String(car?.status || '');
  const notesStr = (car?.exitData?.notes || '') + ' ' + (car?.notes || '') + ' ' + (car?.carRemark || '');
  const isTr = Boolean(
    car?.transferNo ||
    car?.transferDate ||
    (car as any)?.isTransfer ||
    (m as any)?.isTransfer ||
    statusStr === 'in_transfer' ||
    statusStr === 'transferred' ||
    statusStr === 'محولة' ||
    statusStr === 'تحويل' ||
    statusStr === 'في التحويل' ||
    statusStr === 'قيد التحويل' ||
    car?.exitData?.deliveryType === 'TRANSPORT' ||
    String(car?.exitData?.deliveryType) === 'تحويل صادر' ||
    car?.exitData?.saleType === 'تحويل' ||
    m?.saleType === 'تحويل' ||
    m?.deliveryType === 'تحويل صادر' ||
    m?.deliveryType === 'TRANSPORT' ||
    notesStr.includes('تحويل') ||
    notesStr.includes('التحويل')
  );

  const transferNo = car?.transferNo || (m && (m as any).transportCompany?.startsWith('TR-') ? (m as any).transportCompany : undefined) || (car?.exitData?.transportCompany?.startsWith('TR-') ? car.exitData.transportCompany : undefined) || (notesStr.match(/TR-\d+-\d+/)?.[0]);
  const transferSender = car?.transferSender || car?.exitData?.receiverName || car?.exitData?.seller || m?.seller;
  const transferReceiver = car?.transferReceiver || car?.exitData?.receiverName || m?.receiverName;

  return { isTransfer: isTr, transferNo, transferSender, transferReceiver };
}

export interface DailyInventorySummary {
  date: string;
  openingBalance: number;
  enteredCount: number;
  exitedCount: number;
  closingBalance: number;
  status: 'growth' | 'stable' | 'decline';
  lastUpdated: string;
  enteredCars: DetailedCar[];
  exitedCars: DetailedCar[];
}

export class OpeningBalanceManager {
  /**
   * Calculates the opening balance of vehicles in stock at the start of a given date day.
   * Defined as vehicles that entered strictly before dateStr, and have either not exited yet or exited on/after dateStr.
   */
  static calculate(cars: Car[], dateStr: string, movementHistory?: MovementEvent[]): number {
    return cars.filter(car => {
      if (isCarNotArrived(car)) return false;

      const entry = getCarEntryDate(car);
      if (entry && entry >= dateStr) return false;

      if (!isCarExited(car)) {
        return true;
      }

      const exitDateVal = getCarExitDate(car);
      if (!exitDateVal) {
        return true;
      }

      return exitDateVal >= dateStr;
    }).length;
  }
}

export class ClosingBalanceManager {
  /**
   * Calculates closing balance using structural formula: Opening + Entered - Exited
   */
  static calculate(opening: number, entered: number, exited: number): number {
    return opening + entered - exited;
  }
}

export class VehicleMovementCounter {
  /**
   * Returns the count of vehicles entered on a specific date
   */
  static getEnteredToday(cars: Car[], dateStr: string, movementHistory?: MovementEvent[]): number {
    return this.getEnteredCars(cars, dateStr, movementHistory).length;
  }

  /**
   * Returns the count of vehicles exited/sold on a specific date
   */
  static getExitedToday(cars: Car[], dateStr: string, movementHistory?: MovementEvent[]): number {
    return this.getExitedCars(cars, dateStr, movementHistory).length;
  }

  /**
   * Returns the list of detailed vehicle objects that entered on a specific date
   */
  static getEnteredCars(cars: Car[], dateStr: string, movementHistory?: MovementEvent[]): DetailedCar[] {
    if (movementHistory && movementHistory.length > 0) {
      const historyMatches = movementHistory
        .filter(m => m.type === 'IN' && parseDatePart(m.timestamp) === dateStr)
        .map(m => {
          const fullCar = cars.find(c => c.id === m.carId || c.vin === m.vin);
          const trInfo = checkIsTransfer(fullCar, m);
          return {
            id: m.carId,
            brand: m.brand,
            model: m.model,
            name: `${m.brand} ${m.model}`,
            vin: m.vin,
            notes: m.notes || (trInfo.isTransfer ? `تحويل وارد ${trInfo.transferNo ? `(خطاب ${trInfo.transferNo})` : ''}` : ''),
            isTransfer: trInfo.isTransfer,
            transferNo: trInfo.transferNo,
            transferSender: trInfo.transferSender,
            transferReceiver: trInfo.transferReceiver,
            movementType: (trInfo.isTransfer ? 'transfer' : 'general') as 'transfer' | 'sale' | 'general',
          };
        });
      if (historyMatches.length > 0) return historyMatches;
    }
    return cars
      .filter(car => {
        if (isCarNotArrived(car)) return false;
        const entry = getCarEntryDate(car);
        return entry === dateStr;
      })
      .map(car => {
        const trInfo = checkIsTransfer(car);
        return {
          id: car.id,
          brand: car.brand,
          model: car.model,
          name: `${car.brand} ${car.model}`,
          vin: car.vin,
          notes: car.notes || (trInfo.isTransfer ? `تحويل وارد ${trInfo.transferNo ? `(خطاب ${trInfo.transferNo})` : ''}` : ''),
          isTransfer: trInfo.isTransfer,
          transferNo: trInfo.transferNo,
          transferSender: trInfo.transferSender,
          transferReceiver: trInfo.transferReceiver,
          movementType: (trInfo.isTransfer ? 'transfer' : 'general') as 'transfer' | 'sale' | 'general',
        };
      });
  }

  /**
   * Returns the list of detailed vehicle objects that exited/sold on a specific date
   */
  static getExitedCars(cars: Car[], dateStr: string, movementHistory?: MovementEvent[]): DetailedCar[] {
    if (movementHistory && movementHistory.length > 0) {
      const historyMatches = movementHistory
        .filter(m => m.type === 'OUT' && parseDatePart(m.timestamp) === dateStr)
        .map(m => {
          const fullCar = cars.find(c => c.id === m.carId || c.vin === m.vin);
          const trInfo = checkIsTransfer(fullCar, m);
          const defaultSeller = trInfo.isTransfer ? (trInfo.transferSender || 'تحويل صادر') : (m.seller || 'غير محدد');
          const defaultNotes = m.notesExit || m.notes || (trInfo.isTransfer ? `تحويل صادر بخطاب (${trInfo.transferNo || 'رسمي'})` : '');
          return {
            id: m.carId,
            brand: m.brand,
            model: m.model,
            name: `${m.brand} ${m.model}`,
            vin: m.vin,
            seller: defaultSeller,
            notes: defaultNotes,
            isTransfer: trInfo.isTransfer,
            transferNo: trInfo.transferNo,
            transferSender: trInfo.transferSender,
            transferReceiver: trInfo.transferReceiver,
            movementType: (trInfo.isTransfer ? 'transfer' : 'sale') as 'transfer' | 'sale' | 'general',
          };
        });
      if (historyMatches.length > 0) return historyMatches;
    }
    return cars
      .filter(car => {
        if (!isCarExited(car)) return false;
        const exitDateVal = getCarExitDate(car);
        return exitDateVal === dateStr;
      })
      .map(car => {
        const trInfo = checkIsTransfer(car);
        const defaultSeller = trInfo.isTransfer ? (car.transferSender || car.exitData?.seller || 'تحويل صادر') : (car.exitData?.seller || car.seller || 'غير محدد');
        const defaultNotes = car.exitData?.notes || car.notes || (trInfo.isTransfer ? `تحويل بخطاب (${trInfo.transferNo || 'رسمي'})` : '');
        return {
          id: car.id,
          brand: car.brand,
          model: car.model,
          name: `${car.brand} ${car.model}`,
          vin: car.vin,
          seller: defaultSeller,
          notes: defaultNotes,
          isTransfer: trInfo.isTransfer,
          transferNo: trInfo.transferNo,
          transferSender: trInfo.transferSender,
          transferReceiver: trInfo.transferReceiver,
          movementType: (trInfo.isTransfer ? 'transfer' : 'sale') as 'transfer' | 'sale' | 'general',
        };
      });
  }
}

export class DailyAutoCalculator {
  /**
   * Calculates a full summary for a given day
   */
  static calculateForDate(cars: Car[], dateStr: string, movementHistory?: MovementEvent[]): DailyInventorySummary {
    const openingBalance = OpeningBalanceManager.calculate(cars, dateStr, movementHistory);
    const enteredCount = VehicleMovementCounter.getEnteredToday(cars, dateStr, movementHistory);
    const exitedCount = VehicleMovementCounter.getExitedToday(cars, dateStr, movementHistory);
    const closingBalance = ClosingBalanceManager.calculate(openingBalance, enteredCount, exitedCount);

    const enteredCars = VehicleMovementCounter.getEnteredCars(cars, dateStr, movementHistory);
    const exitedCars = VehicleMovementCounter.getExitedCars(cars, dateStr, movementHistory);

    let status: 'growth' | 'stable' | 'decline' = 'stable';
    if (enteredCount > exitedCount) {
      status = 'growth';
    } else if (enteredCount < exitedCount) {
      status = 'decline';
    }

    return {
      date: dateStr,
      openingBalance,
      enteredCount,
      exitedCount,
      closingBalance,
      status,
      lastUpdated: new Date().toISOString(),
      enteredCars,
      exitedCars
    };
  }

  /**
   * Generates a timeline of day-by-day summaries
   */
  static generateHistory(cars: Car[], limitDays: number = 30, movementHistory?: MovementEvent[]): DailyInventorySummary[] {
    const dates = new Set<string>();

    if (movementHistory && movementHistory.length > 0) {
      movementHistory.forEach(m => {
        if (m.timestamp) {
          dates.add(m.timestamp.split('T')[0]);
        }
      });
    } else {
      cars.forEach(car => {
        if (car.entryDate) {
          dates.add(car.entryDate.split('T')[0]);
        }
        if (car.exitData?.exitDate) {
          dates.add(car.exitData.exitDate.split('T')[0]);
        }
      });
    }

    // Ensure today is included
    const todayStr = new Date().toISOString().split('T')[0];
    dates.add(todayStr);

    // Sort descending (newest first)
    const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
    const selectedDates = sortedDates.slice(0, limitDays);

    return selectedDates.map(date => this.calculateForDate(cars, date, movementHistory));
  }
}
