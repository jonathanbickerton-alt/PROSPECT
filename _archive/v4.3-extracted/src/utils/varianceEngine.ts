import { parse, isValid, format } from 'date-fns';

export interface VarianceResult {
  absoluteVariance: number;
  percentageVariance: number;
  status: 'Under-forecast' | 'Over-forecast' | 'On-target';
}

export interface MergedVarianceData {
  Month: string;
  Customer_Segment: string;
  Product: string;
  Channel_Level_1: string;
  IBRO_Scenario_Type: string;
  Forecast_Type: string;
  
  actuals: any;
  forecasts: any;

  Revenue: VarianceResult;
  Subscribers: VarianceResult;
  Customers: VarianceResult;
  ARPU: VarianceResult;
}

function calculateVariance(actual: number, forecast: number): VarianceResult {
  const absoluteVariance = actual - forecast;
  const percentageVariance = forecast === 0 ? (actual === 0 ? 0 : (actual > 0 ? 100 : -100)) : (absoluteVariance / Math.abs(forecast)) * 100;
  
  let status: 'Under-forecast' | 'Over-forecast' | 'On-target' = 'On-target';
  if (absoluteVariance > 0) {
    status = 'Under-forecast'; // Actual is higher than forecast, so we under-forecasted
  } else if (absoluteVariance < 0) {
    status = 'Over-forecast'; // Actual is lower than forecast, so we over-forecasted
  }

  return {
    absoluteVariance,
    percentageVariance,
    status
  };
}

export function calculateForecastVsActualsVariance(forecasts: any[], actuals: any[]): MergedVarianceData[] {
  const mergedData: MergedVarianceData[] = [];

  // Create a map for quick lookup of actuals
  const actualsMap = new Map<string, any>();
  
  const normalizeKey = (val: any) => String(val || '').trim().toLowerCase();
  
  const normalizeDate = (val: any) => {
    if (!val) return '';
    const dateStr = String(val);
    let date = parse(dateStr, 'yyyy-MM-dd', new Date());
    if (!isValid(date)) {
      date = new Date(dateStr);
    }
    if (!isValid(date)) {
      // Handle Excel serial dates if needed
      const excelDate = Number(val);
      if (!isNaN(excelDate) && excelDate > 20000) {
        date = new Date((excelDate - (25567 + 1)) * 86400 * 1000);
      }
    }
    return isValid(date) ? format(date, 'yyyy-MM') : dateStr.trim().toLowerCase();
  };

  actuals.forEach(a => {
    const key = `${normalizeDate(a['Month'])}|${normalizeKey(a['Customer_Segment'])}|${normalizeKey(a['Product'])}|${normalizeKey(a['Channel_Level_1'])}`;
    actualsMap.set(key, a);
  });

  forecasts.forEach(f => {
    const actualsKey = `${normalizeDate(f['Month'])}|${normalizeKey(f['Customer_Segment'])}|${normalizeKey(f['Product'])}|${normalizeKey(f['Channel_Level_1'])}`;
    const a = actualsMap.get(actualsKey);

    const actualRevenue = a ? (Number(a['Monthly_Revenue_GBP']) || 0) : 0;
    const forecastRevenue = Number(f['Monthly Revenue']) || 0;

    const actualSubscribers = a ? (Number(a['Subscriber_Volume']) || 0) : 0;
    const forecastSubscribers = Number(f['Subscriber Volume']) || 0;

    const actualCustomers = a ? (Number(a['Customer_Volume']) || 0) : 0;
    const forecastCustomers = Number(f['Customer Volume']) || 0;

    const actualARPU = a ? (Number(a['ARPU']) || 0) : 0;
    const forecastARPU = Number(f['ARPU']) || 0;

    mergedData.push({
      Month: f['Month'],
      Customer_Segment: f['Customer_Segment'],
      Product: f['Product'],
      Channel_Level_1: f['Channel_Level_1'],
      IBRO_Scenario_Type: f['IBRO Scenario'] || f['IBRO_Scenario_Type'] || f['Scenario'] || 'Base',
      Forecast_Type: f['Forecast Type'] || f['Type'] || 'Forecast',
      actuals: a || {},
      forecasts: f,
      Revenue: calculateVariance(actualRevenue, forecastRevenue),
      Subscribers: calculateVariance(actualSubscribers, forecastSubscribers),
      Customers: calculateVariance(actualCustomers, forecastCustomers),
      ARPU: calculateVariance(actualARPU, forecastARPU)
    });
  });

  return mergedData;
}
