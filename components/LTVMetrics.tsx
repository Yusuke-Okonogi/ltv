'use client';

import { LTVMetrics } from '@/types/ltv';

interface LTVMetricsProps {
  metrics: LTVMetrics;
}

export default function LTVMetricsDisplay({ metrics }: LTVMetricsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 1) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const metricCards = [
    {
      title: '平均LTV',
      value: formatCurrency(metrics.averageLTV),
      description: '顧客1人あたりの平均生涯価値',
      color: 'bg-red-500',
    },
    {
      title: '中央値LTV',
      value: formatCurrency(metrics.medianLTV),
      description: 'LTVの中央値',
      color: 'bg-orange-500',
    },
    {
      title: '合計LTV',
      value: formatCurrency(metrics.totalLTV),
      description: '全顧客の合計生涯価値',
      color: 'bg-yellow-500',
    },
    {
      title: '顧客数',
      value: formatNumber(metrics.customerCount, 0),
      description: '分析対象の顧客数',
      color: 'bg-green-500',
    },
    {
      title: '平均購入額',
      value: formatCurrency(metrics.averagePurchaseValue),
      description: '1回の購入あたりの平均金額',
      color: 'bg-blue-500',
    },
    {
      title: '平均購入頻度',
      value: formatNumber(metrics.averagePurchaseFrequency, 1),
      description: '顧客1人あたりの平均購入回数',
      color: 'bg-purple-500',
    },
    {
      title: '平均顧客ライフスパン',
      value: `${formatNumber(metrics.averageCustomerLifespan, 0)}日`,
      description: '顧客の平均的な関係継続期間',
      color: 'bg-pink-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {metricCards.map((card, index) => (
        <div
          key={index}
          className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {card.title}
            </h3>
            <div className={`w-3 h-3 rounded-full ${card.color}`} />
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
            {card.value}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            {card.description}
          </p>
        </div>
      ))}
    </div>
  );
}
