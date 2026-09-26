import { TOKEN_SYMBOL, explorerTx } from "@/lib/cluster";
import type { RewardRecord } from "@/lib/schemas";

const COLUMNS = "md:grid-cols-[1.2fr_2fr_0.8fr_0.8fr_1fr_0.6fr]";
const LINK = "underline decoration-ink-tertiary underline-offset-4 hover:text-accent hover:decoration-accent";

function formatDate(blockTime: number | null) {
  if (!blockTime) return "pending";
  return new Date(blockTime * 1000).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TripTable({ records }: { records: RewardRecord[] }) {
  return (
    <ol>
      <li className={`hidden gap-4 py-3 md:grid ${COLUMNS}`}>
        {["Date", "Session", "Minutes", "Events", TOKEN_SYMBOL, "Tx"].map((heading, i) => (
          <span key={heading} className={`kicker !text-[11px] !text-ink-tertiary ${i >= 2 ? "text-right" : ""}`}>
            {heading}
          </span>
        ))}
      </li>
      {records.map((record) => (
        <li
          key={record.signature}
          className={`grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line py-4 font-mono text-sm md:items-baseline ${COLUMNS}`}
        >
          <span className="text-ink-soft">{formatDate(record.blockTime)}</span>
          <span className="truncate text-right md:text-left">{record.s}</span>
          <span className="md:text-right">
            <span className="text-ink-tertiary md:hidden">min </span>
            {record.m}
          </span>
          <span className="text-right">
            <span className="text-ink-tertiary md:hidden">events </span>
            {record.e}
          </span>
          <span className="text-accent md:text-right">+{record.r.toLocaleString()}</span>
          <a href={explorerTx(record.signature)} target="_blank" rel="noreferrer" className={`text-right ${LINK}`}>
            {record.signature.slice(0, 4)}
          </a>
        </li>
      ))}
    </ol>
  );
}
