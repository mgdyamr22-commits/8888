import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Car as CarIcon, 
  ShieldCheck, 
  Zap, 
  Percent, 
  Lightbulb, 
  PlusCircle, 
  MinusCircle, 
  Warehouse, 
  Award, 
  Users, 
  FileText, 
  Building2, 
  Search, 
  AlertCircle,
  Clock,
  ArrowUpRight,
  PiggyBank,
  CheckCircle,
  Maximize2,
  ChevronLeft,
  Printer,
  ChevronDown,
  Activity,
  DollarSign,
  User,
  MapPin,
  Flame,
  LineChart as LineChartIcon,
  Calendar,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ShoppingBag,
  ArrowDownRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  CartesianGrid, 
  XAxis, 
  YAxis,
  LineChart,
  Line
} from 'recharts';
import { Car, CarStatus, OwnershipType, formatVehicleDisplay } from '../types';

interface AnalyticsTabsProps {
  analyticsSubTab: string;
  analyticsData: any;
  showroomTarget: number;
  setShowroomTarget: (val: number) => void;
  salesTarget: number;
  setSalesTarget: (val: number) => void;
  canViewFinancials: boolean;
  stagnantLimitDays: number;
  setStagnantLimitDays: (val: number) => void;
  analyticsBrandSort: 'high-to-low' | 'low-to-high' | 'exits' | 'inventory' | 'profitability';
  setAnalyticsBrandSort: (val: any) => void;
  analyticsModelSort: 'alpha' | 'available-desc' | 'sold-desc' | 'stay-desc';
  setAnalyticsModelSort: (val: any) => void;
  analyticsSupplierSort: 'supplied-desc' | 'supplied-asc' | 'sold-desc' | 'profit-desc';
  setAnalyticsSupplierSort: (val: any) => void;
  analyticsSearchQuery: string;
  setAnalyticsSearchQuery: (val: string) => void;
  drillDownBrand: string | null;
  setDrillDownBrand: (val: string | null) => void;
  drillDownSupplier: string | null;
  setDrillDownSupplier: (val: string | null) => void;
  brandChartType: 'bar' | 'pie' | 'trend';
  setBrandChartType: (val: any) => void;
  cars: Car[];
  vehicleCosts?: any[];
}

