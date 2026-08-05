import { useMemo, useState } from 'react';
import type { RevenuePoint } from '../types/admin';

const fmtRand = (n: number) => `R${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Dependency-free bar chart for daily vendor revenue (gross + net).
 * Renders two stacked-ish series as bars with hover tooltips; a pure CSS
 * chart keeps the admin bundle lean (no chart library dependency).
 */
export default function RevenueChart({
  data,
  height = 180,
}: {
  data: RevenuePoint[];
  height?: number;
}) {
  const [hover, setHover] = useState<RevenuePoint | null>(null);

  const bars = useMemo(() => {
    const max = Math.max(1, ...data.map((d) => Math.max(d.gross, d.net)));
    return data.map((d) => ({
      ...d,
      grossH: Math.round((d.gross / max) * 100),
      netH: Math.round((d.net / max) * 100),
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400">
        No revenue data in this window yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Revenue Over Time</h3>
          <p className="text-xs text-slate-400">
            Daily net (green) vs gross (blue) from completed payments
          </p>
        </div>
        {hover && (
          <div className="rounded-lg bg-slate-800 px-3 py-1.5 text-right text-xs text-white">
            <p className="font-semibold">{hover.day}</p>
            <p>
              Net {fmtRand(hover.net)} · Gross {fmtRand(hover.gross)}
            </p>
          </div>
        )}
      </div>
      <div
        className="flex items-end gap-[2px]"
        style={{ height }}
        role="img"
        aria-label="Daily revenue bar chart"
      >
        {bars.map((b) => (
          <div
            key={b.day}
            className="group relative flex flex-1 flex-col items-center justify-end"
            onMouseEnter={() => setHover(b)}
            onMouseLeave={() => setHover(null)}
          >
            {/* Net bar (overlay on gross) */}
            <div
              className="w-full rounded-t-sm bg-emerald-500 transition-opacity group-hover:opacity-90"
              style={{ height: `${b.netH}%`, opacity: b.net > 0 ? 1 : 0 }}
              title={`${b.day} net ${fmtRand(b.net)}`}
            />
            {/* Gross bar (behind net) */}
            <div
              className="absolute bottom-0 w-full rounded-t-sm bg-blue-200"
              style={{ height: `${b.grossH}%` }}
            />
          </div>
        ))}
      </div>
      {/* X axis labels (first, middle, last) */}
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{bars[0]?.day}</span>
        <span>{bars[Math.floor(bars.length / 2)]?.day}</span>
        <span>{bars[bars.length - 1]?.day}</span>
      </div>
    </div>
  );
}
