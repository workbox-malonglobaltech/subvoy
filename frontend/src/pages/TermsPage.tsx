import { Link } from 'react-router-dom';
import { LogoMark } from '../components/LogoMark';

const EFFECTIVE = 'June 13, 2026';
const CONTACT = 'support@subvoy.com';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <h2 id={id} className="text-h3 text-fg mt-10 mb-3">{title}</h2>
      <div className="space-y-3 text-body text-fg-muted">{children}</div>
    </section>
  );
}

/** Public Terms of Service. Linked from the landing footer. */
export function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2"><LogoMark /></Link>
          <Link to="/" className="text-sm font-medium text-primary hover:text-primary-700">← Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-h1 text-fg">Terms of Service</h1>
        <p className="mt-2 text-caption text-fg-subtle">Effective {EFFECTIVE} · Last updated {EFFECTIVE}</p>

        <p className="mt-6 text-body text-fg-muted">
          These Terms of Service ("Terms") govern your use of Subvoy ("Subvoy", "we", "us"),
          a service for tracking subscriptions, recurring payments, and compliance obligations.
          By creating an account or using Subvoy, you agree to these Terms and to our{' '}
          <Link to="/privacy" className="text-primary hover:text-primary-700">Privacy Policy</Link>.
          If you don't agree, don't use the service.
        </p>

        <Section id="service" title="1. The service">
          <p>
            Subvoy helps you record subscriptions and obligations, sends reminders, and provides
            analytics and reports. Subvoy is an <strong>informational and organizational tool</strong>;
            it is <strong>not</strong> financial, tax, accounting, or legal advice. You remain
            responsible for your actual payments, filings, and decisions.
          </p>
        </Section>

        <Section id="accounts" title="2. Your account">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Provide accurate information and keep your login credentials secure.</li>
            <li>You're responsible for activity under your account.</li>
            <li>You must be at least 16 and able to form a binding contract.</li>
            <li>Tell us promptly of any unauthorized use.</li>
          </ul>
        </Section>

        <Section id="acceptable" title="3. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Break the law, infringe others' rights, or upload malicious content.</li>
            <li>Probe, scrape, overload, or attempt to disrupt or reverse-engineer the service.</li>
            <li>Access another user's data or workspace without authorization.</li>
            <li>Resell or misrepresent the service.</li>
          </ul>
        </Section>

        <Section id="billing" title="4. Plans, fees &amp; payments">
          <p>
            Subvoy offers free tiers and, where available, paid plans. Paid plan fees, billing
            cycle, and any usage limits are shown at the point of purchase; plans renew until
            cancelled, and you can cancel anytime to stop future renewals. Fees are non-refundable
            except where required by law or expressly stated.
          </p>
          <p>
            Where payment or wallet features are enabled in your region, additional terms (including
            applicable fees and the third-party processor's terms, e.g. Paystack/Stripe) apply. Some
            payment features may be unavailable pending licensing or regional rollout.
          </p>
        </Section>

        <Section id="connections" title="5. Email &amp; third-party connections">
          <p>
            If you connect an email account (e.g. Gmail or via IMAP), you authorize Subvoy to access
            it <strong>read-only</strong> to detect subscription receipts, as described in our{' '}
            <Link to="/privacy" className="text-primary hover:text-primary-700">Privacy Policy</Link>.
            Your use of third-party services remains subject to their terms. You can disconnect at any time.
          </p>
        </Section>

        <Section id="content" title="6. Your data">
          <p>
            You own the data you add. You grant Subvoy a limited license to host and process it solely
            to operate and improve the service for you. We do not sell your data. You can export or
            delete your data and close your account at any time.
          </p>
        </Section>

        <Section id="disclaimer" title="7. Disclaimers">
          <p>
            The service is provided <strong>"as is"</strong> and <strong>"as available"</strong>, without
            warranties of any kind. Reminders, detection, and analytics are provided on a best-effort
            basis and may be incomplete or delayed; <strong>you are responsible for verifying due dates
            and making your own payments and filings.</strong> Subvoy is not liable for missed payments,
            penalties, or charges arising from your subscriptions or obligations.
          </p>
        </Section>

        <Section id="liability" title="8. Limitation of liability">
          <p>
            To the maximum extent permitted by law, Subvoy and its suppliers are not liable for any
            indirect, incidental, special, consequential, or punitive damages, or lost profits or data.
            Our total liability for any claim relating to the service is limited to the greater of the
            amount you paid us in the 12 months before the claim, or US$50.
          </p>
        </Section>

        <Section id="termination" title="9. Suspension &amp; termination">
          <p>
            You may stop using Subvoy and delete your account anytime. We may suspend or terminate access
            if you breach these Terms or to protect the service or other users. On termination, your right
            to use the service ends; data handling follows our Privacy Policy.
          </p>
        </Section>

        <Section id="changes" title="10. Changes">
          <p>
            We may update these Terms; material changes will be reflected by the "Last updated" date and,
            where appropriate, an in-app notice. Continued use after changes means you accept the updated Terms.
          </p>
        </Section>

        <Section id="law" title="11. Governing law">
          <p>
            These Terms are governed by the laws of the jurisdiction in which Subvoy's operating entity is
            established, without regard to conflict-of-laws rules. Disputes will be handled by the courts of
            that jurisdiction, unless mandatory local law provides otherwise.
          </p>
        </Section>

        <Section id="contact" title="12. Contact">
          <p>
            Questions about these Terms? Email <a className="text-primary hover:text-primary-700" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </Section>

        <p className="mt-12 border-t border-line pt-6 text-caption text-fg-subtle">
          © {new Date().getFullYear()} Subvoy. All rights reserved.
        </p>
      </main>
    </div>
  );
}
