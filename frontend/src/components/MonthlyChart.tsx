import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';

interface MonthData {
  month: string;  // 'YYYY-MM'
  total: number;
}

interface Props {
  months: MonthData[];
  currency?: string;
}

function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function formatCurrency(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const CURRENT_MONTH = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

export function MonthlyChart({ months, currency = 'USD' }: Props) {
  // Build cumulative total alongside monthly totals
  let running = 0;
  const chartData = months.map(m => {
    running += m.total;
    return {
      ...m,
      label: formatMonth(m.month),
      isCurrent: m.month === CURRENT_MONTH,
      cumulative: parseFloat(running.toFixed(2)),
    };
  });

  const hasData = months.some(m => m.total > 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        {/* Left axis — monthly spend */}
        <YAxis
          yAxisId="monthly"
          tickFormatter={v => formatCurrency(v, currency)}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        {/* Right axis — cumulative */}
        <YAxis
          yAxisId="cumulative"
          orientation="right"
          tickFormatter={v => formatCurrency(v, currency)}
          tick={{ fontSize: 11, fill: '#c7d2fe' }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value), currency),
            name === 'total' ? 'Monthly spend' : 'Cumulative',
          ]}
          labelStyle={{ fontWeight: 600 }}
          contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e5e7eb', fontSize: 13 }}
        />
        {hasData && (
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => value === 'total' ? 'Monthly' : 'Cumulative'}
            wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }}
          />
        )}
        <Bar yAxisId="monthly" dataKey="total" radius={[4, 4, 0, 0]} name="total">
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isCurrent ? '#6366f1' : '#c7d2fe'}
            />
          ))}
        </Bar>
        {hasData && (
          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulative"
            stroke="#818cf8"
            strokeWidth={2}
            dot={{ r: 3, fill: '#818cf8', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#6366f1' }}
            name="cumulative"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
