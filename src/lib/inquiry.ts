// The public forms: pilot sign-ups for three kinds of partner, plus contact.
// Each track lists its extra questions here, so the form and the checks
// below stay in step.

export type InquiryKind = "pilot_operator" | "pilot_lender" | "pilot_partner" | "contact";

export type Question =
  | { key: string; label: string; type: "select"; options: string[]; required?: boolean }
  | { key: string; label: string; type: "checkboxes"; options: string[] };

export const TRACKS: Record<
  Exclude<InquiryKind, "contact">,
  { slug: string; title: string; who: string; offer: string; questions: Question[]; messageLabel: string }
> = {
  pilot_operator: {
    slug: "operator",
    title: "Operators",
    who: "Indigenous operators and field owners producing oil or gas.",
    offer:
      "Free use of the platform during the pilot, help setting up your fields and measurement points, and a shareable record you can show lenders and partners.",
    questions: [
      { key: "fields", label: "How many producing fields?", type: "select", options: ["1", "2 to 5", "6 or more"], required: true },
      { key: "terrain", label: "Where are they?", type: "checkboxes", options: ["Onshore", "Swamp", "Shallow offshore", "Deep offshore"] },
      {
        key: "recording",
        label: "How do you record daily production today?",
        type: "select",
        options: ["Paper", "Excel or spreadsheets", "Production software", "Other"],
        required: true,
      },
      { key: "raising", label: "Raising funds in the next 12 months?", type: "select", options: ["Yes", "No", "Not sure"], required: true },
    ],
    messageLabel: "Anything else we should know?",
  },
  pilot_lender: {
    slug: "lender",
    title: "Lenders and investors",
    who: "Banks, development lenders, funds, and offtakers who finance producers.",
    offer:
      "Free read-only access to the records of pilot operators who choose to share with you, and a say in what the lender view shows.",
    questions: [
      {
        key: "institution",
        label: "Type of institution",
        type: "select",
        options: ["Commercial bank", "Development finance institution", "Private equity or fund", "Trader or offtaker", "Other"],
        required: true,
      },
    ],
    messageLabel: "What do you need to see before you lend to a producer?",
  },
  pilot_partner: {
    slug: "partner",
    title: "Metering and data partners",
    who: "Metering hardware makers, measurement and inspection firms, and data providers.",
    offer:
      "Integration of your measurements into the record, so readings come straight from an independent source instead of being typed in by the operator.",
    questions: [
      {
        key: "partnerType",
        label: "What do you provide?",
        type: "select",
        options: ["Metering hardware", "Measurement or inspection services", "Software or data", "Other"],
        required: true,
      },
    ],
    messageLabel: "How could your data or equipment feed a verified record?",
  },
};

export const trackBySlug = (slug?: string) =>
  (Object.entries(TRACKS) as [keyof typeof TRACKS, (typeof TRACKS)[keyof typeof TRACKS]][]).find(([, t]) => t.slug === slug)?.[0];

export type InquiryRow = {
  kind: InquiryKind;
  name: string;
  email: string;
  organization: string | null;
  role: string | null;
  country: string | null;
  details: Record<string, string | string[]>;
  message: string | null;
};

type Get = (key: string) => string;
type GetAll = (key: string) => string[];

// Checks a submitted form and turns it into a database row, or explains
// what to fix. `website` is a hidden field: people never see it, spam bots
// fill it in, so anything in it means the submission is quietly dropped.
export function parseInquiry(kind: InquiryKind, get: Get, getAll: GetAll): { ok: true; row: InquiryRow } | { ok: false; error: string; spam?: true } {
  if (get("website").trim()) return { ok: false, error: "Rejected.", spam: true };

  const name = get("name").trim();
  const email = get("email").trim();
  const message = get("message").trim();
  const orNull = (s: string, max: number) => (s.trim() ? s.trim().slice(0, max) : null);

  if (!name) return { ok: false, error: "Please add your name." };
  if (name.length > 120) return { ok: false, error: "That name is too long." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return { ok: false, error: "Please check your email address." };
  if (message.length > 4000) return { ok: false, error: "Please keep the message under 4,000 characters." };
  if (kind === "contact" && !message) return { ok: false, error: "Please add a message." };

  const details: Record<string, string | string[]> = {};
  if (kind !== "contact") {
    for (const q of TRACKS[kind].questions) {
      if (q.type === "select") {
        const v = get(q.key);
        if (!v && q.required) return { ok: false, error: `Please answer: ${q.label}` };
        if (v && !q.options.includes(v)) return { ok: false, error: `Please pick an option for: ${q.label}` };
        if (v) details[q.key] = v;
      } else {
        const vs = getAll(q.key).filter((v) => q.options.includes(v));
        if (vs.length) details[q.key] = vs;
      }
    }
  }

  return {
    ok: true,
    row: {
      kind,
      name,
      email,
      organization: orNull(get("organization"), 160),
      role: orNull(get("role"), 120),
      country: orNull(get("country"), 80),
      details,
      message: message || null,
    },
  };
}
