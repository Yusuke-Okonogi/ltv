import { CustomerData, LTVMetrics, TimeSeriesData, MonthlyData } from '@/types/ltv';

/**
 * 顧客のLTV（Lifetime Value）を計算
 */
export function calculateCustomerLTV(customer: CustomerData): number {
  return customer.totalRevenue;
}

/**
 * 複数の顧客データからLTVメトリクスを計算
 */
export function calculateLTVMetrics(customers: CustomerData[]): LTVMetrics {
  if (customers.length === 0) {
    return {
      averageLTV: 0,
      medianLTV: 0,
      totalLTV: 0,
      customerCount: 0,
      averagePurchaseValue: 0,
      averagePurchaseFrequency: 0,
      averageCustomerLifespan: 0,
    };
  }

  const ltvValues = customers.map(calculateCustomerLTV).sort((a, b) => a - b);
  const totalLTV = ltvValues.reduce((sum, ltv) => sum + ltv, 0);
  const averageLTV = totalLTV / customers.length;
  const medianLTV = ltvValues.length % 2 === 0
    ? (ltvValues[ltvValues.length / 2 - 1] + ltvValues[ltvValues.length / 2]) / 2
    : ltvValues[Math.floor(ltvValues.length / 2)];

  const totalRevenue = totalLTV;
  const totalPurchases = customers.reduce((sum, c) => sum + c.purchaseCount, 0);
  const averagePurchaseValue = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;
  const averagePurchaseFrequency = customers.length > 0 ? totalPurchases / customers.length : 0;

  // 顧客の平均ライフスパン（日数）を計算
  const now = new Date();
  const lifespans = customers.map(customer => {
    const acquisition = new Date(customer.acquisitionDate);
    const lastPurchase = new Date(customer.lastPurchaseDate);
    return Math.max(
      (lastPurchase.getTime() - acquisition.getTime()) / (1000 * 60 * 60 * 24),
      1
    );
  });
  const averageCustomerLifespan = lifespans.reduce((sum, lifespan) => sum + lifespan, 0) / lifespans.length;

  return {
    averageLTV,
    medianLTV,
    totalLTV,
    customerCount: customers.length,
    averagePurchaseValue,
    averagePurchaseFrequency,
    averageCustomerLifespan,
  };
}

/**
 * 時系列データを生成
 */
export function generateTimeSeriesData(customers: CustomerData[]): TimeSeriesData[] {
  const dataMap = new Map<string, { revenue: number; customers: Set<string> }>();

  customers.forEach(customer => {
    const acquisitionDate = new Date(customer.acquisitionDate).toISOString().split('T')[0];
    const existing = dataMap.get(acquisitionDate) || { revenue: 0, customers: new Set() };
    existing.revenue += customer.totalRevenue;
    existing.customers.add(customer.customerId);
    dataMap.set(acquisitionDate, existing);
  });

  return Array.from(dataMap.entries())
    .map(([date, data]) => ({
      date,
      ltv: data.revenue / data.customers.size,
      revenue: data.revenue,
      customers: data.customers.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * サンプルデータを生成
 */
export function generateSampleData(): CustomerData[] {
  const customers: CustomerData[] = [];
  const now = new Date();

  for (let i = 1; i <= 100; i++) {
    const daysAgo = Math.floor(Math.random() * 365);
    const acquisitionDate = new Date(now);
    acquisitionDate.setDate(acquisitionDate.getDate() - daysAgo);

    const purchaseCount = Math.floor(Math.random() * 20) + 1;
    const totalRevenue = Math.floor(Math.random() * 50000) + 1000;
    
    const lastPurchaseDaysAgo = Math.floor(Math.random() * daysAgo);
    const lastPurchaseDate = new Date(now);
    lastPurchaseDate.setDate(lastPurchaseDate.getDate() - lastPurchaseDaysAgo);

    customers.push({
      customerId: `CUST-${String(i).padStart(4, '0')}`,
      acquisitionDate: acquisitionDate.toISOString().split('T')[0],
      totalRevenue: totalRevenue,
      purchaseCount: purchaseCount,
      lastPurchaseDate: lastPurchaseDate.toISOString().split('T')[0],
    });
  }

  return customers;
}

/**
 * 月別の売上推移とLTVを計算
 */
export function calculateMonthlyData(customers: CustomerData[]): MonthlyData[] {
  const monthlyMap = new Map<string, {
    revenue: number;
    customerIds: Set<string>;
    customerRevenues: Map<string, number>; // 顧客ごとのその月の購入金額
  }>();

  // 各顧客の購入履歴を月別に集計
  customers.forEach(customer => {
    // 顧客の最初の購入日から最後の購入日までを月別に分割
    const startDate = new Date(customer.acquisitionDate);
    const endDate = new Date(customer.lastPurchaseDate);
    
    // 簡易的に、顧客の総購入金額を購入回数で割って、各購入の平均金額を計算
    const averagePurchaseAmount = customer.totalRevenue / customer.purchaseCount;
    
    // 購入日を推定（簡易版：最初の購入日から等間隔で配置）
    const daysDiff = Math.max(1, Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ));
    const daysPerPurchase = Math.max(1, Math.floor(daysDiff / customer.purchaseCount));

    for (let i = 0; i < customer.purchaseCount; i++) {
      const purchaseDate = new Date(startDate);
      purchaseDate.setDate(purchaseDate.getDate() + (i * daysPerPurchase));
      
      const monthKey = `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, '0')}`;
      
      const existing = monthlyMap.get(monthKey) || {
        revenue: 0,
        customerIds: new Set(),
        customerRevenues: new Map(),
      };

      existing.revenue += averagePurchaseAmount;
      existing.customerIds.add(customer.customerId);
      
      const currentCustomerRevenue = existing.customerRevenues.get(customer.customerId) || 0;
      existing.customerRevenues.set(customer.customerId, currentCustomerRevenue + averagePurchaseAmount);

      monthlyMap.set(monthKey, existing);
    }
  });

  // MonthlyData配列に変換
  const monthlyData: MonthlyData[] = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      revenue: data.revenue,
      customerCount: data.customerIds.size,
      averageLTV: data.customerIds.size > 0 
        ? Array.from(data.customerRevenues.values()).reduce((sum, rev) => sum + rev, 0) / data.customerIds.size
        : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return monthlyData;
}

/**
 * 注文データから直接月別データを計算（より正確な方法）
 */
export function calculateMonthlyDataFromOrders(
  orders: Array<{ orderDate: string; customerId: string; amount: number }>
): MonthlyData[] {
  const monthlyMap = new Map<string, {
    revenue: number;
    customerRevenues: Map<string, number>; // 顧客ごとのその月の購入金額
  }>();

  orders.forEach(order => {
    const orderDate = new Date(order.orderDate);
    const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
    
    const existing = monthlyMap.get(monthKey) || {
      revenue: 0,
      customerRevenues: new Map(),
    };

    existing.revenue += order.amount;
    
    const currentCustomerRevenue = existing.customerRevenues.get(order.customerId) || 0;
    existing.customerRevenues.set(order.customerId, currentCustomerRevenue + order.amount);

    monthlyMap.set(monthKey, existing);
  });

  // MonthlyData配列に変換
  const monthlyData: MonthlyData[] = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      revenue: data.revenue,
      customerCount: data.customerRevenues.size,
      averageLTV: data.customerRevenues.size > 0 
        ? Array.from(data.customerRevenues.values()).reduce((sum, rev) => sum + rev, 0) / data.customerRevenues.size
        : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return monthlyData;
}
