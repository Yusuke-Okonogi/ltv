'use client';

import { TimeSeriesData } from '@/types/ltv';
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

interface LTVChartsProps {
  timeSeriesData: TimeSeriesData[];
}

export default function LTVCharts({ timeSeriesData }: LTVChartsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="space-y-8">
      {/* LTV推移グラフ */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          LTV推移
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              // valueが number または undefined でも受け取れるようにし、
              // undefined の場合は 0 として扱うように修正
              formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
              labelFormatter={(label) => `日付: ${label}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="ltv"
              stroke="#ef4444"
              strokeWidth={2}
              name="平均LTV"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 売上推移グラフ */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          売上推移
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
              labelFormatter={(label) => `日付: ${label}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#f97316" name="売上" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 顧客獲得数推移グラフ */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          顧客獲得数推移
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#71717a"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
            <Tooltip
              formatter={(value: number | undefined) => `${value ?? 0}人`}
              labelFormatter={(label) => `日付: ${label}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Bar dataKey="customers" fill="#3b82f6" name="顧客数" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
