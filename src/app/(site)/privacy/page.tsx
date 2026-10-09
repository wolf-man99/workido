import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Privacy Policy (draft)" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="9 Oct 2026">
      <p>This draft describes how the current product handles data. The final policy must be reviewed for compliance with applicable law (including India&apos;s Digital Personal Data Protection Act, 2023).</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: name, email address and password (stored securely by our authentication provider).</li>
        <li>Profile data you choose to publish: display name, username, photo, bio, location, skills, portfolio and services.</li>
        <li>Private contact preferences, such as an optional phone number. These are never shown publicly.</li>
        <li>Transaction data: requirements, offers, orders, messages, files and reviews.</li>
        <li>Payment records needed to process orders. Card and bank details are handled by the payment provider; Workido does not store them.</li>
        <li>Product analytics events without message contents, file names or payment details.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To provide the marketplace, match buyers with specialists and process orders.</li>
        <li>To send notifications you can control in Account settings.</li>
        <li>To keep the platform safe, investigate reports and resolve disputes.</li>
      </ul>
      <h2>Who can see what</h2>
      <ul>
        <li>Published profiles, services, portfolios and reviews are public.</li>
        <li>Requirements are visible only to you and specialists you invite.</li>
        <li>Orders, messages and files are visible only to the two parties (and authorised staff when investigating a report or dispute).</li>
      </ul>
      <h2>Your choices</h2>
      <p>Access, correction and deletion requests, data retention periods, and contact details for privacy questions — to be finalised.</p>
    </LegalPage>
  );
}
