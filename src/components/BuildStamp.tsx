const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Match the games' build stamp using UTC, independent of browser locale.
export function BuildStamp() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  const commit = process.env.NEXT_PUBLIC_APP_COMMIT;
  const stamp = process.env.NEXT_PUBLIC_APP_BUILT_AT;
  const parts = stamp?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})Z$/);
  const month = parts && MONTHS[Number(parts[2]) - 1];
  const built = parts && month ? `${Number(parts[3])} ${month} ${parts[4]}` : null;
  if (!version) return null;
  return (
    <span className="build-stamp" title={commit || undefined}>
      v{version}
      {commit ? ` · ${commit.slice(0, 7)}` : null}
      {built ? <> · <time dateTime={stamp} title={stamp}>{built}</time></> : null}
    </span>
  );
}
