import { useState } from "react";
import { useAuctionSocket } from "./hooks/useAuctionSocket";
import { AuctionFlow } from "./components/AuctionFlow";
import { MetricsPanel } from "./components/MetricsPanel";
import { simulateVisit, setTraffic } from "./api";

const AUTO_TRAFFIC_DISABLED = true;

export default function App() {
  const { connected, current, winningCreative, metrics, winHistory } = useAuctionSocket();
  const [auto, setAuto] = useState(false);
  const [showTrafficDisabled, setShowTrafficDisabled] = useState(false);

  const toggleTraffic = async () => {
    if (AUTO_TRAFFIC_DISABLED) {
      setShowTrafficDisabled(true);
      return;
    }

    const next = !auto;
    setAuto(next);
    await setTraffic(next ? 1 : 0);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Real-Time Ad Auction Engine</h1>
            <p className="text-[13px] text-slate-400">
              Second-price RTB simulation with a 100&nbsp;ms bidding deadline and ML-driven bids
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs text-slate-400 px-3 py-1.5 rounded-md bg-slate-800/60 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
              {connected ? "Live" : "Offline"}
            </span>
            <button
              onClick={() => simulateVisit()}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 transition text-sm font-medium"
            >
              Simulate Visit
            </button>
            <button
              type="button"
              onClick={toggleTraffic}
              aria-disabled={AUTO_TRAFFIC_DISABLED}
              className={`px-4 py-2 rounded-md text-sm font-medium transition border ${
                AUTO_TRAFFIC_DISABLED
                  ? "bg-slate-800/60 border-slate-700 text-slate-400 cursor-not-allowed hover:bg-slate-800/60"
                  : auto
                    ? "bg-red-600/90 hover:bg-red-600 border-transparent"
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700"
              }`}
            >
              {auto ? "Stop Auto Traffic" : "Auto Traffic"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-8 py-7 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-300">
              Auction Pipeline
            </h2>
            <p className="text-[12px] text-slate-500">
              Read left to right. Advertisers may pass when the user is not their audience.
            </p>
          </div>
          <AuctionFlow view={current} winning={winningCreative} bidders={metrics?.bidders ?? []} />
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-300 mb-4">
            Live Metrics
          </h2>
          <MetricsPanel metrics={metrics} winHistory={winHistory} />
        </section>
      </main>

      {showTrafficDisabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">Auto Traffic Disabled</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              This button is disabled because of irregular practice by users.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTrafficDisabled(false)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
