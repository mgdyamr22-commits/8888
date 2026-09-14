/**
 * Smart Multilingual Typo-Tolerant Search Engine
 * Specifically designed for Almakhzoun Pro (المخزون برو)
 */

import { Car } from '../../types';

// Arabic diacritics to strip
const AR_DIACRITICS_REGEX = /[\u064B-\u065F]/g;

// High-speed LRU-style Cache for Normalized Texts
const NORM_CACHE = new Map<string, string>();
const CLEAN_CACHE = new Map<string, string>();
const MAX_CACHE_SIZE = 5000;

// Standardize Arabic character variants
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  const str = text.toString();
  if (NORM_CACHE.has(str)) return NORM_CACHE.get(str)!;

  const result = str
    .toLowerCase()
    .replace(AR_DIACRITICS_REGEX, '') // Strip diacritics (Fatha, Damma, Kasra, Shadda, etc.)
    // Standardize Alef variations
    .replace(/[أإآٱ]/g, 'ا')
    // Standardize Teh Marbuta
    .replace(/ة/g, 'ه')
    // Standardize Alef Maksura & Yeh
    .replace(/[ىيى]/g, 'ي')
    // Standardize Hamza variations
    .replace(/[ؤئأـ]/g, '')
    // Normalize spaces and common separators
    .replace(/[\s\-_,\.\/#\\()]+/g, ' ')
    .trim();

  if (NORM_CACHE.size > MAX_CACHE_SIZE) {
    NORM_CACHE.clear();
  }
  NORM_CACHE.set(str, result);
  return result;
}

// Convert Arabic numerals to English numerals
export function convertArabicNumerals(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return text.split('').map(char => map[char] || char).join('');
}

// Global bilingual synonym dictionary for automotive terms
const AUTO_SYNONYMS: Record<string, string[]> = {
  'toyota': ['تويوتا', 'toyta', 'تويتا', 'هايلكس', 'كامري', 'كورولا', 'لاندكروزر'],
  'تويوتا': ['toyota', 'toyta', 'تويتا'],
  
  'nissan': ['نيسان', 'صني', 'باترول', 'التيما', 'بترول'],
  'نيسان': ['nissan', 'صني', 'باترول', 'التيما'],
  
  'hyundai': ['هيونداي', 'هيونداى', 'هونداي', 'النترا', 'سوناتا', 'اكسنت', 'توسان'],
  'هيونداي': ['hyundai', 'هيونداى', 'هونداي'],
  'هيونداى': ['hyundai', 'هيونداي', 'هونداي'],
  
  'kia': ['كيا', 'سبورتاج', 'سورينتو', 'سيراتو', 'اوبتيما', 'كادينزا'],
  'كيا': ['kia'],
  
  'ford': ['فورد', 'تورس', 'اكسبلورر'],
  'فورد': ['ford'],
  
  'chevrolet': ['شفروليه', 'شيفورليه', 'شيفروليه', 'تاهو', 'ماليبو'],
  'شفروليه': ['chevrolet', 'شيفروليه', 'تاهو'],
  'شيفروليه': ['chevrolet', 'شفروليه', 'تاهو'],
  'شيفورليه': ['chevrolet', 'شفروليه', 'تاهو'],
  
  'lexus': ['لكزس', 'لكسز'],
  'لكزس': ['lexus', 'لكسز'],
  
  'mercedes': ['مرسيدس', 'بنز', 'مرسيدس-بنز', 'مرسيدس بنز'],
  'مرسيدس': ['mercedes', 'بنز'],
  
  'bmw': ['بي ام دبليو', 'بي ام', 'بي أم', 'بي-ام'],
  'بي ام': ['bmw', 'بي ام دبليو'],
  'بي ام دبليو': ['bmw', 'بي ام'],
  
  'honda': ['هوندا', 'اكورد', 'سيفيك'],
  'هوندا': ['honda'],
  
  'mazda': ['مازدا', 'ماذدا'],
  'مازدا': ['mazda'],
  
  'changan': ['شانجان', 'شنجان'],
  'شانجان': ['changan'],
  
  'geely': ['جيلي', 'جيلى'],
  'جيلي': ['geely', 'جيلى'],
  
  'mg': ['ام جي', 'ام جى', 'إم جي'],
  'ام جي': ['mg', 'إم جي'],
  
  'jeep': ['جيب', 'جيبات'],
  'جيب': ['jeep'],

  'gmc': ['جمس', 'يوكن', 'يوكون', 'تاهو'],
  'جمس': ['gmc', 'يوكن', 'سييرا'],
  'يوكن': ['yukon', 'جمس', 'gmc'],

  // Status mapping
  'available': ['متاح', 'متوفر', 'جاهز', 'صالح', 'موجود', 'عرض'],
  'متاح': ['available', 'متوفر'],
  'متوفر': ['available', 'متاح'],
  'موجود': ['available', 'متاح'],
  
  'sold': ['مباع', 'مباعة', 'مباعه', 'تم البيع', 'بيع', 'صرف'],
  'مباع': ['sold', 'مباعه', 'مباعة'],
  'مباعة': ['sold', 'مباع'],
  'مباعه': ['sold', 'مباع'],
  'تم البيع': ['sold'],

  'reserved': ['محجوز', 'محجوزة', 'محجوزه', 'نشط', 'حجز'],
  'محجوز': ['reserved', 'محجوزة'],
  'محجوزة': ['reserved', 'محجوز'],
  'محجوزه': ['reserved', 'محجوز'],

  'rented': ['مجير', 'مؤجر', 'مأجر', 'تم التجير'],
  'مجير': ['rented', 'مؤجر'],
  'مؤجر': ['rented', 'مجير'],

  'direct': ['مباشر', 'شراء مباشر', 'تملك مباشر'],
  'partner': ['شريك', 'مشارك', 'مساهمة']
};

// Calculate Levenshtein distance for fuzzy typo support
export function calculateLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Determine if there is a fuzzy typography match
export function isFuzzyMatch(target: string, query: string, maxDistance: number = 1): boolean {
  const normTarget = normalizeArabicText(target);
  const normQuery = normalizeArabicText(query);

  // Prevent brand mixup between Honda and Hyundai
  const isHondaTarget = normTarget === 'هوندا' || normTarget === 'honda';
  const isHyundaiTarget = normTarget === 'هيونداي' || normTarget === 'هيونداى' || normTarget === 'هونداي' || normTarget === 'هونداى' || normTarget === 'hyundai';
  const isHondaQuery = normQuery === 'هوندا' || normQuery === 'honda';
  const isHyundaiQuery = normQuery === 'هيونداي' || normQuery === 'هيونداى' || normQuery === 'هونداي' || normQuery === 'هونداى' || normQuery === 'hyundai';

  if ((isHondaTarget && isHyundaiQuery) || (isHyundaiTarget && isHondaQuery)) {
    return false;
  }

  if (normTarget.includes(normQuery) || normQuery.includes(normTarget)) {
    if (isHondaQuery && isHyundaiTarget) return false;
    if (isHondaTarget && isHyundaiQuery) return false;
    return true;
  }

  // Segment targets by word for independent checking
  const targetWords = normTarget.split(' ').filter(Boolean);
  for (const targetWord of targetWords) {
    if (targetWord.length < 3 && normQuery.length < 3) {
      if (targetWord === normQuery) return true;
      continue;
    }

    // Dynamic threshold limit based on query word length
    const allowedDist = normQuery.length > 5 ? 2 : maxDistance;
    const distance = calculateLevenshteinDistance(targetWord, normQuery);
    if (distance <= allowedDist) {
      return true;
    }
  }

  return false;
}

/**
 * Helper to clean and strip identifiers (VIN, Card Number, Plate Number, National ID, Phone)
 * of any spacing, dashes, slashes, or non-alphanumeric/non-Arabic characters to support seamless matching.
 */
export function cleanIdentifier(text: string): string {
  if (!text) return '';
  const str = text.toString();
  if (CLEAN_CACHE.has(str)) return CLEAN_CACHE.get(str)!;

  // Convert Arabic numerals to English first
  const withEngNumerals = convertArabicNumerals(str.toLowerCase());
  // Normalize Arabic letters
  const normArabic = normalizeArabicText(withEngNumerals);
  // Remove any remaining punctuation, dashes, spaces, slashes
  const result = normArabic.replace(/[^a-z0-9\u0621-\u064A]/g, '');

  if (CLEAN_CACHE.size > MAX_CACHE_SIZE) {
    CLEAN_CACHE.clear();
  }
  CLEAN_CACHE.set(str, result);
  return result;
}

/**
 * Helper to extract purely alphanumeric characters (English letters and digits).
 * Converts Arabic digits to English digits first and strips all spaces, Arabic characters, and symbols.
 */
export function extractPureAlphanumeric(text: string): string {
  if (!text) return '';
  const withEng = convertArabicNumerals(text.toString().toLowerCase());
  return withEng.replace(/[^a-z0-9]/g, '');
}

// Common Arabic/English search label words to ignore when multi-word search queries are provided
const SEARCH_LABEL_WORDS = new Set([
  'شاصيه', 'شاصي', 'شاسيه', 'شاسية', 'الشاصيه', 'الشاصي', 'هيكل', 'الهيكل', 
  'رقم', 'الرقم', 'بطاقة', 'البطاقة', 'بطاقه', 'البطاقه', 'لوحة', 'اللوحة', 
  'لوحه', 'اللوحه', 'سيارة', 'سيارات', 'مركبة', 'مركبات', 'موديل', 'الموديل', 
  'ماركة', 'الماركة', 'vin', 'card', 'plate', 'vins'
]);

/**
 * Intelligent Matcher for Vehicles / Cars
 */
export function isCarMatchingQuery(car: Car, searchQuery: string): boolean {
  if (!car) return false;
  if (!searchQuery || !searchQuery.trim()) return true;

  // Unify numerals and convert to lowercase
  const rawQuery = searchQuery.trim().toLowerCase();
  const unifiedQuery = convertArabicNumerals(rawQuery);

  // Extract pure alphanumeric query (e.g. VIN / Card / Plate digits or English codes)
  const pureQuery = extractPureAlphanumeric(unifiedQuery);

  // Get car identifiers
  const carVinRaw = car.vin || (car as any).chassisNumber || (car as any).chassis || car.customData?.vin || '';
  const carCardRaw = car.cardNumber || '';
  const carPlateRaw = car.plateData?.plateNumber || car.customData?.plateNumber || '';

  const pureCarVin = extractPureAlphanumeric(carVinRaw);
  const pureCarCard = extractPureAlphanumeric(carCardRaw);
  const pureCarPlate = extractPureAlphanumeric(carPlateRaw);

  // High-priority direct VIN / Card / Plate substring match
  if (pureQuery.length >= 2) {
    const isVinMatch = pureCarVin && pureCarVin.includes(pureQuery);
    const isCardMatch = pureCarCard && pureCarCard.includes(pureQuery);
    const isPlateMatch = pureCarPlate && pureCarPlate.includes(pureQuery);

    if (isVinMatch || isCardMatch || isPlateMatch) {
      return true;
    }

    // If search term is pure alphanumeric/digits (like VIN chassis number e.g. "3180896")
    if (/^[a-z0-9]+$/i.test(unifiedQuery) && pureQuery.length >= 3) {
      return false;
    }
  }

  const normalizedQuery = normalizeArabicText(unifiedQuery);
  const rawQueryWords = normalizedQuery.split(/\s+/).filter(Boolean);

  if (rawQueryWords.length === 0) return true;

  // If there are multiple words, filter out label prefix words like "شاصيه", "رقم", "هيكل", "vin"
  let queryWords = rawQueryWords;
  if (rawQueryWords.length > 1) {
    const filteredWords = rawQueryWords.filter(w => !SEARCH_LABEL_WORDS.has(w) && !SEARCH_LABEL_WORDS.has(cleanIdentifier(w)));
    if (filteredWords.length > 0) {
      queryWords = filteredWords;
    }
  }

  // Pre-generate a unified search context combining all key fields.
  const fieldsToCombine = [
    car.brand,
    car.model,
    car.year,
    car.color,
    carVinRaw,
    carCardRaw,
    car.supplier,
    car.notes,
    car.carRemark,
    car.ownershipType,
    (car as any).seller,
    carPlateRaw,
    car.status,
    car.rentalStatus,
    car.price,
    car.costPrice
  ];

  const processedStringParts: string[] = [];
  fieldsToCombine.forEach(field => {
    if (field === undefined || field === null) return;
    const fs = field.toString().toLowerCase();
    processedStringParts.push(normalizeArabicText(fs));
    processedStringParts.push(fs.replace(/[^a-z0-9\u0621-\u064A]/g, ''));
  });

  const carSearchContext = processedStringParts.join(' ');

  // Match ALL query words (Intersection: commutative match)
  return queryWords.every(queryWord => {
    // 0. High-priority exact/partial identifier match (VIN, Card Number, Plate Number)
    const cleanQueryWord = cleanIdentifier(queryWord);
    if (cleanQueryWord) {
      const cleanCarVin = cleanIdentifier(carVinRaw);
      const cleanCarCard = cleanIdentifier(carCardRaw);
      const cleanCarPlate = cleanIdentifier(carPlateRaw);

      if (cleanCarVin && cleanCarVin.includes(cleanQueryWord)) return true;
      if (cleanCarCard && cleanCarCard.includes(cleanQueryWord)) return true;
      if (cleanCarPlate && cleanCarPlate.includes(cleanQueryWord)) return true;
    }

    // Pure alphanumeric match for this query word
    const pureWord = extractPureAlphanumeric(queryWord);
    if (pureWord.length >= 3) {
      if (pureCarVin && pureCarVin.includes(pureWord)) return true;
      if (pureCarCard && pureCarCard.includes(pureWord)) return true;
      if (pureCarPlate && pureCarPlate.includes(pureWord)) return true;
    }

    // 1. Direct match on the unified context
    if (carSearchContext.includes(queryWord)) return true;
    if (cleanQueryWord && carSearchContext.includes(cleanQueryWord)) return true;

    // 2. Expand query word with synonyms / translations
    const synonyms: string[] = [];
    Object.entries(AUTO_SYNONYMS).forEach(([key, values]) => {
      const normKey = normalizeArabicText(key);

      // Prevent Honda vs Hyundai brand synonym crossover
      const isHondaQuery = queryWord === 'هوندا' || queryWord === 'honda';
      const isHyundaiQuery = queryWord === 'هيونداي' || queryWord === 'هيونداى' || queryWord === 'هونداي' || queryWord === 'hyundai';
      const isHondaKey = key === 'هوندا' || key === 'honda';
      const isHyundaiKey = key === 'هيونداي' || key === 'هيونداى' || key === 'هونداي' || key === 'hyundai';

      if ((isHondaQuery && isHyundaiKey) || (isHyundaiQuery && isHondaKey)) {
        return;
      }

      if (normKey === queryWord || (normKey.includes(queryWord) && !(isHondaQuery && normKey === 'هونداي'))) {
        synonyms.push(...values.map(normalizeArabicText));
      }
    });

    if (synonyms.length > 0) {
      const synonymMatch = synonyms.some(syn => carSearchContext.includes(syn));
      if (synonymMatch) return true;
    }

    // 3. Fuzzy string matching as last resort
    const targetWords = carSearchContext.split(/\s+/).filter(Boolean);
    const fuzzyMatch = targetWords.some(tWord => isFuzzyMatch(tWord, queryWord));
    if (fuzzyMatch) return true;

    return false;
  });
}

export interface ScoredCarResult {
  car: Car;
  score: number;
  matchedField: 'vin' | 'cardNumber' | 'plateNumber' | 'nameStarts' | 'nameContains' | 'other';
}

/**
 * Executes a unified smart query filtering on the cars database.
 * If there is an exact or partial VIN / Card Number match, it prioritizes matching vehicles.
 */
export function getUnifiedScoredSearchResults(cars: Car[], searchQuery: string): ScoredCarResult[] {
  if (!searchQuery || !searchQuery.trim()) return [];

  const rawQuery = searchQuery.trim().toLowerCase();
  const unifiedQuery = convertArabicNumerals(rawQuery);
  const normalizedQuery = normalizeArabicText(unifiedQuery);
  const cleanQuery = cleanIdentifier(rawQuery);
  const pureQuery = extractPureAlphanumeric(rawQuery);

  // 1. Check for Direct VIN Matches first
  if (pureQuery.length >= 2 || cleanQuery.length >= 2) {
    const vinMatchedCars = cars.filter(car => {
      const carVin = car.vin || (car as any).chassisNumber || (car as any).chassis || car.customData?.vin || '';
      const cleanCarVin = cleanIdentifier(carVin);
      const pureCarVin = extractPureAlphanumeric(carVin);
      
      if (cleanQuery && cleanCarVin.includes(cleanQuery)) return true;
      if (pureQuery && pureCarVin.includes(pureQuery)) return true;
      return false;
    });

    if (vinMatchedCars.length > 0) {
      // If query is pure alphanumeric/digits or VIN match found, return ONLY those matching vehicles
      return vinMatchedCars.map(car => ({
        car,
        score: 100,
        matchedField: 'vin' as const
      }));
    }
  }

  // 2. Check for Exact Card Number Match (95% score)
  if (cleanQuery || pureQuery) {
    const exactCardMatches = cars.filter(car => {
      const cleanCard = cleanIdentifier(car.cardNumber);
      const pureCard = extractPureAlphanumeric(car.cardNumber);
      return (cleanQuery && cleanCard === cleanQuery) || (pureQuery && pureCard === pureQuery);
    });

    if (exactCardMatches.length > 0) {
      return exactCardMatches.map(car => ({
        car,
        score: 95,
        matchedField: 'cardNumber' as const
      }));
    }
  }

  const scoredResults: ScoredCarResult[] = [];

  // If no exact VIN/Card matches, check other criteria
  cars.forEach(car => {
    // 3. Exact Plate Number match (90%)
    const cleanPlate = cleanIdentifier(car.plateData?.plateNumber || car.customData?.plateNumber || '');
    if (cleanQuery && cleanPlate === cleanQuery) {
      scoredResults.push({
        car,
        score: 90,
        matchedField: 'plateNumber' as const
      });
      return;
    }

    // Combine brand + model for name matching
    const fullName = `${car.brand} ${car.model}`.toLowerCase();
    const normName = normalizeArabicText(fullName);

    // 4. Starts with Name (80%)
    if (normName.startsWith(normalizedQuery)) {
      scoredResults.push({
        car,
        score: 80,
        matchedField: 'nameStarts' as const
      });
      return;
    }

    // 5. Contains Name (70%)
    if (normName.includes(normalizedQuery)) {
      scoredResults.push({
        car,
        score: 70,
        matchedField: 'nameContains' as const
      });
      return;
    }

    // 6. Loose match (using our isCarMatchingQuery algorithm as a fallback with score of 60%)
    if (isCarMatchingQuery(car, searchQuery)) {
      scoredResults.push({
        car,
        score: 60,
        matchedField: 'other' as const
      });
    }
  });

  // Sort by score descending
  return scoredResults.sort((a, b) => b.score - a.score);
}

/**
 * Helper to execute unified search and return a flat list of cars
 */
export function getUnifiedSearchResults(cars: Car[], searchQuery: string): Car[] {
  if (!searchQuery || !searchQuery.trim()) return cars;
  const scored = getUnifiedScoredSearchResults(cars, searchQuery);
  return scored.map(r => r.car);
}

/**
 * Intelligent Matcher for general text lookup
 */
export function isGeneralMatchingQuery(targetText: string, searchQuery: string): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;

  const unifiedQuery = convertArabicNumerals(searchQuery.trim().toLowerCase());
  const normalizedQuery = normalizeArabicText(unifiedQuery);
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

  if (queryWords.length === 0) return true;

  const normalizedTarget = normalizeArabicText(targetText);
  const cleanTarget = cleanIdentifier(targetText);

  return queryWords.every(queryWord => {
    // 1. Direct match on targets
    if (normalizedTarget.includes(queryWord)) return true;

    // 2. Exact match on cleaned identifier (helps with dashed IDs/phones/names)
    const cleanQueryWord = cleanIdentifier(queryWord);
    if (cleanQueryWord && cleanTarget && cleanTarget.includes(cleanQueryWord)) {
      return true;
    }

    // 3. Check fuzzy match
    if (isFuzzyMatch(normalizedTarget, queryWord)) return true;

    return false;
  });
}
