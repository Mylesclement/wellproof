import type { Metadata } from "next";
import Link from "next/link";
import { Card, grid, Heading, Section } from "@/components/Site";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <Section>
        <Heading
          eyebrow="About"
          title="We've sat on the operator's side of the table."
          lead="Wellproof grew out of first-hand experience of how hard it is for an indigenous producer to raise money, even with a good asset."
        />
        <div className="flex flex-col gap-4 max-w-[68ch] text-lg">
          <p>
            Raising capital for an indigenous Nigerian oil and gas company meant about fifteen investor pitches before a yes.
            The asset wasn&apos;t the problem. Investors couldn&apos;t get production data they trusted, and nobody stood in the
            middle to verify it.
          </p>
          <p>
            Wellproof is that middle. It gives operators a production record that is reconciled every day, explains its own
            gaps, and keeps its full history, so lenders and partners can check the numbers instead of taking them on faith.
          </p>
        </div>
      </Section>

      <Section tint>
        <Heading eyebrow="Founder" title="Myles" />
        <div className="flex flex-col gap-3 max-w-[68ch] text-lg">
          <p>
            Myles is the managing director of an indigenous Nigerian oil and gas company and holds a B.S. in Computer Science
            from Johnson &amp; Wales University. He builds Wellproof at the point where those two worlds meet: the realities of
            running a field and the software that can make its numbers trustworthy.
          </p>
        </div>
      </Section>

      <Section>
        <Heading eyebrow="What we hold to" title="Our principles" />
        <div className={grid}>
          <Card title="Honest numbers">
            We show what was reported, what changed, and why. We never smooth over a gap to make a record look better.
          </Card>
          <Card title="History is never erased">
            Corrections add to the record. They don&apos;t replace it.
          </Card>
          <Card title="No black boxes">
            Every score shows its formula and its inputs.
          </Card>
          <Card title="Operators own their data">
            Nothing is shared with a lender or partner unless the operator chooses to share it.
          </Card>
        </div>
        <p className="text-muted">
          Want to help shape it?{" "}
          <Link href="/pilot" className="text-accent font-semibold">
            Join the pilot
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="text-accent font-semibold">
            get in touch
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