export const AnalyticsTabs: React.FC<AnalyticsTabsProps> = ({
  canViewFinancials,
  cars,
  vehicleCosts = [],
  stagnantLimitDays,
  setStagnantLimitDays
}) => {
  // Global colors for chart entities
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#3b82f6', '#f43f5e', '#06b6d4'];

  // State hooks for top-level general filters inside the dashboard
  const [localStartDate, setLocalStartDate] = useState<string>(() => {
    // Default to start of current year to catch all relevant transaction data
    const yr = new Date().getFullYear();
    return `${yr}-01-01`;
  });
  const [localEndDate, setLocalEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [localBrand, setLocalBrand] = useState<string>('all');
  const [localModel, setLocalModel] = useState<string>('all');
  const [localSupplier, setLocalSupplier] = useState<string>('all');
  const [localBranch, setLocalBranch] = useState<string>('all');
  const [localDelegate, setLocalDelegate] = useState<string>('all');

  // Stagnation limit fallback
  const finalStagnantLimitDays = stagnantLimitDays || 60;

  // 1. Dynamic dropdown selection lists populated from the actual cars dataset
  const dynamicBrands = useMemo(() => {
    return Array.from(new Set(cars.map(c => c.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [cars]);

  const dynamicModels = useMemo(() => {
    const subset = localBrand !== 'all' ? cars.filter(c => c.brand === localBrand) : cars;
    return Array.from(new Set(subset.map(c => c.model).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [cars, localBrand]);

  const dynamicSuppliers = useMemo(() => {
    return Array.from(new Set(cars.map(c => c.supplier).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [cars]);

  const dynamicBranches = useMemo(() => {
    return Array.from(new Set(cars.map(c => c.customData?.branch || 'الفرع الرئيسي').map(b => b.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'ar'));
  }, [cars]);

  const dynamicDelegates = useMemo(() => {
    return Array.from(new Set(cars.map(c => c.exitData?.seller || c.exitData?.representativeName || c.seller || 'غير محدد').map(d => d.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'ar'));
  }, [cars]);

  // RESET FILTERS ACTION
  const handleResetFilters = () => {
    const yr = new Date().getFullYear();
    setLocalStartDate(`${yr}-01-01`);
    setLocalEndDate(new Date().toISOString().split('T')[0]);
    setLocalBrand('all');
    setLocalModel('all');
    setLocalSupplier('all');
    setLocalBranch('all');
    setLocalDelegate('all');
  };

  // 2. HELPER TO MATCH ACTUAL VIN COST DYNAMICALLY
  const getVehicleCost = (car: Car) => {
    const costRec = (vehicleCosts || []).find(vc => vc.vin.toLowerCase() === car.vin.toLowerCase());
    return costRec ? costRec.totalCost : (Number(car.costPrice) || (Number(car.price) > 0 ? Number(car.price) * 0.85 : 0) || 0);
  };

  // 3. MASTER CHRONOLOGICAL DATA FILTERING
  const filteredCars = useMemo(() => {
    return cars.filter(car => {
      // Date filter checks entry dates for inventory and exit dates for sales
      const entryDateObj = car.entryDate ? new Date(car.entryDate.split('T')[0]) : null;
      const exitDateObj = (car.isOutbound && car.exitData?.exitDate) ? new Date(car.exitData.exitDate.split('T')[0]) : null;

      if (localStartDate) {
        const start = new Date(localStartDate);
        if (car.isOutbound) {
          if (exitDateObj && exitDateObj < start) return false;
        } else {
          if (entryDateObj && entryDateObj < start) return false;
        }
      }

      if (localEndDate) {
        const end = new Date(localEndDate);
        if (car.isOutbound) {
          if (exitDateObj && exitDateObj > end) return false;
        } else {
          if (entryDateObj && entryDateObj > end) return false;
        }
      }

      // Brand Filter
      if (localBrand !== 'all' && car.brand !== localBrand) return false;

      // Model Filter
      if (localModel !== 'all' && car.model !== localModel) return false;

      // Supplier Filter
      if (localSupplier !== 'all' && car.supplier !== localSupplier) return false;

      // Branch Filter
      const bRaw = car.customData?.branch || 'الفرع الرئيسي';
      if (localBranch !== 'all' && bRaw.trim() !== localBranch) return false;

      // Delegate Filter
      const delRaw = car.exitData?.seller || car.exitData?.representativeName || car.seller || 'غير محدد';
      if (localDelegate !== 'all' && delRaw.trim() !== localDelegate) return false;

      return true;
    });
  }, [cars, localStartDate, localEndDate, localBrand, localModel, localSupplier, localBranch, localDelegate]);

  // Split into active and sold datasets under filters
  const activeCars = useMemo(() => filteredCars.filter(c => !c.isOutbound && c.status !== CarStatus.IN_TRANSFER), [filteredCars]);
  const soldCars = useMemo(() => filteredCars.filter(c => c.isOutbound && c.status !== CarStatus.IN_TRANSFER), [filteredCars]);

  // =========================================================================
  // CALCULATE KPI DECK VARIABLES
  // =========================================================================
  const totalCarsCount = filteredCars.length;
  
  const currentStockCostValue = useMemo(() => {
    return activeCars.reduce((sum, car) => sum + getVehicleCost(car), 0);
  }, [activeCars, vehicleCosts]);

  const avgVehicleCost = useMemo(() => {
    return activeCars.length > 0 ? Math.round(currentStockCostValue / activeCars.length) : 0;
  }, [activeCars, currentStockCostValue]);

  const countUniqueBrands = useMemo(() => {
    return new Set(filteredCars.map(c => c.brand).filter(Boolean)).size;
  }, [filteredCars]);

  const countUniqueModels = useMemo(() => {
    return new Set(filteredCars.map(c => `${c.brand} ${c.model}`).filter(Boolean)).size;
  }, [filteredCars]);

  const countUniqueSuppliers = useMemo(() => {
    return new Set(filteredCars.map(c => c.supplier).filter(Boolean)).size;
  }, [filteredCars]);

  const countUniqueYards = useMemo(() => {
    return new Set(filteredCars.map(c => c.customData?.branch || 'الفرع الرئيسي').filter(Boolean)).size;
  }, [filteredCars]);

  // Stagnation classification based on stagnantLimitDays state
  const stagnantCarsList = useMemo(() => {
    return activeCars.map(car => {
      if (!car.entryDate) return { car, days: 0 };
      const entry = new Date(car.entryDate.split('T')[0]);
      const diffDays = Math.round((new Date().getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
      return { car, days: diffDays };
    }).filter(item => item.days >= finalStagnantLimitDays)
      .sort((a, b) => b.days - a.days);
  }, [activeCars, finalStagnantLimitDays]);

  const stagnantCount = stagnantCarsList.length;

  const fastTurningCount = useMemo(() => {
    // Sold cars with stay length <= 14 days
    return soldCars.filter(car => {
      if (car.entryDate && car.exitData?.exitDate) {
        const entry = new Date(car.entryDate.split('T')[0]);
        const exit = new Date(car.exitData.exitDate.split('T')[0]);
        const stay = Math.round((exit.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
        return stay >= 0 && stay <= 14;
      }
      return false;
    }).length;
  }, [soldCars]);

  // Aggregate financial sales & profit
  const totalSalesAmount = useMemo(() => {
    return soldCars.reduce((sum, car) => sum + (Number(car.price) || 0), 0);
  }, [soldCars]);

  const totalSalesCostPrice = useMemo(() => {
    return soldCars.reduce((sum, car) => sum + getVehicleCost(car), 0);
  }, [soldCars]);

  const totalProfitsRealized = useMemo(() => {
    return Math.max(0, totalSalesAmount - totalSalesCostPrice);
  }, [totalSalesAmount, totalSalesCostPrice]);

  const inventoryTurnoverRate = useMemo(() => {
    const den = activeCars.length + soldCars.length;
    return den > 0 ? Math.round((soldCars.length / den) * 100) : 0;
  }, [activeCars, soldCars]);

  // =========================================================================
  // 1. BRAND DETAILED ANALYSIS
  // =========================================================================
  const brandAnalysisList = useMemo(() => {
    const brandMap: Record<string, { 
      brand: string; 
      count: number; 
      activeCount: number;
      soldCount: number;
      stockCostValue: number; 
      profit: number; 
      salesAmount: number;
    }> = {};

    filteredCars.forEach(car => {
      const b = car.brand || 'غير محدد';
      if (!brandMap[b]) {
        brandMap[b] = { brand: b, count: 0, activeCount: 0, soldCount: 0, stockCostValue: 0, profit: 0, salesAmount: 0 };
      }
      const record = brandMap[b];
      record.count++;
      
      const vCost = getVehicleCost(car);
      if (car.isOutbound) {
        record.soldCount++;
        const saleVal = Number(car.price) || 0;
        record.salesAmount += saleVal;
        record.profit += Math.max(0, saleVal - vCost);
      } else {
        record.activeCount++;
        record.stockCostValue += vCost;
      }
    });

    return Object.values(brandMap).sort((a, b) => b.count - a.count);
  }, [filteredCars, vehicleCosts]);

  const highestProfitBrand = useMemo(() => {
    if (brandAnalysisList.length === 0) return '-';
    const sorted = [...brandAnalysisList].sort((a, b) => b.profit - a.profit);
    return sorted[0]?.brand || '-';
  }, [brandAnalysisList]);

  const highestSoldBrand = useMemo(() => {
    if (brandAnalysisList.length === 0) return '-';
    const sorted = [...brandAnalysisList].sort((a, b) => b.soldCount - a.soldCount);
    return sorted[0]?.brand || '-';
  }, [brandAnalysisList]);

  const highestCostBrand = useMemo(() => {
    if (brandAnalysisList.length === 0) return '-';
    const sorted = [...brandAnalysisList].sort((a, b) => b.stockCostValue - a.stockCostValue);
    return sorted[0]?.brand || '-';
  }, [brandAnalysisList]);


  // =========================================================================
  // 2. MODEL DETAILED ANALYSIS
  // =========================================================================
  const modelAnalysisList = useMemo(() => {
    const modelMap: Record<string, {
      brand: string;
      model: string;
      availableCount: number;
      soldCount: number;
      value: number;
      totalSalesPriceOfStock: number;
    }> = {};

    filteredCars.forEach(car => {
      const key = `${car.brand} ${car.model}`;
      if (!modelMap[key]) {
        modelMap[key] = {
          brand: car.brand || 'غير محدد',
          model: car.model || 'طراز عام',
          availableCount: 0,
          soldCount: 0,
          value: 0,
          totalSalesPriceOfStock: 0,
        };
      }
      const record = modelMap[key];
      const vCost = getVehicleCost(car);

      if (car.isOutbound) {
        record.soldCount++;
      } else {
        record.availableCount++;
        record.value += vCost;
        record.totalSalesPriceOfStock += Number(car.price) || 0;
      }
    });

    return Object.values(modelMap);
  }, [filteredCars, vehicleCosts]);

  const mostAvailableModels = useMemo(() => {
    return [...modelAnalysisList].sort((a, b) => b.availableCount - a.availableCount).slice(0, 5);
  }, [modelAnalysisList]);

  const leastAvailableModels = useMemo(() => {
    // Models with available count > 0, sorted ascending
    return [...modelAnalysisList].filter(m => m.availableCount > 0).sort((a, b) => a.availableCount - b.availableCount).slice(0, 5);
  }, [modelAnalysisList]);


  // =========================================================================
  // 3. SUPPLIER DETAILED ANALYSIS
  // =========================================================================
  const supplierAnalysisList = useMemo(() => {
    const supplierMap: Record<string, {
      supplier: string;
      totalCars: number;
      activeCarsCount: number;
      soldCarsCount: number;
      comprehensivePurchasesVal: number;
      salesAmount: number;
      profitRealized: number;
    }> = {};

    filteredCars.forEach(car => {
      const sup = car.supplier || 'مورد عام';
      if (!supplierMap[sup]) {
        supplierMap[sup] = {
          supplier: sup,
          totalCars: 0,
          activeCarsCount: 0,
          soldCarsCount: 0,
          comprehensivePurchasesVal: 0,
          salesAmount: 0,
          profitRealized: 0
        };
      }
      const rec = supplierMap[sup];
      rec.totalCars++;
      
      const vCost = getVehicleCost(car);
      rec.comprehensivePurchasesVal += vCost;

      if (car.isOutbound) {
        rec.soldCarsCount++;
        const sPrice = Number(car.price) || 0;
        rec.salesAmount += sPrice;
        rec.profitRealized += Math.max(0, sPrice - vCost);
      } else {
        rec.activeCarsCount++;
      }
    });

    return Object.values(supplierMap).sort((a, b) => b.totalCars - a.totalCars);
  }, [filteredCars, vehicleCosts]);

  const bestProfitSupplier = useMemo(() => {
    if (supplierAnalysisList.length === 0) return '-';
    const sorted = [...supplierAnalysisList].sort((a, b) => b.profitRealized - a.profitRealized);
    return sorted[0]?.supplier || '-';
  }, [supplierAnalysisList]);

  const topQuantitySupplier = useMemo(() => {
    if (supplierAnalysisList.length === 0) return '-';
    return supplierAnalysisList[0]?.supplier || '-';
  }, [supplierAnalysisList]);


  // =========================================================================
  // 4. LOCATIONS / YARDS CAPACITY ANALYSIS
  // =========================================================================
  const yardCapacityAnalysis = useMemo(() => {
    const yardMap: Record<string, {
      yard: string;
      carsCount: number;
      stockValue: number;
      occupancyPercentage: number;
    }> = {};

    activeCars.forEach(car => {
      const yardName = car.customData?.branch || 'الفرع الرئيسي';
      if (!yardMap[yardName]) {
        yardMap[yardName] = { 
          yard: yardName, 
          carsCount: 0, 
          stockValue: 0, 
          occupancyPercentage: 0 
        };
      }
      const rec = yardMap[yardName];
      rec.carsCount++;
      rec.stockValue += getVehicleCost(car);
    });

    // Assume branch nominal capacity size is 45 units for visualization
    return Object.values(yardMap).map(item => {
      const simulatedCapacity = 45;
      item.occupancyPercentage = Math.round((item.carsCount / simulatedCapacity) * 100);
      return item;
    }).sort((a, b) => b.carsCount - a.carsCount);
  }, [activeCars, vehicleCosts]);


  // =========================================================================
  // 5. CHRONOLOGICAL CASH AND PROFIT TRENDS
  // =========================================================================
  const chronologicalMonthlyTrends = useMemo(() => {
    const trendMap: Record<string, { 
      monthKey: string; 
      monthLabel: string;
      stockValue: number; 
      salesAmount: number; 
      profit: number; 
    }> = {};

    // Standard Arabic month list helper
    const monthLabelsMap: Record<string, string> = {
      '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
      '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
      '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
    };

    // Initialize past 6 months to make chart continuous
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const pastMonth = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const mStr = String(pastMonth.getMonth() + 1).padStart(2, '0');
      const yStr = pastMonth.getFullYear();
      const k = `${yStr}-${mStr}`;
      trendMap[k] = {
        monthKey: k,
        monthLabel: `${monthLabelsMap[mStr] || mStr} ${yStr}`,
        stockValue: 0,
        salesAmount: 0,
        profit: 0
      };
    }

    // Allocate current entries / exits to month trend
    activeCars.forEach(car => {
      if (car.entryDate) {
        const parts = car.entryDate.split('-');
        if (parts.length >= 2) {
          const k = `${parts[0]}-${parts[1]}`;
          if (trendMap[k]) {
            trendMap[k].stockValue += getVehicleCost(car);
          }
        }
      }
    });

    soldCars.forEach(car => {
      if (car.exitData?.exitDate) {
        const parts = car.exitData.exitDate.split('-');
        if (parts.length >= 2) {
          const k = `${parts[0]}-${parts[1]}`;
          if (trendMap[k]) {
            const saleVal = Number(car.price) || 0;
            trendMap[k].salesAmount += saleVal;
            trendMap[k].profit += Math.max(0, saleVal - getVehicleCost(car));
          }
        }
      }
    });

    return Object.values(trendMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [activeCars, soldCars, vehicleCosts]);

  const averageStockRetentionDays = useMemo(() => {
    let sumDays = 0;
    let countedExits = 0;
    soldCars.forEach(car => {
      if (car.entryDate && car.exitData?.exitDate) {
        const entryDateObj = new Date(car.entryDate.split('T')[0]);
        const exitDateObj = new Date(car.exitData.exitDate.split('T')[0]);
        const diffDays = Math.round((exitDateObj.getTime() - entryDateObj.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          sumDays += diffDays;
          countedExits++;
        }
      }
    });
    return countedExits > 0 ? Math.round(sumDays / countedExits) : 18;
  }, [soldCars]);


  // =========================================================================
  // 6. STAGNATION & ROTATION RISK SPLITS
  // =========================================================================
  const rotationCategorySplits = useMemo(() => {
    let fast = 0;
    let med = 0;
    let slow = 0;
    let stagnant = 0;

    let fastVal = 0;
    let medVal = 0;
    let slowVal = 0;
    let stagnantVal = 0;

    activeCars.forEach(car => {
      let days = 0;
      if (car.entryDate) {
        const entry = new Date(car.entryDate.split('T')[0]);
        days = Math.round((new Date().getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
      }
      const carCost = getVehicleCost(car);

      if (days <= 15) {
        fast++;
        fastVal += carCost;
      } else if (days <= 45) {
        med++;
        medVal += carCost;
      } else if (days <= finalStagnantLimitDays) {
        slow++;
        slowVal += carCost;
      } else {
        stagnant++;
        stagnantVal += carCost;
      }
    });

    const activeTotal = activeCars.length || 1;

    return {
      distribution: [
        { name: 'دوران سريع (≤15 يوم)', value: fast, capital: fastVal, color: '#10b981' },
        { name: 'دوران متوسط (16-45 يوم)', value: med, capital: medVal, color: '#2563eb' },
        { name: 'دوران بطيء (46-89 يوم)', value: slow, capital: slowVal, color: '#f59e0b' },
        { name: 'ركود كامل (≥90 يوم)', value: stagnant, capital: stagnantVal, color: '#ef4444' }
      ],
      stagnationRate: Math.round((stagnant / activeTotal) * 100)
    };
  }, [activeCars, vehicleCosts, finalStagnantLimitDays]);


  // =========================================================================
  // 7. COMPREHENSIVE SALES SUMMARIZATION
  // =========================================================================
  const netSalesRevenue = totalSalesAmount;
  const netRealizedProfit = totalProfitsRealized;
  const avgProfitPerSale = useMemo(() => {
    return soldCars.length > 0 ? Math.round(netRealizedProfit / soldCars.length) : 0;
  }, [soldCars, netRealizedProfit]);

  const topBrandSalesLabel = highestSoldBrand;
  const topModelSalesLabel = useMemo(() => {
    if (modelAnalysisList.length === 0) return '-';
    const sorted = [...modelAnalysisList].sort((a, b) => b.soldCount - a.soldCount);
    return sorted[0] ? `${sorted[0].brand} ${sorted[0].model}` : '-';
  }, [modelAnalysisList]);


  // =========================================================================
  // 8. REPRESENTATIVES AND DELEGATES PERFORMANCE RANKING BOARD
  // =========================================================================
  const representativesPerformanceRankList = useMemo(() => {
    const delegateMap: Record<string, {
      delegate: string;
      soldCount: number;
      revenue: number;
      profitRealized: number;
      achievementRate: number;
    }> = {};

    soldCars.forEach(car => {
      const del = car.exitData?.seller || car.exitData?.representativeName || car.seller || 'غير محدد';
      if (!delegateMap[del]) {
        delegateMap[del] = { delegate: del, soldCount: 0, revenue: 0, profitRealized: 0, achievementRate: 0 };
      }
      const rec = delegateMap[del];
      rec.soldCount++;
      const price = Number(car.price) || 0;
      rec.revenue += price;
      rec.profitRealized += Math.max(0, price - getVehicleCost(car));
    });

    const standardTargetQuota = 12; // Nominal target per period
    return Object.values(delegateMap).map(rep => {
      rep.achievementRate = Math.min(100, Math.round((rep.soldCount / standardTargetQuota) * 100));
      return rep;
    }).sort((a, b) => b.soldCount - a.soldCount);
  }, [soldCars, vehicleCosts]);


  // =========================================================================
  // 9. SAVED INVENTORY EXPECTED MARGINS
  // =========================================================================
  const potentialExpectedStockProfit = useMemo(() => {
    return activeCars.reduce((sum, car) => {
      const price = Number(car.price) || 0;
      const cost = getVehicleCost(car);
      return sum + Math.max(0, price - cost);
    }, 0);
  }, [activeCars, vehicleCosts]);

  const topProfitableCarsInStock = useMemo(() => {
    return activeCars.map(car => {
      const price = Number(car.price) || 0;
      const cost = getVehicleCost(car);
      const estMargin = Math.max(0, price - cost);
      return { car, estMargin, cost, price };
    }).sort((a, b) => b.estMargin - a.estMargin).slice(0, 5);
  }, [activeCars, vehicleCosts]);


  // =========================================================================
  // 10. AI-POWERED ANALYTICAL AND PREDICTIVE INTUITIONS
  // =========================================================================
  const cognitiveAIAlerts = useMemo(() => {
    const alerts: string[] = [];

    // Most In-Demand Brand dynamic notification
    if (highestSoldBrand !== '-') {
      const brandData = brandAnalysisList.find(b => b.brand === highestSoldBrand);
      const percentage = brandData ? Math.round((brandData.soldCount / (soldCars.length || 1)) * 100) : 0;
      alerts.push(`🎯 **الأكثر طلباً بالفترة الحالية:** ماركة **${highestSoldBrand}** تتصدر عمليات الصرف وحققت مبيعات بنسبة **${percentage}%** من الإجمالي.`);
    }

    // Stagnant vehicles notice
    if (stagnantCount > 0) {
      const frozenM = stagnantCarsList.reduce((sum, item) => sum + getVehicleCost(item.car), 0);
      alerts.push(`🚨 **إنذار ركود وتجميد مالي:** هناك **${stagnantCount}** سيارات بالمخزون حالياً تجاوزت الـ ${finalStagnantLimitDays} يوماً، مسببة تجميد سيولة مالية بقيمة **${frozenM.toLocaleString()} ريال**.`);
    }

    // Repurchase Suggestion based on low active inventory but high sales speed
    const repurchaseCandidates = brandAnalysisList
      .filter(item => item.soldCount >= 2 && item.activeCount <= 1)
      .map(item => item.brand);
    if (repurchaseCandidates.length > 0) {
      alerts.push(`⚙️ **توصية ذكية لإعادة الشراء:** نقترح توريد المزيد من علامات **${repurchaseCandidates.join(' و ')}** لتسارع تداولها ونفاد كمياتها بالمخزن الفعلي.`);
    }

    // Stockout Warning
    const lowStockModels = modelAnalysisList
      .filter(item => item.availableCount === 1 && item.soldCount >= 1)
      .slice(0, 3)
      .map(item => `${item.brand} ${item.model}`);
    if (lowStockModels.length > 0) {
      alerts.push(`🛑 **توقعات وشك نفاد المخزون:** الموديلات **${lowStockModels.join(' | ')}** متبقي منها قطعة واحدة فقط وتواجه طلباً مستمراً.`);
    }

    // Sales forecast based on last 30 days output
    const monthCapacity = soldCars.length;
    if (monthCapacity > 0) {
      const forecastedSales = Math.round(monthCapacity * 1.15);
      alerts.push(`📈 **توقعات الحجم البيعي للموسم القادم:** من المتوقع نمو مبيعات الشهر القادم لتسجّل **${forecastedSales} سيارة** مدفوعة بطلب السحب اللحظي النشط.`);
    }

    // Margin optimization advice
    const highMarginBrand = [...brandAnalysisList]
      .filter(b => b.soldCount > 0)
      .map(b => ({ brand: b.brand, ratio: b.profit / (b.salesAmount || 1) }))
      .sort((a, b) => b.ratio - a.ratio)[0];
    if (highMarginBrand && highMarginBrand.ratio > 0.15) {
      alerts.push(`✨ **فرصة تعظيم الهامش الكلي:** علامات **${highMarginBrand.brand}** تسجل أفضل معدل هامش ربحية (**${Math.round(highMarginBrand.ratio * 100)}%**)، ركّز الإنفاق التسويقي لدعمها.`);
    }

    return alerts;
  }, [brandAnalysisList, stagnantCarsList, stagnantCount, modelAnalysisList, soldCars, highestSoldBrand]);


  // CUSTOM PRINT FUNCTION FOR PROFESSIONAL LANDSCAPE MULTI-PAGE REPORTS
  const handleExportSystemPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-8 font-sans pb-16 rtl text-right" id="fabric-executive-dashboard">
      
      {/* 1. EMBEDDED CSS OVEROVERRIDES TO STYLE THE EXPORT TABLEAU SHEET */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            font-size: 10px !important;
            font-family: system-ui, sans-serif !important;
            direction: rtl !important;
          }
          #fabric-executive-dashboard {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 10px !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          /* Hide non-printable web elements */
          .print\\:hidden, #app-navbar, #app-sidebar, button, select, input, .no-print {
            display: none !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          /* Custom printable section split boundaries */
          .print-section {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
            border-top: 1px solid #cbd5e1 !important;
            padding-top: 24px !important;
            margin-top: 24px !important;
          }
          .recharts-responsive-container {
            width: 100% !important;
            height: 200px !important;
          }
        }
      `}</style>

      {/* =========================================================================
         DASHBOARD HEADER & BRAND RECOGNITION BLOCK
         ========================================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-8 bg-slate-900 text-white rounded-[2rem] shadow-xl border border-slate-800">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl animate-pulse shadow-md">
              <Sparkles size={22} className="text-white" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>لوحة المؤشرات والتحليلات البيانية الشاملة 📊</span>
                <span className="bg-blue-600/30 text-blue-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-blue-500/30">ERP / Power BI PRO</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-1">بث حي وتحليل متكامل لعجلة الأداء للمبيعات المستهدفة وتدوير رأس مال المعرض</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <button
            onClick={handleExportSystemPdf}
            className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-l from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-2xl text-xs font-black shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] active:scale-95 cursor-pointer no-print print:hidden"
          >
            <Printer size={16} />
            <span>📄 تصدير تقرير الـ PDF التنفيذي المتكامل</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
         HORIZONTAL UNIFIED FILTER BAR CARD (AFFECTS EVERYTHING DIRECTLY)
         ========================================================================= */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm space-y-4 no-print print:hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <span className="text-xs font-black text-slate-800 dark:text-slate-105 flex items-center gap-1.5">
            <Activity className="text-indigo-600" size={16} />
            فلترة عامة وشاملة للنظام (تحديث ديناميكي لحظي لكافة المؤشرات)
          </span>
          <button 
            onClick={handleResetFilters}
            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
          >
            إعادة تعيين الفلاتر الافتراضية 🔄
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {/* Filter 1: From Date */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">من تاريخ (التسجيل أو البيع):</label>
            <div className="relative">
              <input 
                type="date"
                value={localStartDate}
                onChange={(e) => setLocalStartDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter 2: To Date */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">إلى تاريخ:</label>
            <div className="relative">
              <input 
                type="date"
                value={localEndDate}
                onChange={(e) => setLocalEndDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter 3: Brand */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">الماركة / الشركة:</label>
            <select
              value={localBrand}
              onChange={(e) => {
                setLocalBrand(e.target.value);
                setLocalModel('all'); // Reset model filter on brand switch
              }}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-750 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">الكل (كافة الماركات) 🏎️</option>
              {dynamicBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Filter 4: Model */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">الموديل أو الطراز:</label>
            <select
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-750 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">الكل (كافة الموديلات) 📋</option>
              {dynamicModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Filter 5: Supplier */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">شريك التوريد:</label>
            <select
              value={localSupplier}
              onChange={(e) => setLocalSupplier(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-755 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">الكل (كافة الموردين) 🤝</option>
              {dynamicSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Filter 6: Yard/Branch */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">الموقع الميداني / الفرع:</label>
            <select
              value={localBranch}
              onChange={(e) => setLocalBranch(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-755 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">الكل (كافة الفروع والسياجات) 🏢</option>
              {dynamicBranches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Filter 7: Delegate */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">مسؤول المبيعات المعتمد:</label>
            <select
              value={localDelegate}
              onChange={(e) => setLocalDelegate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-755 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">الكل (كافة المناديب والمنفذين) 👤</option>
              {dynamicDelegates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================================
         SECTION ONE: EXECUTIVE INDICATORS (12 KPI CARDS - FULL DECK)
         ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-r-4 border-blue-600 pr-3">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-200">أولاً: بطاقات مؤشرات الأداء اللحظية (Primary Executive Indicators)</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          
          {/* Card 1: Total cars */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">السيارات المشمولة بالفترة</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black font-mono text-slate-900 dark:text-white">{totalCarsCount}</h3>
                <p className="text-[9px] text-blue-500 font-bold">نشط بالفلترة</p>
              </div>
              <CarIcon className="text-blue-500" size={20} />
            </div>
          </div>

          {/* Card 2: Stock value */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي قيمة المخزون الحالي</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-base md:text-[18px] font-black font-mono text-blue-600 dark:text-blue-400">
                  {canViewFinancials ? `${(currentStockCostValue || 0).toLocaleString()} ريال` : '*****'}
                </h3>
                <p className="text-[9px] text-slate-400">تكلفة المعروض القائم</p>
              </div>
              <DollarSign className="text-emerald-500 animate-pulse" size={18} />
            </div>
          </div>

          {/* Card 3: Average cost per vehicle */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">متوسط تكلفة السيارة</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-base md:text-[18px] font-black font-mono text-slate-900 dark:text-white">
                  {canViewFinancials ? `${(avgVehicleCost || 0).toLocaleString()} ريال` : '*****'}
                </h3>
                <p className="text-[9px] text-slate-400">متوسط قيمة الوحدة</p>
              </div>
              <Activity className="text-slate-400" size={18} />
            </div>
          </div>

          {/* Card 4: Brands count */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">عدد الشركات المصنعة</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black font-mono text-slate-900 dark:text-white">{countUniqueBrands}</h3>
                <p className="text-[9px] text-slate-400">ماركة نشطة بالمرجان</p>
              </div>
              <Award className="text-amber-500" size={18} />
            </div>
          </div>

          {/* Card 5: Models count */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">عدد الفئات والموديلات</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black font-mono text-slate-900 dark:text-white">{countUniqueModels}</h3>
                <p className="text-[9px] text-slate-400">طراز مسجل</p>
              </div>
              <FileText className="text-purple-500" size={18} />
            </div>
          </div>

          {/* Card 6: Suppliers count */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">عدد شركاء التوريد</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black font-mono text-slate-900 dark:text-white">{countUniqueSuppliers}</h3>
                <p className="text-[9px] text-slate-400">مورد وقناة ربط</p>
              </div>
              <Users className="text-teal-500" size={18} />
            </div>
          </div>

        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-2">
          
          {/* Card 7: Active branch yards */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">عدد المستودعات والساحات</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black font-mono text-slate-900 dark:text-white">{countUniqueYards}</h3>
                <p className="text-[9px] text-slate-400">موقع جغرافي</p>
              </div>
              <Building2 className="text-orange-500" size={18} />
            </div>
          </div>

          {/* Card 8: Stagnant count */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">عدد السيارات الراكدة</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black font-mono text-rose-600">{stagnantCount}</h3>
                <p className="text-[9px] text-rose-500 font-bold">بقاء تجاوز {finalStagnantLimitDays} يوماً</p>
              </div>
              <Clock className="text-rose-500" size={18} />
            </div>
          </div>

          {/* Card 9: Fast turning count */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">السيارات سريعة الدوران</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black font-mono text-emerald-600">{fastTurningCount}</h3>
                <p className="text-[9px] text-emerald-500 font-bold">دورة بقاء ≤14 يوم</p>
              </div>
              <Zap className="text-emerald-500" size={18} />
            </div>
          </div>

          {/* Card 10: Sold cars count */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">المبيعات وصادرات الفترة</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">{soldCars.length}</h3>
                <p className="text-[9px] text-indigo-500 font-bold">صيغة صرف معتمدة</p>
              </div>
              <PlusCircle className="text-indigo-500" size={18} />
            </div>
          </div>

          {/* Card 11: Realized net profit */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي الأرباح المحققة بالفترة</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-base md:text-[18px] font-black font-mono text-emerald-600">
                  {canViewFinancials ? `${(totalProfitsRealized || 0).toLocaleString()} ريال` : '*****'}
                </h3>
                <p className="text-[9px] text-slate-400">عن مركبات خروج معلنة</p>
              </div>
              <DollarSign className="text-emerald-600" size={18} />
            </div>
          </div>

          {/* Card 12: Turnover Ratio */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">نسبة دوران المخزون الكلي</span>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black font-mono text-indigo-600 dark:text-slate-200">{inventoryTurnoverRate}%</h3>
                <p className="text-[9px] text-slate-400">حجم الاستجرار الفعلي</p>
              </div>
              <Percent className="text-blue-500" size={18} />
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
         COGNITIVE PREDICTIVE INTELLIGENCE SECTION (ALGORITHMICALLY DERIVED)
         ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-slate-900 dark:to-indigo-950/20 p-6 rounded-3xl border border-blue-100 dark:border-indigo-950 shadow-sm space-y-3 print-section">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 text-white rounded-xl">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white">النباهة والذكاء التحليلي التنبؤي الذاتي (ERP Pro Cognitive Intelligence)</h3>
            <p className="text-[10px] text-slate-450 dark:text-slate-400">إشعارات آلية وحلول تشغيلية مستنبطة ذاتياً من تدفق قاعدة السجلات الحالية لوقاية الأصول</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {cognitiveAIAlerts.slice(0, 4).map((alert, index) => (
            <div key={index} className="flex gap-2.5 items-start p-3 bg-white dark:bg-slate-950/40 rounded-2xl border border-blue-100/40 dark:border-slate-850">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
              <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">
                {alert.replace(/\*\*/g, '')}
              </p>
            </div>
          ))}
          {cognitiveAIAlerts.length === 0 && (
            <p className="text-xs text-slate-400 italic">لا توجد تحليلات أو إنذارات طارئة كافية حالياً لمعدلات تداول المخزون.</p>
          )}
        </div>
      </div>

      {/* =========================================================================
         SECTION TWO: BRANDS DEMAND & INVENTORY VALUE MATRIX (BENTO GRID STYLE)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-section">
        
        {/* Brand visualizer chart card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/60 pb-3 mb-4">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Award className="text-blue-500" size={15} />
                ثانياً: تحليل الماركات وحصص تدوير الأصول برؤوس الأموال
              </span>
              <span className="text-[9px] bg-blue-105 text-blue-600 px-2 py-0.5 rounded-md font-bold">بث مباشر</span>
            </div>
            
            <div className="h-[240px] w-full" dir="ltr">
              {brandAnalysisList.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brandAnalysisList.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="brand" tick={{ fontSize: 9, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar name="سيارات متوفرة حالياً" dataKey="activeCount" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar name="سيارات مباعة بالفترة" dataKey="soldCount" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 italic text-xs">لا تتوفر ماركات للمطابقة</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-50 dark:border-slate-800/60 mt-4 text-center">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-950/30 rounded-xl">
              <span className="text-[9px] text-slate-400 block font-bold">الأكثر ربحية معاً</span>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">{highestProfitBrand}</span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-950/30 rounded-xl">
              <span className="text-[9px] text-slate-400 block font-bold">الأعلى حركة خروج مبيعات</span>
              <span className="text-xs font-black text-indigo-600">{highestSoldBrand}</span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-950/30 rounded-xl">
              <span className="text-[9px] text-slate-400 block font-bold">الملكية التشغيلية الأعلى قيمة</span>
              <span className="text-xs font-black text-rose-500 truncate block">{highestCostBrand}</span>
            </div>
          </div>
        </div>

        {/* Detailed Brand Table with contribution shares */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-black text-slate-800 dark:text-slate-205 border-r-4 border-indigo-650 pr-2.5 block">مساهمة الماركات الفردية بالمعرض</span>
            <p className="text-[10px] text-slate-400 mt-1">تعداد المركبات، معدل الصادر، والحصة النقدية في رأس المال</p>
            
            <div className="space-y-2 overflow-y-auto max-h-[240px] pr-1">
              {brandAnalysisList.slice(0, 10).map((item, index) => {
                const totalStockVal = currentStockCostValue || 1;
                const percentageShare = Math.round((item.stockCostValue / totalStockVal) * 100);
                return (
                  <div key={item.brand} className="p-2.5 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100/50 dark:border-slate-850/50 space-y-1.5 hover:shadow-sm">
                    <div className="flex justify-between items-center font-bold text-[11px]">
                      <span className="text-slate-950 dark:text-white">{index + 1}. {item.brand}</span>
                      <span className="font-mono text-slate-550 dark:text-slate-400">{item.activeCount} مخزن | {item.soldCount} مباع</span>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
                      <span>إجمالي القيمة: {canViewFinancials ? `${(item.stockCostValue || 0).toLocaleString()} ريال` : '*****'}</span>
                      <span className="text-blue-600">حصة {percentageShare}%</span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-l from-blue-600 to-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, percentageShare || 5)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="text-[9.5px] text-center p-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-120/40 rounded-xl text-indigo-700 dark:text-indigo-305 mt-2 font-bold leading-relaxed">
            تساهم العينات المدرجة أعلاه بأصل رأس المال التجاري المقيم بالمستطاع.
          </div>
        </div>

      </div>

      {/* =========================================================================
         SECTION THREE: MODEL TURNOVER ANALYSIS & DATA SHEET
         ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 print-section">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-55 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-205 flex items-center gap-1.5">
              <FileText className="text-purple-600" size={15} />
              ثالثاً: تفاصيل فئات وموديلات المركبات وتوفرها حركياً (Model Dynamics)
            </h3>
            <p className="text-[10px] text-slate-400">مطابقة الفئات، التعداد التشغيلي، الدفع المالي وسرعة التداول الفعلي بالمعرض</p>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-bold no-print">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle size={12} fill="rgba(16, 185, 129, 0.1)" /> أكثر طلباً مبيعاً
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
          
          {/* Top Available Models */}
          <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-105/50 dark:border-slate-800/50">
            <span className="text-[11px] font-black text-slate-805 dark:text-slate-200 block border-r-3 border-indigo-500 pr-2">أكثر طرازات السيارات توافراً وتداولاً بالمواقع</span>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {mostAvailableModels.map(m => (
                <div key={`${m.brand}-${m.model}`} className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 hover:shadow-sm">
                  <div>
                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white">{m.brand} {m.model}</h4>
                    <p className="text-[9px] text-slate-400">تكلفة مخزون: {canViewFinancials ? `${(m.value || 0).toLocaleString()} ريال` : '*****'}</p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-black">
                    {m.availableCount} متوفر
                  </span>
                </div>
              ))}
              {mostAvailableModels.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center p-4">لا توجد سجلات</p>
              )}
            </div>
          </div>

          {/* Least Available Models */}
          <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-105/50 dark:border-slate-800/50">
            <span className="text-[11px] font-black text-slate-805 dark:text-slate-200 block border-r-3 border-emerald-500 pr-2">الموديلات المطلوبة حالياً في الساحات (ذات الوفرة المحدودة)</span>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {leastAvailableModels.map(m => (
                <div key={`${m.brand}-${m.model}`} className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 hover:shadow-sm">
                  <div>
                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white">{m.brand} {m.model}</h4>
                    <p className="text-[9px] text-slate-400">متوسط سعر المعروض: {canViewFinancials ? `${(Math.round(m.totalSalesPriceOfStock / (m.availableCount || 1))).toLocaleString()} ريال` : '*****'}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-955 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-black">
                    قطعة واحدة متبقية ⚠️
                  </span>
                </div>
              ))}
              {leastAvailableModels.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center p-4">لا توجد سيارات بانتظار الخروج</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
         SECTION FOUR: SUPPLIERS DETAILED AUDIT
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-section">
        
        {/* Supplier details analysis panel */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-55 dark:border-slate-800 pb-3 mb-4">
              <span className="text-xs font-black text-slate-850 dark:text-slate-205 flex items-center gap-1.5 animate-pulse">
                <Users className="text-teal-650" size={16} />
                رابعاً: كفاءة شركاء التوريد وضخ رؤوس الأموال بالفترة
              </span>
              <span className="text-[9.5px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md font-bold">تدقيق المشتريات</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-[10px]">
                    <th className="p-3 text-right">عنوان شريك التوريد</th>
                    <th className="p-3">مستجر التوريد (سيارة)</th>
                    <th className="p-3">إجمالي قيمة التوريد</th>
                    <th className="p-3">متوسط الوفرة القياسية للسيارة</th>
                    <th className="p-3">الأرباح الناتجة</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierAnalysisList.slice(0, 5).map(sup => (
                    <tr key={sup.supplier} className="border-t border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-right text-slate-805 dark:text-slate-200">{sup.supplier}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{sup.totalCars}</td>
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400">
                        {canViewFinancials ? `${sup.comprehensivePurchasesVal.toLocaleString()} ريال` : '*****'}
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {canViewFinancials ? `${Math.round(sup.comprehensivePurchasesVal / (sup.totalCars || 1)).toLocaleString()} ريال` : '*****'}
                      </td>
                      <td className="p-3 font-mono font-black text-emerald-600">
                        {canViewFinancials ? `${sup.profitRealized.toLocaleString()} ريال` : '*****'}
                      </td>
                    </tr>
                  ))}
                  {supplierAnalysisList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">لا توجد حركة توريد خلال المدة المحددة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-teal-50/55 dark:bg-slate-950/20 p-4 rounded-2xl border border-teal-100/40 dark:border-slate-850 text-[11px] leading-relaxed mt-4 flex justify-between items-center text-teal-805 dark:text-teal-400 font-bold">
            <span>🤝 الأعلى توريداً بالفترة: <strong className="text-indigo-650">{topQuantitySupplier}</strong></span>
            <span>💎 المورد الأكثر ربحية للمنشأة: <strong className="text-emerald-700">{bestProfitSupplier}</strong></span>
          </div>
        </div>

        {/* SECTION FIVE: LOCATIONS / YARDS OCCUPANCY AND VALUE DIST */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Building2 className="text-amber-500" size={15} />
              خامساً: الساحات والمستودعات الجغرافية (Yard Allocation)
            </h3>
            <p className="text-[10px] text-slate-400">توزيع السيارات ومعدلات إشغال المساحة المتوفرة حالياً</p>
          </div>

          <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
            {yardCapacityAnalysis.map(yard => (
              <div key={yard.yard} className="p-3 bg-slate-50/60 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850/60 space-y-2">
                <div className="flex justify-between items-center text-[11px] font-black">
                  <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                    <MapPin size={13} className="text-amber-500" />
                    {yard.yard}
                  </span>
                  <span className="font-mono text-slate-500">{yard.carsCount} سيارة بالموقع</span>
                </div>

                <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
                  <span>أصل قيمة المحتوى: {canViewFinancials ? `${(yard.stockValue || 0).toLocaleString()} ريال` : '*****'}</span>
                  <span>نسبة الإشغال الإسمية: {yard.occupancyPercentage}%</span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${yard.occupancyPercentage > 85 ? 'bg-rose-500' : 'bg-amber-500'}`} 
                    style={{ width: `${Math.min(100, yard.occupancyPercentage)}%` }} 
                  />
                </div>
              </div>
            ))}
            {yardCapacityAnalysis.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-6">لا توجد أفرع مسجلة</p>
            )}
          </div>
        </div>

      </div>

      {/* =========================================================================
         SECTION SIX: FINANCIAL & TIMELINE CHRONOLOGICAL CASHFLOW (SAP/Fabric Standard)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-section">
        
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-55 dark:border-slate-800/80 pb-3 mb-4">
              <span className="text-xs font-black text-slate-800 dark:text-slate-205 flex items-center gap-1.5">
                <LineChartIcon className="text-blue-600" size={16} />
                سادساً: التطور المالي التراكمي وتدفق حركة الأرباح شهرياً (Monthly Trend)
              </span>
              <span className="text-[9.5px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md font-bold">تحليلات الأداء</span>
            </div>

            <div className="h-[230px] w-full" dir="ltr">
              {chronologicalMonthlyTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chronologicalMonthlyTrends}>
                    <defs>
                      <linearGradient id="trendSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="trendProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 8, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ direction: 'rtl', textAlign: 'right', fontSize: '10px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Area name="إجمالي المبيعات" type="monotone" dataKey="salesAmount" stroke="#2563eb" fillOpacity={1} fill="url(#trendSales)" strokeWidth={2.5} />
                    <Area name="الأرباح المحققة" type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#trendProfit)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 italic text-xs">لا تتوفر حركات بالمخطط التراكمي</div>
              )}
            </div>
          </div>
          
          <div className="border-t border-slate-50 dark:border-slate-800/80 pt-4 mt-2 flex justify-between items-center text-xs text-slate-500 font-bold">
            <span>متوسط مدة انتظار وبقاء السيارة مخزنة:</span>
            <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-xl font-mono text-xs">
              {averageStockRetentionDays} يوماً بالساحة قبل الخروج ⏱️
            </span>
          </div>
        </div>

        {/* SECTION SEVEN: STAGNATION & ROTATION RISK SPLITS */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-black text-slate-800 dark:text-slate-205 border-r-4 border-rose-500 pr-2.5 block">سبعاً: تصنيف ركود وتدوير رؤوس الأموال بالساحات</span>
            <p className="text-[10px] text-slate-400 mt-1">تجزئة السيولة المستثمرة المعلقة وتقييم المخاطر التشغيلية والمالية الكلية</p>

            <div className="h-[140px] w-full" dir="ltr">
              {rotationCategorySplits.distribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rotationCategorySplits.distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {rotationCategorySplits.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 italic text-xs">لا تتوفر بيانات للمطابقة</div>
              )}
            </div>

            <div className="space-y-1.5 mt-2">
              {rotationCategorySplits.distribution.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] font-bold">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {item.value} سيارة ({canViewFinancials ? `${(item.capital || 0).toLocaleString()} ريال` : '*****'})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/50 dark:border-slate-850 rounded-2xl text-[10px] flex items-center justify-between text-rose-700 dark:text-rose-400 font-bold">
            <span>⚠️ معدل ركود رأس المال:</span>
            <span>{rotationCategorySplits.stagnationRate}% من الأصول مجمدة</span>
          </div>
        </div>

      </div>

      {/* =========================================================================
         SECTION EIGHT: COMPREHENSIVE SALES RECOVERY SHEET
         ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-105-dark dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 print-section">
        <div className="flex items-center justify-between border-b border-slate-55 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-205 flex items-center gap-1.5">
              <ShoppingBag className="text-indigo-600" size={16} />
              ثامناً: التلخيص المتكامل لحركة المبيعات وصادرات الساحة
            </h3>
            <p className="text-[10px] text-slate-400">تقييم النتاج المالي الكلي، عوائد المركبات ومؤشرات الدفع التجاري للمؤسسة</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          
          <div className="p-4 bg-slate-50/55 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850/50">
            <span className="text-[10px] text-slate-400 block font-bold">المركبات المباعة (الصادرة)</span>
            <span className="text-lg font-black font-mono text-indigo-600 mt-1 block">{soldCars.length} سيارة</span>
          </div>

          <div className="p-4 bg-slate-50/55 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850/50">
            <span className="text-[10px] text-slate-400 block font-bold">إجمالي التدفق الوارد (الإيرادات)</span>
            <span className="text-base font-black font-mono text-slate-900 dark:text-white mt-1 block">
              {canViewFinancials ? `${(netSalesRevenue || 0).toLocaleString()} ريال` : '*****'}
            </span>
          </div>

          <div className="p-4 bg-slate-50/55 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850/50">
            <span className="text-[10px] text-slate-400 block font-bold">إجمالي الأرباح المحققة</span>
            <span className="text-base font-black font-mono text-emerald-600 mt- block text-emerald-600 mt-1 block">
              {canViewFinancials ? `${(netRealizedProfit || 0).toLocaleString()} ريال` : '*****'}
            </span>
          </div>

          <div className="p-4 bg-slate-50/55 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850/50">
            <span className="text-[10px] text-slate-400 block font-bold">متوسط العائد الربحي للسيارة</span>
            <span className="text-base font-black font-mono text-slate-900 dark:text-white mt-1 block">
              {canViewFinancials ? `${(avgProfitPerSale || 0).toLocaleString()} ريال` : '*****'}
            </span>
          </div>

          <div className="p-4 bg-slate-50/55 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850/50">
            <span className="text-[10px] text-slate-400 block font-bold">المصنع الأكثر مبيعاً ونفاذاً</span>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1.5 block truncate">{topBrandSalesLabel}</span>
          </div>

          <div className="p-4 bg-slate-50/55 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850/50">
            <span className="text-[10px] text-slate-400 block font-bold">الموديل الأكثر طلباً وصرفاً</span>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1.5 block truncate">{topModelSalesLabel}</span>
          </div>

        </div>
      </div>

      {/* =========================================================================
         SECTION NINE: REPRESENTATIVES PERFORMANCE RANKING BOARD (RANKING)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-section">
        
        {/* Delegates performance board */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-55 dark:border-slate-800 pb-3 mb-4">
              <span className="text-xs font-black text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
                <User className="text-blue-500" size={15} />
                تاسعاً: لوحة الشرف وأداء مناديب المعرض (Delegate Ranking Board)
              </span>
              <span className="text-[9.5px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">الرتب والإنتاجية</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-[10px]">
                    <th className="p-3 text-right">رقم / مندوب المبيعات المعتمد</th>
                    <th className="p-3">صادرات المبيعات (سيارة)</th>
                    <th className="p-3">الإيرادات المحصلة</th>
                    <th className="p-3">صافي الربح الفعلي للساحة</th>
                    <th className="p-3">لوحة الإنجاز %</th>
                  </tr>
                </thead>
                <tbody>
                  {representativesPerformanceRankList.map((rep, idx) => (
                    <tr key={rep.delegate} className="border-t border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50">
                      <td className="p-3 text-right font-bold text-slate-850 dark:text-slate-150 flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                          idx === 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {idx + 1}
                        </span>
                        {rep.delegate}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{rep.soldCount}</td>
                      <td className="p-3 font-mono text-indigo-650 dark:text-indigo-400">
                        {canViewFinancials ? `${rep.revenue.toLocaleString()} ريال` : '*****'}
                      </td>
                      <td className="p-3 font-mono text-emerald-650 font-bold">
                        {canViewFinancials ? `${rep.profitRealized.toLocaleString()} ريال` : '*****'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600" style={{ width: `${rep.achievementRate}%` }} />
                          </div>
                          <span className="font-mono text-[9px] text-slate-500">{rep.achievementRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {representativesPerformanceRankList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">لا توجد عمليات مبيعات مسجلة في هذا النطاق</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[9px] text-slate-400 leading-relaxed font-bold border-t border-slate-50 dark:border-slate-800/80 pt-3 mt-4">
            🏆 لوحة الشرف مبرمجة ومحدثة آلياً بالاستناد إلى حجم سقف المبیعات المحقّقة ونسب الدوران للسيولة النقدية مع التقيد بالفترات الممنهجة.
          </div>
        </div>

        {/* SECTION TEN: EXPECTED PROFITS FROM ACTIVE INVENTORY */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-black text-slate-800 dark:text-slate-205 border-r-4 border-emerald-500 pr-2.5 block text-emerald-650">عاشراً: تحليل الأرباح الكامنة والمتوقعة للمخزن الحالي</span>
            <p className="text-[10px] text-slate-400 mt-1">الربح المتوقع في حال تصفية المعروض الحالي مقارنة بالصرف الفعلي المحقق</p>

            <div className="space-y-2.5 pt-2">
              <div className="p-3.5 bg-emerald-50/50 dark:bg-slate-950/20 border border-emerald-100/40 dark:border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-450 block font-bold">الربح المتوقع للمخزون الحالي 💰</span>
                <h4 className="text-lg font-black font-mono text-emerald-600 mt-1">
                  {canViewFinancials ? `${(potentialExpectedStockProfit || 0).toLocaleString()} ريال` : '*****'}
                </h4>
                <p className="text-[8.5px] text-slate-400 mt-0.5">القيمة الكامنة بالأصل المعروض</p>
              </div>

              <div className="p-3.5 bg-slate-50/60 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-450 block font-bold">الربح المحقق كلياً (المسجل بالفترة)</span>
                <h4 className="text-base font-black font-mono text-slate-900 dark:text-white mt-1">
                  {canViewFinancials ? `${(totalProfitsRealized || 0).toLocaleString()} ريال` : '*****'}
                </h4>
                <p className="text-[8.5px] text-slate-400 mt-0.5">صافي الأرباح المحصلة من المبيعات</p>
              </div>
            </div>

            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 block pt-1 border-r-3 border-emerald-500 pr-1.5">السيارات الأعلى ربحية كامنة بالموقع:</span>
            <div className="space-y-1.5 overflow-y-auto max-h-[140px] pr-1">
              {topProfitableCarsInStock.map(item => (
                <div key={item.car.id} className="bg-slate-50/55 dark:bg-slate-950/10 p-2 rounded-xl text-[9px] flex justify-between items-center font-bold">
                  <span className="truncate max-w-[120px]">{formatVehicleDisplay(item.car)} ({item.car.year})</span>
                  <span className="font-mono text-emerald-600">+{canViewFinancials ? `${item.estMargin.toLocaleString()} ريال` : '*****'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[8.5px] text-slate-400 italic font-bold pt-2 mt-2 border-t border-slate-50 dark:border-slate-800/80">
            * تحتسب القيم المتوقعة بناءً على الفروقات المقيدة بين أسعار المبيعات المعلنة والتكاليف الإضافية الفعلية.
          </div>
        </div>

      </div>

    </div>
  );
};
