import type { Metadata } from "next";
import Link from "next/link";
import { InquiryForm } from "@/components/InquiryForm";
import { Card, grid, Heading, Section } from "@/components/Site";
import { TRACKS, trackBySlug } from "@/lib/inquiry";

export const metadata: Metadata = { title: "Pilot program" };

export default async function PilotPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track: slug } = await searchParams;
  const kind = trackBySlug(slug) ?? "pilot_operator";
  const track = TRACKS[kind];

  return (
    <>
      <Section>
        <Heading
          eyebrow="Pilot program"
          title="Help us build the record lenders trust."
          lead="The pilot is free. We're looking for a small group of operators, lenders, and metering partners to test Wellproof on real workflows and shape what comes next."
        />
        <div className={grid}>
          <Card n={1} title="Intro call">
            A short conversation about your fields, your reporting today, or what you need to see as a lender.
          </Card>
          <Card n={2} title="Set up">
            We configure your fields, measurement points, and loss limits with you, and bring in your existing records.
          </Card>
          <Card n={3} title="Run it">
            Log daily readings for a few weeks. Flags and the trust score update as you go.
          </Card>
          <Card n={4} title="Share and review">
            Share the record with a lender if you choose, then tell us what worked and what didn&apos;t.
          </Card>
        </div>
      </Section>

      <Section tint>
        <Heading eyebrow="Three ways to take part" title="Who the pilot is for" />
        <div className={grid}>
          {Object.entries(TRACKS).map(([k, t]) => (
            <div key={k} className={`panel ${k === kind ? "border-accent" : ""}`}>
              <h3 className="font-display font-bold">{t.title}</h3>
              <p className="text-muted">{t.who}</p>
              <p>
                <strong>What you get:</strong> {t.offer}
              </p>
              <Link href={`?track=${t.slug}#form`} scroll={false} className="text-accent font-semibold mt-auto">
                {k === kind ? "Signing up below ↓" : "Sign up as this →"}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted max-w-[68ch]">
          On metering: we&apos;re looking for our first hardware and measurement partners. The goal is for readings to come
          straight from an independent source, so the record no longer depends on what the operator types in.
        </p>
      </Section>

      <Section id="form">
        <Heading title={`Sign up: ${track.title}`} />
        <nav className="flex flex-wrap gap-2" aria-label="Choose a track">
          {Object.entries(TRACKS).map(([k, t]) => (
            <Link
              key={k}
              href={`?track=${t.slug}#form`}
              scroll={false}
              aria-current={k === kind ? "page" : undefined}
              className={`pill text-sm px-3 py-1 ${k === kind ? "bg-accent text-surface" : "bg-accent-soft text-accent"}`}
            >
              {t.title}
            </Link>
          ))}
        </nav>
        <InquiryForm key={kind} kind={kind} />
      </Section>
    </>
  );
}
