import type { ReactNode } from "react";
import { AuctionView } from "../hooks/useAuctionSocket";
import { AuctionResult, BidRow, BidderMetric } from "../types";

// NO_BID / reject reasons ko aam-bhasha me badalte hain.
function humanReason(reason?: string): string {
  switch (reason) {
    case "TARGETING_MISS":
      return "Not their audience";
    case "INSUFFICIENT_BUDGET":
      return "Out of budget";
    case "BELOW_FLOOR":
      return "Below floor";
    case "TIMEOUT":
      return "Too slow (>100ms)";
    case "ERROR":
      return "Error";
    default:
      return reason ?? "No bid";
  }
}

// "bidder-sports" -> "Sports"
function pretty(id: string): string {
  const s = id.replace(/^bidder-/, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const CARD =
  "rounded-xl bg-slate-900 border border-slate-800 p-5 flex flex-col min-h-[300px]";

function StageHeader({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-md bg-indigo-600/90 text-white text-xs flex items-center justify-center font-semibold">
          {n}
        </span>
        <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-200">
          {title}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 mt-1.5 pl-[34px]">{hint}</p>
    </div>
  );
}

export function AuctionFlow({
  view,
  winning,
  bidders,
}: {
  view: AuctionView | null;
  winning: AuctionResult | null;
  bidders: BidderMetric[];
}) {
  const req = view?.request;
  const rowById = new Map<string, BidRow>();
  view?.bids.forEach((b) => rowById.set(b.bidderId, b));
  const winnerId = view?.result?.winnerId ?? null;
  // id -> brand name (metrics se, warna bid se, warna prettified id).
  const nameById = new Map<string, string>();
  bidders.forEach((b) => nameById.set(b.bidderId, b.bidderName));
  view?.bids.forEach((b) => {
    if (!nameById.has(b.bidderId)) nameById.set(b.bidderId, b.bidderName);
  });
  const displayName = (id: string) => nameById.get(id) ?? pretty(id);
  const roster =
    bidders.length > 0
      ? bidders.map((b) => b.bidderId)
      : Array.from(new Set(view?.bids.map((b) => b.bidderId) ?? []));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* STAGE 1 — Publisher request */}
      <div className={CARD}>
        <StageHeader n={1} title="Ad Request" hint="Publisher offers an ad slot for sale" />
        {req ? (
          <div className="flex-1 flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ad slot" value={req.slotSize} mono />
              <Field label="Floor price" value={`$${req.floorPrice.toFixed(2)}`} mono accent="amber" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                User profile
              </div>
              <div className="flex flex-wrap gap-1.5">
                {req.user.interests.map((i) => (
                  <Chip key={i} tone="sky">{i}</Chip>
                ))}
                <Chip>{req.user.device}</Chip>
                <Chip>{req.user.country}</Chip>
              </div>
            </div>
            <div className="mt-auto rounded-lg bg-slate-800/40 border border-slate-800 px-3 py-2 text-[12px] text-slate-400">
              Sent to all advertisers simultaneously with a 100&nbsp;ms response deadline.
            </div>
          </div>
        ) : (
          <Placeholder text="Waiting for a visit" />
        )}
      </div>

      {/* STAGE 2 — Advertiser responses */}
      <div className={CARD}>
        <StageHeader n={2} title="Advertiser Bids" hint="Each advertiser decides: bid or pass" />
        {view ? (
          <div className="flex-1 flex flex-col gap-2">
            {roster.map((id) => (
              <BidderLine key={id} name={displayName(id)} row={rowById.get(id)} isWinner={winnerId === id} />
            ))}
            <div className="mt-auto pt-2 text-[12px] text-slate-500">
              {view.bids.length}/{roster.length} responded
            </div>
          </div>
        ) : (
          <Placeholder text="No auction running" />
        )}
      </div>

      {/* STAGE 3 — Auction result */}
      <div className={CARD}>
        <StageHeader n={3} title="Auction" hint="Highest bid wins, pays second price" />
        {view?.result ? (
          view.result.filled ? (
            <div className="flex-1 flex flex-col gap-3 text-sm">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-700/60 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-emerald-500/80">Winner</div>
                <div className="font-semibold text-emerald-300 text-base">{view.result.winnerName}</div>
              </div>
              <Field label="Highest bid" value={`$${view.result.winningBid.toFixed(2)}`} mono />
              <Field
                label="Clearing price"
                value={`$${view.result.clearingPrice.toFixed(2)}`}
                mono
                accent="emerald"
              />
              <div className="mt-auto rounded-lg bg-slate-800/40 border border-slate-800 px-3 py-2 text-[12px] text-slate-400">
                Second-price (Vickrey): winner pays the runner-up bid + $0.01.
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <div className="text-slate-300 font-medium">No fill</div>
                <div className="text-[12px] text-slate-500 mt-1">No valid bid above the floor price.</div>
              </div>
            </div>
          )
        ) : (
          <Placeholder text={view ? "Resolving" : "No result yet"} />
        )}
      </div>

      {/* STAGE 4 — Served creative */}
      <div className={CARD}>
        <StageHeader n={4} title="Ad Served" hint="Winning creative rendered on the page" />
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full aspect-[4/3] max-h-[180px] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center bg-slate-950">
              {winning?.filled && winning.creative ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-4 text-center">
                  <div className="font-semibold leading-snug">{winning.creative.title}</div>
                  <div className="text-[11px] mt-2 opacity-80">{winning.winnerName}</div>
                </div>
              ) : (
                <span className="text-slate-600 text-xs">Empty ad slot</span>
              )}
            </div>
          </div>
          {winning?.filled && (
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <span className="text-slate-500">Revenue to publisher</span>
              <span className="font-mono text-emerald-400">${winning.clearingPrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "amber" | "emerald";
}) {
  const color = accent === "amber" ? "text-amber-400" : accent === "emerald" ? "text-emerald-400" : "text-slate-200";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${color} text-sm`}>{value}</span>
    </div>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone?: "sky" }) {
  const cls = tone === "sky" ? "bg-sky-500/15 text-sky-300" : "bg-slate-800 text-slate-300";
  return <span className={`text-[11px] px-2 py-0.5 rounded ${cls}`}>{children}</span>;
}

function BidderLine({ name, row, isWinner }: { name: string; row?: BidRow; isWinner: boolean }) {
  const bid = row?.status === "BID";
  const base = "flex items-center justify-between text-sm rounded-lg px-3 py-2.5 border-l-2";
  const tone = isWinner
    ? "bg-emerald-500/10 border-l-emerald-500"
    : bid
      ? "bg-slate-800/60 border-l-slate-600"
      : "bg-slate-800/25 border-l-transparent text-slate-500";
  return (
    <div className={`${base} ${tone}`}>
      <span className="flex items-center gap-2 min-w-0">
        <span className={isWinner ? "font-semibold text-slate-100" : ""}>{name}</span>
        {isWinner && (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
            Winner
          </span>
        )}
      </span>
      {!row ? (
        <span className="text-[11px] text-slate-600">waiting</span>
      ) : bid ? (
        <span className="flex items-center gap-3 font-mono text-[12px]">
          <span className="text-sky-400">CTR {(row.predictedCtr * 100).toFixed(1)}%</span>
          <span className="text-emerald-400 font-semibold">${row.price.toFixed(2)}</span>
          <span className="text-slate-500">{row.latencyMs}ms</span>
        </span>
      ) : (
        <span className="text-[12px] italic text-slate-500">{humanReason(row.reason)}</span>
      )}
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <div className="flex-1 flex items-center justify-center text-sm text-slate-600">{text}</div>;
}
