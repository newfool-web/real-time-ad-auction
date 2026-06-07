import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import type { ReactNode } from "react";
import { Metrics } from "../types";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 px-5 py-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

const tooltipStyle = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 };

export function MetricsPanel({
  metrics,
  winHistory,
}: {
  metrics: Metrics | null;
  winHistory: { t: number; price: number }[];
}) {
  const bidders = (metrics?.bidders ?? []).map((b) => ({ ...b, name: b.bidderName }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Total Auctions" value={String(metrics?.totalAuctions ?? 0)} />
        <Stat label="Fill Rate" value={`${metrics?.fillRate ?? 0}%`} sub="auctions with a winner" />
        <Stat label="Avg Latency" value={`${metrics?.avgLatencyMs ?? 0} ms`} sub="deadline 100 ms" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Wins by Advertiser">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bidders} margin={{ top: 8, right: 8, left: -16, bottom: 28 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1e293b55" }} />
              <Bar dataKey="wins" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Clearing Price (recent wins)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={winHistory.map((w, i) => ({ i, price: w.price }))}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="i" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="price" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Advertiser Budgets">
          <div className="space-y-3 pt-1">
            {bidders.length === 0 && <div className="text-sm text-slate-600">No data yet</div>}
            {bidders.map((b) => {
              // initial = remaining + spent (pacing-service spend ko budget se kaata hai).
              const initial = Math.round(b.budgetRemaining + b.spend) || 1;
              const remaining = Math.max(0, b.budgetRemaining);
              const pct = Math.min(100, (remaining / initial) * 100);
              const low = pct < 20; // budget khatam hone wala hai
              return (
                <div key={b.bidderId}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-slate-300">{b.name}</span>
                    <span className="font-mono text-slate-400">
                      ${remaining.toFixed(2)} / ${initial} · {b.wins} wins
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        low
                          ? "bg-gradient-to-r from-amber-500 to-red-500"
                          : "bg-gradient-to-r from-indigo-500 to-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
      <div className="text-[13px] font-medium text-slate-200 mb-3">{title}</div>
      {children}
    </div>
  );
}
