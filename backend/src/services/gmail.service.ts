import { google } from 'googleapis';
import { updateAccessToken } from '../models/email-connection';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Known subscription sender domains for email filtering
const SUBSCRIPTION_DOMAINS = [
  'netflix.com', 'spotify.com', 'amazon.com', 'apple.com', 'google.com',
  'microsoft.com', 'adobe.com', 'dropbox.com', 'zoom.us', 'slack.com',
  'github.com', 'notion.so', 'figma.com', 'hulu.com', 'disneyplus.com',
  'openai.com', 'anthropic.com', 'chatgpt.com', 'canva.com', 'loom.com',
  'headspace.com', 'calm.com', 'duolingo.com', 'coursera.org', 'udemy.com',
  'youtube.com', 'twitch.tv', 'patreon.com', 'medium.com', 'substack.com',
  'nytimes.com', 'wsj.com', 'economist.com', 'theguardian.com',
  'aws.amazon.com', 'digitalocean.com', 'heroku.com', 'vercel.com',
];

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.OAUTH_REDIRECT_BASE_URL ?? 'http://localhost:3001'}/email-import/callback/google`;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(state: string): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent', // force refresh_token to be returned every time
  });
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  email: string;
}

export async function exchangeGoogleCode(code: string): Promise<OAuthTokens> {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch the user's email
  const gmail = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await gmail.userinfo.get();

  return {
    accessToken:  tokens.access_token!,
    refreshToken: tokens.refresh_token ?? undefined,
    tokenExpiry:  tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    email:        data.email ?? '',
  };
}

export interface RawEmail {
  from: string;
  subject: string;
  date: string;    // ISO date string
  snippet: string; // short text preview
  body: string;    // decoded plain text body
}

async function getRefreshedClient(
  userId: string,
  connectionId: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: Date | null
): Promise<InstanceType<typeof google.auth.OAuth2>> {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token:  accessToken,
    refresh_token: refreshToken ?? undefined,
    expiry_date:   tokenExpiry?.getTime(),
  });

  // Refresh if expired or expiring in next 5 minutes
  if (tokenExpiry && tokenExpiry.getTime() < Date.now() + 5 * 60 * 1000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    if (credentials.access_token) {
      await updateAccessToken(
        userId, connectionId,
        credentials.access_token,
        credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
      );
    }
  }

  return oauth2Client;
}

export async function fetchGmailReceipts(
  userId: string,
  connectionId: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: Date | null
): Promise<RawEmail[]> {
  const auth = await getRefreshedClient(userId, connectionId, accessToken, refreshToken, tokenExpiry);
  const gmail = google.gmail({ version: 'v1', auth });

  // Build query: receipts/invoices from known subscription senders in past 6 months
  const fromQuery = SUBSCRIPTION_DOMAINS.map(d => `from:${d}`).join(' OR ');
  const query = `(${fromQuery}) (subject:receipt OR subject:invoice OR subject:payment OR subject:subscription OR subject:"your order") newer_than:180d`;

  let messageIds: string[] = [];
  let pageToken: string | undefined;

  // Fetch up to 200 message IDs
  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
      pageToken,
    });
    const msgs = listRes.data.messages ?? [];
    messageIds.push(...msgs.map(m => m.id!).filter(Boolean));
    pageToken = listRes.data.nextPageToken ?? undefined;
  } while (pageToken && messageIds.length < 200);

  // Fetch each message (batch of 20 to avoid rate limits)
  const results: RawEmail[] = [];
  for (let i = 0; i < Math.min(messageIds.length, 100); i++) {
    try {
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: messageIds[i],
        format: 'full',
      });

      const headers = msgRes.data.payload?.headers ?? [];
      const from    = headers.find(h => h.name === 'From')?.value ?? '';
      const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
      const date    = headers.find(h => h.name === 'Date')?.value ?? '';
      const snippet = msgRes.data.snippet ?? '';

      // Extract plain text body
      let body = '';
      const parts = msgRes.data.payload?.parts ?? [msgRes.data.payload];
      for (const part of parts) {
        if (part?.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf8');
          break;
        }
      }

      results.push({ from, subject, date: new Date(date).toISOString(), snippet, body: body || snippet });
    } catch {
      // Skip individual message failures
    }
  }

  return results;
}
