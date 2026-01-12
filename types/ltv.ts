export interface CustomerData {
  customerId: string;
  acquisitionDate: string;
  totalRevenue: number;
  purchaseCount: number;
  lastPurchaseDate: string;
}

export interface LTVMetrics {
  averageLTV: number;
  medianLTV: number;
  totalLTV: number;
  customerCount: number;
  averagePurchaseValue: number;
  averagePurchaseFrequency: number;
  averageCustomerLifespan: number;
}

export interface TimeSeriesData {
  date: string;
  ltv: number;
  revenue: number;
  customers: number;
}

export interface OrderData {
  orderDate: string;
  customerId: string;
  amount: number;
  [key: string]: string | number; // その他のCSV列に対応
}

export interface MonthlyData {
  month: string; // YYYY-MM形式
  revenue: number;
  customerCount: number;
  averageLTV: number; // その月の顧客一人あたりの平均購入金額
}
