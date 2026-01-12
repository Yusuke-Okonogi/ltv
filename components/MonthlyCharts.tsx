'use client';

import { MonthlyData } from '@/types/ltv';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MonthlyChartsProps {
  monthlyData: MonthlyData[];
}

export default function MonthlyCharts({ monthlyData }: MonthlyChartsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split('-');
    return `${year}年${parseInt(month)}月`;
  };

  return (
    <div className="space-y-8">
      {/* 月別売上推移グラフ */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          月別売上推移
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `期間: ${formatMonth(label)}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#ef4444" name="売上" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 顧客一人あたりの平均購入金額（LTV）推移グラフ */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          月別顧客一人あたり平均購入金額（LTV）
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `期間: ${formatMonth(label)}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="averageLTV"
              stroke="#f97316"
              strokeWidth={3}
              name="平均LTV"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 月別顧客数推移グラフ */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          月別顧客数推移
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
            <Tooltip
              formatter={(value: number) => `${value}人`}
              labelFormatter={(label) => `期間: ${formatMonth(label)}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Bar dataKey="customerCount" fill="#3b82f6" name="顧客数" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
