import type { Metadata } from "next";
import Link from "next/link";
import { InquiryForm } from "@/components/InquiryForm";
import { Heading, Section } from "@/components/Site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <Section>
      <Heading
        eyebrow="Contact"
        title="Talk to us."
        lead={
          <>
            Questions, ideas, or a field you&apos;d like to try Wellproof on. To take part in the pilot, use the{" "}
            <Link href="/pilot" className="text-accent font-semibold">
              pilot sign-up
            </Link>{" "}
            instead.
          </>
        }
      />
      <div className="max-w-[760px]">
        <InquiryForm kind="contact" />
      </div>
    </Section>
  );
}
