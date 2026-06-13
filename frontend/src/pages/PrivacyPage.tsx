import { Link } from 'react-router-dom';
import { LogoMark } from '../components/LogoMark';

const EFFECTIVE = 'June 13, 2026';
const CONTACT = 'privacy@subvoy.com';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <h2 id={id} className="text-h3 text-fg mt-10 mb-3">{title}</h2>
      <div className="space-y-3 text-body text-fg-muted">{children}</div>
    </section>
  );
}

/** Public privacy policy — includes the Google API Limited Use disclosure required
 *  for OAuth verification. Linked from the landing footer + the OAuth consent screen. */
export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2"><LogoMark /></Link>
          <Link to="/" className="text-sm font-medium text-primary hover:text-primary-700">← Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-h1 text-fg">Privacy Policy</h1>
        <p className="mt-2 text-caption text-fg-subtle">Effective {EFFECTIVE} · Last updated {EFFECTIVE}</p>

        <p className="mt-6 text-body text-fg-muted">
          Subvoy ("Subvoy", "we", "us") helps you track your subscriptions, recurring
          payments, and (for businesses) compliance obligations in one place. This policy
          explains what we collect, how we use it, and the choices you have. We collect the
          minimum needed to run the service and we never sell your data.
        </p>

        <Section id="collect" title="1. Information we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Account:</strong> name, email, and authentication identifiers (via Supabase Auth / Google sign-in).</li>
            <li><strong>Subscriptions &amp; obligations you add:</strong> service name, amount, currency, billing cycle, dates, category, notes.</li>
            <li><strong>Imports you initiate:</strong> data parsed from bank-statement CSVs you upload, or from connected email accounts (see §4).</li>
            <li><strong>Usage &amp; device data:</strong> basic logs and error reports to keep the service reliable and secure.</li>
          </ul>
        </Section>

        <Section id="use" title="2. How we use your information">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Provide the core features: tracking, reminders, analytics, reports, and compliance tracking.</li>
            <li>Send you notifications you've enabled (e.g. renewal reminders, budget alerts).</li>
            <li>Detect recurring payments from imports you initiate, as subscription suggestions you confirm.</li>
            <li>Secure the service, prevent abuse, and meet legal obligations.</li>
          </ul>
          <p>We do <strong>not</strong> use your data for advertising, and we do <strong>not</strong> sell it.</p>
        </Section>

        <Section id="google" title="3. Google user data — Limited Use disclosure">
          <p>
            If you choose to connect a Gmail account, Subvoy requests <strong>read-only</strong> access
            (<code className="rounded bg-surface-muted px-1 py-0.5 text-caption">gmail.readonly</code>) for the
            sole purpose of detecting subscription and payment receipts in your inbox and suggesting
            subscriptions for you to confirm and track.
          </p>
          <p className="rounded-xl border border-line bg-surface p-4">
            Subvoy's use and transfer of information received from Google APIs adheres to the{' '}
            <a className="text-primary hover:text-primary-700" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Google API Services User Data Policy
            </a>, including the <strong>Limited Use</strong> requirements. Specifically, Subvoy:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Accesses Gmail <strong>read-only</strong>; we never send, modify, label, or delete your mail.</li>
            <li>Uses Gmail data <strong>only</strong> to provide the user-facing subscription-detection feature.</li>
            <li>Processes message content <strong>transiently</strong> — we persist only the derived subscription suggestions, never the raw email content.</li>
            <li>Does <strong>not</strong> transfer or sell this data, does <strong>not</strong> use it for advertising, and does <strong>not</strong> use it to train generalized AI/ML models.</li>
            <li>Lets you <strong>disconnect</strong> any connected account at any time, which deletes the stored access tokens.</li>
          </ul>
          <p>The same principles apply to other connected mailboxes (e.g. Outlook/IMAP).</p>
        </Section>

        <Section id="sharing" title="4. Sharing &amp; processors">
          <p>
            We share data only with service providers that help us operate Subvoy, under contract and
            only as needed: hosting (Fly.io), database &amp; auth (Supabase), email delivery (Resend),
            and — only where you use payments — payment processing (Paystack/Stripe). We never sell your data.
          </p>
        </Section>

        <Section id="security" title="5. Security &amp; retention">
          <p>
            Connections are protected with industry-standard measures. OAuth and mailbox tokens are
            <strong> encrypted at rest (AES-256-GCM)</strong>; sessions use HttpOnly cookies. We retain
            your account data while your account is active and delete or anonymize it after closure,
            except where law requires retention.
          </p>
        </Section>

        <Section id="rights" title="6. Your choices &amp; rights">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Access &amp; export</strong> your data, and <strong>delete</strong> your account from Settings.</li>
            <li><strong>Disconnect</strong> any email account at any time (Import → Connected accounts → Remove), which revokes our access tokens.</li>
            <li>Revoke Google access directly at{' '}
              <a className="text-primary hover:text-primary-700" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</li>
            <li>Manage notification preferences in Settings.</li>
          </ul>
        </Section>

        <Section id="intl" title="7. International users &amp; children">
          <p>
            Subvoy is available globally; by using it you consent to processing as described here.
            Subvoy is not directed to children under 16, and we do not knowingly collect their data.
          </p>
        </Section>

        <Section id="changes" title="8. Changes to this policy">
          <p>
            We may update this policy; material changes will be reflected by the "Last updated" date and,
            where appropriate, an in-app notice.
          </p>
        </Section>

        <Section id="contact" title="9. Contact">
          <p>
            Questions or requests? Email <a className="text-primary hover:text-primary-700" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </Section>

        <p className="mt-12 border-t border-line pt-6 text-caption text-fg-subtle">
          © {new Date().getFullYear()} Subvoy. All rights reserved.
        </p>
      </main>
    </div>
  );
}
