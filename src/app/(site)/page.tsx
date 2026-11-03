import Link from "next/link";
import { Card, grid, Heading, Section } from "@/components/Site";
import { TRACKS } from "@/lib/inquiry";

export default function HomePage() {
  return (
    <>
      <section className="max-w-[1080px] mx-auto px-4 pt-16 pb-12 flex flex-col gap-6">
        <span className="label text-crude">For indigenous oil and gas producers, and the people who fund them</span>
        <h1 className="font-display font-extrabold text-5xl sm:text-6xl tracking-tight max-w-[16ch] text-balance">
          Proof you can bank on.
        </h1>
        <p className="text-xl text-muted max-w-[60ch]">
          Closing the gap between what you produce and what you can raise. Wellproof turns daily production readings into
          a reconciled record, with every change on file, that lenders and partners can check for themselves.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/pilot" className="btn">
            Join the free pilot
          </Link>
          <Link href="/#how" className="btn bg-transparent text-accent border border-accent">
            How it works
          </Link>
        </div>
      </section>

      <Section tint>
        <Heading
          eyebrow="The problem"
          title="Good fields, stalled funding."
          lead="Oil changes hands several times between the well and the export terminal, and a little is lost at every step. Some loss is normal. Loss nobody can explain looks like theft, faulty meters, or bad bookkeeping, and that is where funding conversations stall."
        />
        <div className={grid}>
          <Card title="Operators can't prove their numbers">
            Production lives in spreadsheets and daily reports that are easy to question and hard to verify, so every investor
            starts from zero.
          </Card>
          <Card title="Lenders can't see what happens">
            Without a trusted record, diligence takes months and gaps found later look like bad faith, even when they have
            ordinary causes.
          </Card>
          <Card title="Nobody sits in the middle">
            There is no shared record both sides accept, so the same questions get asked in every pitch.
          </Card>
        </div>
      </Section>

      <Section id="how">
        <Heading eyebrow="How it works" title="One record, from wellhead to terminal." />
        <div className={grid}>
          <Card n={1} title="Log daily readings">
            The operator records volumes at each measurement point: wellhead, flow station, trunk line injection, terminal.
          </Card>
          <Card n={2} title="Reconcile every handoff">
            Wellproof compares each step with its expected loss range and flags anything outside it, or anything missing, the
            day it happens.
          </Card>
          <Card n={3} title="Explain every flag">
            The operator explains each flag. Explanations stay on the record for good, next to the numbers they explain.
          </Card>
          <Card n={4} title="Share a trust score">
            The operator gives lenders read-only access to a record with a trust score whose formula is shown on screen.
          </Card>
        </div>
      </Section>

      <Section tint>
        <Heading
          eyebrow="Why it can be trusted"
          title="Built so the history can't be quietly rewritten."
          lead="These rules are enforced by the database itself, not just by the app's screens."
        />
        <div className={grid}>
          <Card title="Nothing is overwritten">
            A correction is saved as a new version with a reason. The original number stays on file, with who entered it and
            when.
          </Card>
          <Card title="Every change is logged">
            Readings, corrections, explanations, and access changes are written to an audit log that can&apos;t be edited.
          </Card>
          <Card title="The score shows its working">
            40 × completeness + 60 × steps within range − 5 per unexplained flag. Every viewer sees the formula and the
            numbers that went into it.
          </Card>
          <Card title="The operator controls access">
            Lenders see only the fields an operator shares with them, and access can be revoked at any time.
          </Card>
        </div>
      </Section>

      <Section>
        <Heading eyebrow="Where we're headed" title="From self-reported to independently verified." />
        <div className={grid}>
          <Card title="Today">
            <span className="pill bg-ok-soft text-ok self-start">Working</span>
            Operator-entered readings, automatic reconciliation and flags, permanent explanations, and a lender view with the
            trust score.
          </Card>
          <Card title="Next">
            <span className="pill bg-warn-soft text-warn self-start">Planned</span>
            Independent figures alongside the operator&apos;s own: terminal receipts and pipeline allocation statements, so the
            record can be checked against a second source.
          </Card>
          <Card title="Later">
            <span className="pill bg-accent-soft text-accent self-start">Exploring</span>
            Readings direct from licensed metering partners, then gas, power, and other producing regions.
          </Card>
        </div>
      </Section>

      <Section tint>
        <Heading
          eyebrow="Pilot program"
          title="We're opening a free pilot."
          lead="We're looking for a small group of early partners to shape the product with us."
        />
        <div className={grid}>
          {Object.values(TRACKS).map((t) => (
            <Link key={t.slug} href={`/pilot?track=${t.slug}#form`} className="panel hover:border-accent">
              <h3 className="font-display font-bold">{t.title}</h3>
              <p className="text-muted">{t.who}</p>
              <span className="text-accent font-semibold">Sign up →</span>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
