import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Terms of Service (draft)" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="9 Oct 2026">
      <p>These draft terms outline the topics Workido&apos;s final terms are expected to cover. Section content is indicative only.</p>
      <h2>1. The service</h2>
      <p>Workido provides a marketplace where buyers can find specialists and purchase professional services. Workido is not a party to the work agreement between buyers and specialists unless stated otherwise.</p>
      <h2>2. Accounts</h2>
      <ul>
        <li>Eligibility, accurate information and account security.</li>
        <li>Buyer and specialist capabilities on a single account.</li>
        <li>Suspension and termination for policy violations.</li>
      </ul>
      <h2>3. Orders, scope and delivery</h2>
      <ul>
        <li>Orders are based on the scope, price, delivery time and revision policy shown before payment.</li>
        <li>Specialists accept paid orders before work begins.</li>
        <li>Revisions are limited to the number included in the order.</li>
      </ul>
      <h2>4. Payments, fees, refunds and payouts</h2>
      <ul>
        <li>Payments are processed by a third-party payment provider.</li>
        <li>Applicable fees are shown before payment.</li>
        <li>Refund conditions (declined orders, cancellations before acceptance, dispute outcomes).</li>
        <li>Specialist payout timing and method — to be defined with the payment provider and legal counsel.</li>
      </ul>
      <h2>5. Disputes</h2>
      <p>How disputes are opened, reviewed and resolved, and the evidence Workido may consider.</p>
      <h2>6. Content, intellectual property and confidentiality</h2>
      <p>Ownership and licensing of deliverables, portfolio usage rights, and confidentiality of buyer materials.</p>
      <h2>7. Prohibited conduct</h2>
      <p>Including fraud, harassment, circumventing payments, and illegal or infringing services.</p>
      <h2>8. Liability, governing law and changes</h2>
      <p>Limitations of liability, governing law and jurisdiction, and how changes to these terms are communicated.</p>
    </LegalPage>
  );
}
