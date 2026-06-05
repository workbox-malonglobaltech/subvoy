/**
 * IMAP email fetcher — connects with user-supplied credentials (not stored),
 * fetches recent emails, and returns them in the same RawEmail format used
 * by the Gmail/Outlook services so the existing parser pipeline can process them.
 *
 * Credentials are used only for the duration of the scan and never persisted.
 */
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { RawEmail } from './gmail.service';

/** Well-known IMAP server settings keyed by email domain */
const IMAP_SERVERS: Record<string, { host: string; port: number }> = {
  'gmail.com':      { host: 'imap.gmail.com',        port: 993 },
  'googlemail.com': { host: 'imap.gmail.com',        port: 993 },
  'yahoo.com':      { host: 'imap.mail.yahoo.com',   port: 993 },
  'ymail.com':      { host: 'imap.mail.yahoo.com',   port: 993 },
  'outlook.com':    { host: 'imap-mail.outlook.com', port: 993 },
  'hotmail.com':    { host: 'imap-mail.outlook.com', port: 993 },
  'live.com':       { host: 'imap-mail.outlook.com', port: 993 },
  'msn.com':        { host: 'imap-mail.outlook.com', port: 993 },
  'icloud.com':     { host: 'imap.mail.me.com',      port: 993 },
  'me.com':         { host: 'imap.mail.me.com',      port: 993 },
  'mac.com':        { host: 'imap.mail.me.com',      port: 993 },
  'protonmail.com': { host: '127.0.0.1',             port: 1143 }, // ProtonMail Bridge
  'proton.me':      { host: '127.0.0.1',             port: 1143 },
  'zoho.com':       { host: 'imap.zoho.com',         port: 993 },
};

function getImapServer(email: string): { host: string; port: number } {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) throw new Error('Invalid email address');
  // Known domain → use preset; otherwise try imap.{domain}
  return IMAP_SERVERS[domain] ?? { host: `imap.${domain}`, port: 993 };
}

/**
 * Connects to the user's IMAP inbox, fetches emails from the last 6 months,
 * and returns them as RawEmail objects for the existing parser pipeline.
 * Credentials are NOT stored — connection is closed immediately after scanning.
 */
export async function fetchImapReceipts(email: string, password: string): Promise<RawEmail[]> {
  const { host, port } = getImapServer(email);

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    tls: { rejectUnauthorized: true },
  });

  await client.connect();

  const results: RawEmail[] = [];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  try {
    const mailbox = await client.mailboxOpen('INBOX');
    if (!mailbox) throw new Error('Could not open INBOX');

    // Search for emails in the last 6 months
    const uidsResult = await client.search({ since: sixMonthsAgo }, { uid: true });

    // client.search returns false when no messages match, or number[] otherwise
    const uids: number[] = Array.isArray(uidsResult) ? uidsResult : [];

    // Cap at 500 most recent to keep scan fast
    const limited = uids.slice(-500);
    if (limited.length === 0) return results;

    for await (const msg of client.fetch(limited, { source: true }, { uid: true })) {
      try {
        if (!msg.source) continue;
        const parsed = await (simpleParser(msg.source) as unknown as Promise<import('mailparser').ParsedMail>);

        const subject = parsed.subject ?? '';
        const from    = parsed.from?.text ?? '';
        const body    = parsed.text ?? (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, ' ') : '');
        const snippet = body.slice(0, 300);
        const date    = (parsed.date ?? new Date()).toISOString();

        results.push({ from, subject, date, snippet, body });
      } catch {
        // Skip unparseable individual emails — don't abort the whole scan
      }
    }
  } finally {
    try { await client.logout(); } catch { /* ignore logout errors */ }
  }

  return results;
}
