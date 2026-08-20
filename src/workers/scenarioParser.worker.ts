import * as XLSX from 'xlsx';
import { rowsOrEmpty } from '../utils/sheetGuards';

export interface ParseRequest {
  fileBuffers: ArrayBuffer[];
  fileNames: string[];
}

export interface ParsedSession {
  fileName: string;
  baselineRows: any[];
  marketEvents: any[];
  yieldEvents: any[];
  pricingEvents: any[];
  // Extract unique dimension values for the filter bar
  segments: string[];
  products: string[];
  channels: string[];
}

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  const { fileBuffers, fileNames } = e.data;
  
  const results: ParsedSession[] = [];
  
  for (let i = 0; i < fileBuffers.length; i++) {
    const buffer = fileBuffers[i];
    const fileName = fileNames[i];
    
    // Read only the specific sheets we need (skipping massive Actuals sheet)
    const wb = XLSX.read(buffer, { 
      type: 'array', 
      cellDates: false, 
      sheets: ['Baseline_Forecasts', 'Market_Events', 'Yield_Events', 'Pricing_Events'] 
    });
    
    // THE SHARED PARSE BOUNDARY. Every Compare consumer reads its rows from
    // here — the chart series, the filter populate and the per-file events
    // panels — so the placeholder skip belongs at this one point rather than
    // in each of them. A sheet the app exported as a placeholder yields an
    // EMPTY array: absence, not an error, and not a phantom event.
    const parseSheet = (sheetName: string): any[] => {
      if (!wb.Sheets[sheetName]) return [];
      return rowsOrEmpty(XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as any[]);
    };
    
    const baselineRows = parseSheet('Baseline_Forecasts');
    const marketEvents = parseSheet('Market_Events');
    const yieldEvents = parseSheet('Yield_Events');
    const pricingEvents = parseSheet('Pricing_Events');
    
    const segments = Array.from(new Set(baselineRows.map(r => r.Segment))).filter(Boolean) as string[];
    const products = Array.from(new Set(baselineRows.map(r => r.Product))).filter(Boolean) as string[];
    const channels = Array.from(new Set(baselineRows.map(r => r.Channel))).filter(Boolean) as string[];
    
    results.push({
      fileName,
      baselineRows,
      marketEvents,
      yieldEvents,
      pricingEvents,
      segments,
      products,
      channels
    });
  }
  
  self.postMessage(results);
};
