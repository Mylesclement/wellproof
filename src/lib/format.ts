export const fmtBbl = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

// Reading dates are calendar days with no time zone. Format them in UTC so a
// server in another zone never shifts them by a day.
export const fmtDay = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" });

export const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";

// "Today" for a field. All v1 fields are in Nigeria, so use Lagos time; a
// reading for today becomes possible at midnight there, not midnight UTC.
export const todayInField = (timeZone = "Africa/Lagos") => new Date().toLocaleDateString("en-CA", { timeZone });
