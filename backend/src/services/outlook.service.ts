import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { updateAccessToken } from '../models/email-connection';
import type { RawEmail } from './gmail.service';

const SCOPES = ['https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/User.Read'];

function getMsalApp() {
  const clientId     = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set');
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: 'https://login.microsoftonline.com/common',
    },
  });
}

export function getOutlookAuthUrl(state: string): string {
  const clientId   = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = `${process.env.OAUTH_REDIRECT_BASE_URL ?? 'http://localhost:3001'}/email-import/callback/microsoft`;

  if (!clientId) throw new Error('MICROSOFT_CLIENT_ID must be set');

  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: 'code',
    redirect_uri:  redirectUri,
    scope:         SCOPES.join(' ') + ' offline_access',
    state,
    response_mode: 'query',
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  email: string;
}

export async function exchangeOutlookCode(code: string): Promise<OAuthTokens> {
  const redirectUri = `${process.env.OAUTH_REDIRECT_BASE_URL ?? 'http://localhost:3001'}/email-import/callback/microsoft`;
  const msalApp = getMsalApp();

  const result = await msalApp.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri,
  });

  const client = Client.init({
    authProvider: (done) => done(null, result.accessToken),
  });

  const me = await client.api('/me').select('mail,userPrincipalName').get() as { mail?: string; userPrincipalName?: string };

  return {
    accessToken:  result.accessToken,
    refreshToken: (result as unknown as { refreshToken?: string }).refreshToken,
    tokenExpiry:  result.expiresOn ?? undefined,
    email:        me.mail ?? me.userPrincipalName ?? '',
  };
}

async function getGraphClient(
  userId: string,
  connectionId: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: Date | null
): Promise<Client> {
  // Refresh if expired or expiring in next 5 minutes
  let token = accessToken;
  if (refreshToken && tokenExpiry && tokenExpiry.getTime() < Date.now() + 5 * 60 * 1000) {
    try {
      const msalApp = getMsalApp();
      const result  = await msalApp.acquireTokenByRefreshToken({
        refreshToken,
        scopes: SCOPES,
      });
      if (result?.accessToken) {
        token = result.accessToken;
        await updateAccessToken(userId, connectionId, token, result.expiresOn ?? undefined);
      }
    } catch {
      // Use existing token and hope for the best
    }
  }

  return Client.init({
    authProvider: (done) => done(null, token),
  });
}

export async function fetchOutlookReceipts(
  userId: string,
  connectionId: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: Date | null
): Promise<RawEmail[]> {
  const client = await getGraphClient(userId, connectionId, accessToken, refreshToken, tokenExpiry);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateFilter = sixMonthsAgo.toISOString();

  // Search for subscription receipts/invoices
  const filter = `receivedDateTime ge ${dateFilter} and (contains(subject,'receipt') or contains(subject,'invoice') or contains(subject,'payment') or contains(subject,'subscription') or contains(subject,'your order'))`;

  const results: RawEmail[] = [];
  let nextLink: string | undefined;

  do {
    const url = nextLink ?? `/me/messages?$filter=${encodeURIComponent(filter)}&$select=from,subject,receivedDateTime,bodyPreview,body&$top=50`;
    const response = await client.api(url).get() as {
      value: Array<{
        from: { emailAddress: { address: string; name: string } };
        subject: string;
        receivedDateTime: string;
        bodyPreview: string;
        body: { content: string; contentType: string };
      }>;
      '@odata.nextLink'?: string;
    };

    for (const msg of response.value) {
      const from    = msg.from?.emailAddress?.address ?? '';
      const subject = msg.subject ?? '';
      const date    = msg.receivedDateTime ?? '';
      const snippet = msg.bodyPreview ?? '';
      // Strip HTML tags from body for plain text
      const body    = (msg.body?.content ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      results.push({ from, subject, date: new Date(date).toISOString(), snippet, body: body || snippet });
    }

    nextLink = response['@odata.nextLink'];
  } while (nextLink && results.length < 200);

  return results;
}
