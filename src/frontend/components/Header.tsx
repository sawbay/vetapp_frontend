import { WalletSelector } from "./WalletSelector";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const relativeTimeUnits: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 365 * 24 * 60 * 60 },
  { unit: "month", seconds: 30 * 24 * 60 * 60 },
  { unit: "week", seconds: 7 * 24 * 60 * 60 },
  { unit: "day", seconds: 24 * 60 * 60 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

const formatRelativeTime = (timestamp: string) => {
  if (timestamp === "unknown") {
    return null;
  }
  const committedAt = new Date(timestamp);
  if (Number.isNaN(committedAt.getTime())) {
    return null;
  }
  const diffSeconds = Math.round((Date.now() - committedAt.getTime()) / 1000);
  const absoluteDiff = Math.abs(diffSeconds);
  for (const timeUnit of relativeTimeUnits) {
    if (absoluteDiff >= timeUnit.seconds || timeUnit.unit === "second") {
      const value = Math.round(diffSeconds / timeUnit.seconds);
      return relativeTimeFormatter.format(-value, timeUnit.unit);
    }
  }
  return null;
};

export function Header() {
  const commitHash = __COMMIT_HASH__;
  const commitMessage = __COMMIT_MESSAGE__;
  const commitTimestamp = __COMMIT_TIMESTAMP__;
  const commitRelativeTime = formatRelativeTime(commitTimestamp);
  const showCommitInfo = commitHash !== "unknown" && commitMessage !== "unknown";

  return (
    <div className="flex items-center justify-between px-4 py-2 max-w-screen-xl mx-auto w-full flex-wrap">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="display">ve(3,3) TAPP</h1>
        {showCommitInfo ? (
          <span className="text-xs text-muted-foreground">
            <b>Built commit</b> {commitHash} — {commitMessage}
            {commitRelativeTime ? <span> · {commitRelativeTime}</span> : null}
          </span>
        ) : null}
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <WalletSelector />
      </div>
    </div>
  );
}
