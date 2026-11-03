import { describe, expect, it } from "vitest";
import { parseInquiry, trackBySlug } from "./inquiry";

const form = (values: Record<string, string | string[]>) => ({
  get: (k: string) => {
    const v = values[k];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  },
  getAll: (k: string) => {
    const v = values[k];
    return Array.isArray(v) ? v : v ? [v] : [];
  },
});
const parse = (kind: Parameters<typeof parseInquiry>[0], values: Record<string, string | string[]>) => {
  const f = form(values);
  return parseInquiry(kind, f.get, f.getAll);
};

const operator = { name: "Ada", email: "ada@example.com", fields: "1", recording: "Paper", raising: "Yes" };

describe("parseInquiry", () => {
  it("accepts a complete operator sign-up and keeps the track answers", () => {
    const r = parse("pilot_operator", { ...operator, terrain: ["Onshore", "Swamp"], organization: " Sample Ltd " });
    expect(r).toMatchObject({
      ok: true,
      row: { kind: "pilot_operator", organization: "Sample Ltd", details: { fields: "1", recording: "Paper", raising: "Yes", terrain: ["Onshore", "Swamp"] } },
    });
  });

  it("asks for required track answers", () => {
    expect(parse("pilot_operator", { ...operator, raising: "" })).toEqual({ ok: false, error: "Please answer: Raising funds in the next 12 months?" });
  });

  it("ignores options that are not on the list", () => {
    expect(parse("pilot_operator", { ...operator, fields: "999" }).ok).toBe(false);
    const r = parse("pilot_operator", { ...operator, terrain: ["Onshore", "<script>"] });
    expect(r.ok && r.row.details.terrain).toEqual(["Onshore"]);
  });

  it("checks name and email", () => {
    expect(parse("pilot_lender", { name: "", email: "a@b.co", institution: "Other" }).ok).toBe(false);
    expect(parse("pilot_lender", { name: "A", email: "not-an-email", institution: "Other" }).ok).toBe(false);
  });

  it("needs a message on the contact form", () => {
    expect(parse("contact", { name: "A", email: "a@b.co" })).toEqual({ ok: false, error: "Please add a message." });
    expect(parse("contact", { name: "A", email: "a@b.co", message: "Hello" }).ok).toBe(true);
  });

  it("drops anything that fills the hidden spam trap", () => {
    expect(parse("contact", { name: "A", email: "a@b.co", message: "Hi", website: "http://spam" })).toMatchObject({ ok: false, spam: true });
  });
});

describe("trackBySlug", () => {
  it("maps the URL name to a track", () => {
    expect(trackBySlug("partner")).toBe("pilot_partner");
    expect(trackBySlug("nope")).toBeUndefined();
  });
});
