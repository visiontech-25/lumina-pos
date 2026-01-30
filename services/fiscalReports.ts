import type { FiscalReport, Sale, FiscalEvent } from '../types';
import { storeRepo } from './storeRepo';

export interface FiscalReportParams {
  storeId: string;
  type: FiscalReport['type'];
  startTime: string;
  endTime: string;
  generatedBy: string;
}

export async function generateFiscalReport(params: FiscalReportParams): Promise<FiscalReport> {
  const { storeId, type, startTime, endTime, generatedBy } = params;
  
  // Get all sales and events in the time window
  const sales = (await storeRepo.getCollection(storeId, 'sales', [])) as Sale[];
  const events = (await storeRepo.getCollection(storeId, 'events', [])) as FiscalEvent[];
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  const filteredSales = sales.filter(s => {
    const saleTime = new Date(s.timestamp);
    return saleTime >= start && saleTime <= end && s.status === 'completed';
  });
  
  const filteredEvents = events.filter(e => {
    const eventTime = new Date(e.timestamp);
    return eventTime >= start && eventTime <= end;
  });
  
  const refundEvents = filteredEvents.filter(e => e.type === 'SALE_REFUNDED');
  
  const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalTax = filteredSales.reduce((sum, s) => sum + (s.tax || 0), 0);
  const totalRefunds = refundEvents.reduce((sum, e) => sum + ((e.payload as any)?.refundAmount || 0), 0);
  const transactionCount = filteredSales.length;
  
  const report: FiscalReport = {
    id: `REP-${Date.now()}`,
    storeId,
    type,
    startTime,
    endTime,
    totalSales,
    totalTax,
    totalRefunds,
    transactionCount,
    generatedBy,
    generatedAt: new Date().toISOString()
  };
  
  // Save report
  const existingReports = await storeRepo.getFiscalReports(storeId);
  await storeRepo.setFiscalReports(storeId, [...existingReports, report]);
  
  return report;
}

export async function generateXReport(storeId: string, generatedBy: string): Promise<FiscalReport> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return generateFiscalReport({
    storeId,
    type: 'X_REPORT',
    startTime: startOfDay.toISOString(),
    endTime: now.toISOString(),
    generatedBy
  });
}

export async function generateZReport(storeId: string, generatedBy: string): Promise<FiscalReport> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const report = await generateFiscalReport({
    storeId,
    type: 'Z_REPORT',
    startTime: startOfDay.toISOString(),
    endTime: now.toISOString(),
    generatedBy
  });
  
  // Z-report typically closes the day - could trigger additional logic here
  return report;
}

export async function generateEndOfDayReport(storeId: string, generatedBy: string): Promise<FiscalReport> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return generateFiscalReport({
    storeId,
    type: 'END_OF_DAY',
    startTime: startOfDay.toISOString(),
    endTime: now.toISOString(),
    generatedBy
  });
}
