/**
 * Email service — uses Resend (https://resend.com).
 *
 * Set RESEND_API_KEY in .env to enable sending.
 * Without it, emails are logged to console (dev mode).
 *
 * Set EMAIL_FROM  e.g. "Subvoy <noreply@subvoy.com>"
 * Set FRONTEND_URL e.g. "https://subvoy.com"
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape user-controlled strings before embedding in HTML */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Delivery ──────────────────────────────────────────────────────────────────

async function send(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const isConfigured = apiKey && apiKey !== 'your_resend_api_key_here';

  if (!isConfigured) {
    console.log('[EMAIL — dev mode, RESEND_API_KEY not set]');
    console.log(`  To:      ${payload.to}`);
    console.log(`  Subject: ${payload.subject}`);
    return;
  }

  const from = process.env.EMAIL_FROM ?? 'Subvoy <noreply@subvoy.com>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to:      payload.to,
      subject: payload.subject,
      html:    payload.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

// ── Shared layout ─────────────────────────────────────────────────────────────

const appUrl = () => process.env.FRONTEND_URL ?? 'http://localhost:5173';

/** Full HTML email shell — header + body + footer. */
function layout(opts: {
  previewText: string;
  headerLabel: string;
  headerColor?: string;  // default indigo
  content: string;
}): string {
  const headerBg = opts.headerColor ?? 'linear-gradient(135deg, #818CF8 0%, #4338CA 100%)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @media only screen and (max-width:600px){
      .email-body{padding:16px !important}
      .email-card{border-radius:12px !important}
      .content-pad{padding:24px 20px !important}
      .stat-table td{display:block !important;text-align:left !important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- Preview text (hidden in body, shown in inbox snippet) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${opts.previewText}&nbsp;&#8203;&nbsp;&#65279;</div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         class="email-body" style="background:#F3F4F6;padding:40px 16px">
    <tr><td align="center">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             class="email-card"
             style="max-width:580px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;box-shadow:0 4px 24px rgba(0,0,0,.06)">

        <!-- Header -->
        <tr>
          <td style="background:${headerBg};padding:28px 40px">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td>
                  <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">
                    Sub<span style="font-weight:400">voy</span>
                  </span>
                </td>
                <td align="right">
                  <span style="font-size:12px;color:#C7D2FE;font-weight:500;text-transform:uppercase;letter-spacing:0.5px">
                    ${opts.headerLabel}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="content-pad" style="padding:36px 40px">
            ${opts.content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 24px;border-top:1px solid #F3F4F6">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="font-size:12px;color:#9CA3AF;line-height:1.6">
                  You're receiving this email from Subvoy, your subscription manager.<br/>
                  <a href="${appUrl()}/settings" style="color:#6366F1;text-decoration:none">Manage email preferences</a>
                  &nbsp;·&nbsp;
                  <a href="${appUrl()}" style="color:#9CA3AF;text-decoration:none">subvoy.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- / Card -->

    </td></tr>
  </table>
</body>
</html>`;
}

/** Standard indigo CTA button. */
function ctaButton(label: string, href: string, color = '#4F46E5'): string {
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px">
    <tr>
      <td style="border-radius:10px;background:${color}">
        <a href="${href}"
           style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.1px">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

/** Highlighted info card. */
function infoCard(content: string, bg = '#F5F3FF', border = '#DDD6FE'): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:${bg};border:1px solid ${border};border-radius:12px;margin:20px 0">
    <tr><td style="padding:20px 24px">${content}</td></tr>
  </table>`;
}

/** Greeting line. */
function greeting(name: string): string {
  return `<p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#111827">Hi ${name} 👋</p>`;
}

/** Body paragraph. */
function para(text: string, muted = false): string {
  const color = muted ? '#6B7280' : '#374151';
  return `<p style="margin:0 0 16px;font-size:15px;color:${color};line-height:1.7">${text}</p>`;
}

// ── Welcome ───────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(data: {
  to: string;
  name: string;
}): Promise<void> {
  const firstName = data.name.split(' ')[0];

  const content = `
    ${greeting(firstName)}
    ${para(`Welcome to <strong>Subvoy</strong> — your subscription hub. You're all set to start tracking every recurring charge, in naira and dollars, from one place.`)}

    ${infoCard(`
      <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px">Get started in 3 steps</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #EDE9FE">
            <span style="font-size:14px;color:#4F46E5;font-weight:700;margin-right:10px">01</span>
            <span style="font-size:14px;color:#374151">Add your first subscription</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #EDE9FE">
            <span style="font-size:14px;color:#4F46E5;font-weight:700;margin-right:10px">02</span>
            <span style="font-size:14px;color:#374151">Set up reminders before renewals</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0">
            <span style="font-size:14px;color:#4F46E5;font-weight:700;margin-right:10px">03</span>
            <span style="font-size:14px;color:#374151">Fund your wallet to pay USD bills in naira</span>
          </td>
        </tr>
      </table>
    `)}

    ${ctaButton('Go to Dashboard →', appUrl())}
    ${para('Any questions? Just reply to this email.', true)}
  `;

  await send({
    to:      data.to,
    subject: `Welcome to Subvoy, ${firstName}!`,
    html:    layout({
      previewText:  'Your subscription hub is ready — add your first subscription now.',
      headerLabel:  'Welcome',
      content,
    }),
  });
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(data: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const firstName = data.name.split(' ')[0];

  const content = `
    ${greeting(firstName)}
    ${para('We received a request to reset your Subvoy password. Click the button below to choose a new one.')}

    ${ctaButton('Reset my password →', data.resetUrl)}

    ${infoCard(`
      <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6">
        ⏱ This link expires in <strong>1 hour</strong>.<br/>
        If you didn't request a reset, you can safely ignore this email — your password hasn't changed.
      </p>
    `, '#FFFBEB', '#FDE68A')}
  `;

  await send({
    to:      data.to,
    subject: 'Reset your Subvoy password',
    html:    layout({
      previewText:  'Click the link to reset your Subvoy password. Expires in 1 hour.',
      headerLabel:  'Password reset',
      headerColor:  'linear-gradient(135deg, #374151 0%, #111827 100%)',
      content,
    }),
  });
}

// ── Subscription reminder ─────────────────────────────────────────────────────

export async function sendReminderEmail(data: {
  toEmail: string;
  userName: string;
  subName: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysUntil: number;
}): Promise<void> {
  const firstName    = data.userName.split(' ')[0];
  const formatted    = fmtCurrency(data.amount, data.currency);
  const isToday      = data.daysUntil === 0;
  const isUrgent     = data.daysUntil <= 1;

  const whenLabel = isToday
    ? '<strong style="color:#EF4444">today</strong>'
    : `in <strong>${data.daysUntil} day${data.daysUntil !== 1 ? 's' : ''}</strong>`;

  const urgencyColor  = isUrgent ? '#EF4444' : data.daysUntil <= 3 ? '#F59E0B' : '#4F46E5';
  const badgeBg       = isUrgent ? '#FEF2F2' : data.daysUntil <= 3 ? '#FFFBEB' : '#EEF2FF';
  const badgeBorder   = isUrgent ? '#FECACA' : data.daysUntil <= 3 ? '#FDE68A' : '#C7D2FE';
  const headerColor   = isUrgent
    ? 'linear-gradient(135deg, #F87171 0%, #DC2626 100%)'
    : data.daysUntil <= 3
      ? 'linear-gradient(135deg, #FCD34D 0%, #D97706 100%)'
      : 'linear-gradient(135deg, #818CF8 0%, #4338CA 100%)';

  const content = `
    ${greeting(firstName)}
    ${para(`Your <strong>${data.subName}</strong> subscription renews ${whenLabel}.`)}

    ${infoCard(`
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="stat-table">
        <tr>
          <td style="padding:0 0 4px">
            <p style="margin:0;font-size:20px;font-weight:800;color:#111827">${data.subName}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#9CA3AF">Renewal date: ${data.dueDate}</p>
          </td>
          <td align="right" style="padding:0 0 4px">
            <p style="margin:0;font-size:28px;font-weight:900;color:${urgencyColor};letter-spacing:-0.5px">${formatted}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF;text-align:right">per billing cycle</p>
          </td>
        </tr>
      </table>
    `, badgeBg, badgeBorder)}

    ${isUrgent
      ? para(`⚡ <strong>Action needed</strong> — make sure your payment method is funded before the charge goes through.`)
      : para(`You have ${data.daysUntil} days to review, cancel, or ensure your wallet is funded.`, true)
    }

    ${ctaButton('View Dashboard →', appUrl(), urgencyColor)}
  `;

  const subject = isToday
    ? `⚡ ${data.subName} is due today — ${formatted}`
    : `📅 ${data.subName} renews in ${data.daysUntil} day${data.daysUntil !== 1 ? 's' : ''} — ${formatted}`;

  await send({
    to:      data.toEmail,
    subject,
    html:    layout({
      previewText:  `${data.subName} — ${formatted} due on ${data.dueDate}`,
      headerLabel:  isToday ? 'Due today' : `Due in ${data.daysUntil} days`,
      headerColor,
      content,
    }),
  });
}

// ── Workspace invite ──────────────────────────────────────────────────────────

export async function sendWorkspaceInviteEmail(data: {
  toEmail: string;
  workspaceName: string;
  role: string;
  acceptUrl: string;
}): Promise<void> {
  const content = `
    ${para(`You've been invited to join <strong>${esc(data.workspaceName)}</strong> on Subvoy as <strong>${esc(data.role)}</strong>.`)}
    ${para('Subvoy helps teams track subscriptions and compliance deadlines in one place.', true)}
    ${ctaButton('Accept invitation →', data.acceptUrl)}
    ${infoCard(`
      <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6">
        New to Subvoy? You'll be able to create your account when you accept.<br/>
        This invitation expires in <strong>14 days</strong>.
      </p>
    `)}
  `;

  await send({
    to:      data.toEmail,
    subject: `You're invited to join ${data.workspaceName} on Subvoy`,
    html:    layout({
      previewText: `Join ${data.workspaceName} on Subvoy`,
      headerLabel: 'Team invitation',
      content,
    }),
  });
}

// ── Compliance reminder ───────────────────────────────────────────────────────

export async function sendComplianceReminderEmail(data: {
  toEmail: string;
  userName: string;
  title: string;
  authority: string | null;
  dueDate: string;
  daysUntil: number;   // negative if overdue
}): Promise<void> {
  const firstName = data.userName.split(' ')[0];
  const overdue   = data.daysUntil < 0;
  const isToday   = data.daysUntil === 0;
  const urgent    = data.daysUntil <= 1;

  const whenLabel = overdue
    ? `<strong style="color:#EF4444">${Math.abs(data.daysUntil)} day${Math.abs(data.daysUntil) !== 1 ? 's' : ''} overdue</strong>`
    : isToday
      ? '<strong style="color:#EF4444">today</strong>'
      : `in <strong>${data.daysUntil} day${data.daysUntil !== 1 ? 's' : ''}</strong>`;

  const urgencyColor = urgent || overdue ? '#EF4444' : data.daysUntil <= 7 ? '#F59E0B' : '#4F46E5';
  const badgeBg      = urgent || overdue ? '#FEF2F2' : data.daysUntil <= 7 ? '#FFFBEB' : '#EEF2FF';
  const badgeBorder  = urgent || overdue ? '#FECACA' : data.daysUntil <= 7 ? '#FDE68A' : '#C7D2FE';
  const headerColor  = urgent || overdue
    ? 'linear-gradient(135deg, #F87171 0%, #DC2626 100%)'
    : 'linear-gradient(135deg, #818CF8 0%, #4338CA 100%)';

  const content = `
    ${greeting(firstName)}
    ${para(`Your compliance obligation <strong>${esc(data.title)}</strong> is due ${whenLabel}.`)}

    ${infoCard(`
      <p style="margin:0;font-size:20px;font-weight:800;color:#111827">${esc(data.title)}</p>
      ${data.authority ? `<p style="margin:4px 0 0;font-size:13px;color:#6B7280">${esc(data.authority)}</p>` : ''}
      <p style="margin:8px 0 0;font-size:13px;color:#9CA3AF">Due: ${esc(data.dueDate)}</p>
    `, badgeBg, badgeBorder)}

    ${overdue
      ? para('⚠ <strong>This deadline has passed.</strong> File as soon as possible to limit any penalties.')
      : para('Make sure this is filed before the deadline to avoid penalties.', true)}

    ${ctaButton('View Compliance →', `${appUrl()}/compliance`, urgencyColor)}
  `;

  const subject = overdue
    ? `⚠ ${data.title} is overdue`
    : isToday
      ? `⚡ ${data.title} is due today`
      : `📋 ${data.title} is due in ${data.daysUntil} day${data.daysUntil !== 1 ? 's' : ''}`;

  await send({
    to:      data.toEmail,
    subject,
    html:    layout({
      previewText: `${data.title} — due ${data.dueDate}`,
      headerLabel: overdue ? 'Overdue' : isToday ? 'Due today' : `Due in ${data.daysUntil} days`,
      headerColor,
      content,
    }),
  });
}

// ── Budget alert ──────────────────────────────────────────────────────────────

export async function sendBudgetAlertEmail(data: {
  toEmail: string;
  userName: string;
  monthlySpend: number;
  budgetLimit: number;
  currency: string;
  month: string;
}): Promise<void> {
  const firstName = data.userName.split(' ')[0];
  const spent     = fmtCurrency(data.monthlySpend, data.currency);
  const limit     = fmtCurrency(data.budgetLimit,  data.currency);
  const overage   = fmtCurrency(data.monthlySpend - data.budgetLimit, data.currency);
  const pct       = Math.round((data.monthlySpend / data.budgetLimit) * 100);

  const content = `
    ${greeting(firstName)}
    ${para(`Your subscription spend for <strong>${data.month}</strong> has exceeded your monthly budget.`)}

    ${infoCard(`
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="stat-table">
        <tr>
          <td style="padding:0 4px 0 0">
            <p style="margin:0;font-size:12px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px">Total spent</p>
            <p style="margin:6px 0 0;font-size:26px;font-weight:900;color:#EF4444;letter-spacing:-0.5px">${spent}</p>
          </td>
          <td align="right" style="padding:0 0 0 4px">
            <p style="margin:0;font-size:12px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px">Your budget</p>
            <p style="margin:6px 0 0;font-size:26px;font-weight:900;color:#374151;letter-spacing:-0.5px">${limit}</p>
          </td>
        </tr>
      </table>
      <!-- Progress bar -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:16px">
        <tr>
          <td style="background:#FEE2E2;border-radius:100px;height:8px;overflow:hidden">
            <div style="background:#EF4444;border-radius:100px;height:8px;width:100%"></div>
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0;font-size:13px;color:#EF4444;font-weight:600">
        ${pct}% of budget used — ${overage} over limit
      </p>
    `, '#FEF2F2', '#FECACA')}

    ${para(`Review your subscriptions to identify any you can pause or cancel.`, true)}

    ${ctaButton('View Analytics →', `${appUrl()}/analytics`, '#EF4444')}
    <p style="margin:16px 0 0;font-size:13px;color:#9CA3AF">
      Update your budget limit in
      <a href="${appUrl()}/settings" style="color:#6366F1;text-decoration:none">Settings</a>.
    </p>
  `;

  await send({
    to:      data.toEmail,
    subject: `🚨 Budget exceeded — you've spent ${spent} this month (limit: ${limit})`,
    html:    layout({
      previewText:  `You've spent ${spent} — ${overage} over your ${limit} budget for ${data.month}.`,
      headerLabel:  'Budget alert',
      headerColor:  'linear-gradient(135deg, #F87171 0%, #DC2626 100%)',
      content,
    }),
  });
}

// ── Wallet funded ─────────────────────────────────────────────────────────────

export async function sendWalletFundedEmail(data: {
  to: string;
  name: string;
  amountNgn: number;
  destination: 'ngn' | 'usd';
  usdCredited?: number;
  reference: string;
}): Promise<void> {
  const firstName   = data.name.split(' ')[0];
  const ngnFmt      = `₦${data.amountNgn.toLocaleString('en-NG')}`;
  const destLabel   = data.destination === 'usd' ? 'USD Card balance' : 'NGN balance';
  const credited    = data.destination === 'usd' && data.usdCredited != null
    ? `$${data.usdCredited.toFixed(2)}`
    : ngnFmt;

  const content = `
    ${greeting(firstName)}
    ${para(`Your Subvoy wallet has been funded successfully! Here's a summary of the transaction.`)}

    ${infoCard(`
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="stat-table">
        <tr>
          <td style="padding:4px 0">
            <p style="margin:0;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Amount paid</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:900;color:#111827;letter-spacing:-0.5px">${ngnFmt}</p>
          </td>
          <td align="right" style="padding:4px 0">
            <p style="margin:0;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Credited to</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#4F46E5">${destLabel}</p>
            <p style="margin:2px 0 0;font-size:20px;font-weight:900;color:#059669;letter-spacing:-0.5px">+${credited}</p>
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-size:12px;color:#9CA3AF">Reference: <code style="font-family:monospace;background:#F3F4F6;padding:2px 6px;border-radius:4px">${data.reference}</code></p>
    `, '#F0FDF4', '#BBF7D0')}

    ${para('Your wallet is ready — you can now pay your subscriptions directly from Subvoy.', true)}
    ${ctaButton('Go to Wallet →', `${appUrl()}/wallet`, '#059669')}
  `;

  await send({
    to:      data.to,
    subject: `Wallet funded — ${ngnFmt} added to your Subvoy account`,
    html:    layout({
      previewText:  `${ngnFmt} successfully added to your ${destLabel}.`,
      headerLabel:  'Payment confirmed',
      headerColor:  'linear-gradient(135deg, #34D399 0%, #059669 100%)',
      content,
    }),
  });
}

// ── Subscription payment confirmation ─────────────────────────────────────────

export async function sendPaymentConfirmationEmail(data: {
  to: string;
  name: string;
  subName: string;
  amount: number;
  currency: string;
  nextBillingDate: string;
}): Promise<void> {
  const firstName = data.name.split(' ')[0];
  const formatted = fmtCurrency(data.amount, data.currency);

  const content = `
    ${greeting(firstName)}
    ${para(`Your payment for <strong>${data.subName}</strong> has been processed from your Subvoy wallet.`)}

    ${infoCard(`
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="stat-table">
        <tr>
          <td>
            <p style="margin:0;font-size:18px;font-weight:800;color:#111827">${data.subName}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#9CA3AF">Next renewal: ${data.nextBillingDate}</p>
          </td>
          <td align="right">
            <p style="margin:0;font-size:13px;color:#6B7280">Amount paid</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:900;color:#4F46E5;letter-spacing:-0.5px">${formatted}</p>
          </td>
        </tr>
      </table>
    `)}

    ${para('Your subscription is active and the next billing date has been updated.', true)}
    ${ctaButton('View Dashboard →', appUrl())}
  `;

  await send({
    to:      data.to,
    subject: `✅ Payment processed — ${data.subName} ${formatted}`,
    html:    layout({
      previewText:  `${formatted} paid for ${data.subName}. Next renewal: ${data.nextBillingDate}.`,
      headerLabel:  'Payment confirmed',
      content,
    }),
  });
}

// ── Payment report ────────────────────────────────────────────────────────────

export async function sendPaymentReportEmail(data: {
  to: string;
  name: string;
  periodLabel: string;
  payments: { name: string; date: string; currency: string; amount: number }[];
}): Promise<void> {
  const firstName = data.name.split(' ')[0];
  const count     = data.payments.length;
  const display   = data.payments.slice(0, 50);   // cap email table at 50 rows
  const truncated = count > 50;

  // Totals per currency
  const totals = data.payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.currency] = (acc[p.currency] ?? 0) + p.amount;
    return acc;
  }, {});

  const totalLines = Object.entries(totals)
    .map(([cur, amt]) => {
      const fmt = cur === 'NGN'
        ? `₦${amt.toLocaleString('en-NG')}`
        : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amt);
      return `<span style="font-size:20px;font-weight:900;color:#4F46E5;margin-right:16px">${fmt}</span>`;
    })
    .join('') || '<span style="font-size:14px;color:#9CA3AF">No payments recorded</span>';

  const tableRows = display.map(p => {
    const amtFmt = p.currency === 'NGN'
      ? `₦${p.amount.toLocaleString('en-NG')}`
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency }).format(p.amount);
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#6B7280;white-space:nowrap">${esc(p.date)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-size:14px;color:#111827;font-weight:600">${esc(p.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-size:14px;color:#4F46E5;font-weight:700;text-align:right;white-space:nowrap">${amtFmt}</td>
      </tr>`;
  }).join('');

  const moreNote = truncated
    ? `<p style="margin:12px 0 0;font-size:12px;color:#9CA3AF">Showing 50 of ${count} payments — download the full CSV from the Reports page for all records.</p>`
    : '';

  const content = `
    ${greeting(firstName)}
    ${para(`Here is your payment report for <strong>${esc(data.periodLabel)}</strong>.`)}

    ${infoCard(`
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px">
        ${count} payment${count !== 1 ? 's' : ''}
      </p>
      ${totalLines}
    `)}

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin:20px 0">
      <thead>
        <tr style="background:#F9FAFB">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px">Date</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px">Subscription</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="3" style="padding:20px;text-align:center;color:#9CA3AF;font-size:14px">No payments in this period</td></tr>`}
      </tbody>
    </table>
    ${moreNote}

    ${ctaButton('Open Reports →', `${appUrl()}/reports`)}
    ${para('Export a full CSV from the Reports page to download all your payment records.', true)}
  `;

  await send({
    to:      data.to,
    subject: `Your Subvoy payment report — ${data.periodLabel}`,
    html:    layout({
      previewText:  `${count} payment${count !== 1 ? 's' : ''} recorded for ${data.periodLabel}.`,
      headerLabel:  'Payment Report',
      content,
    }),
  });
}

// ── Admin alert ───────────────────────────────────────────────────────────────

export async function sendAdminAlertEmail(data: {
  to: string;
  name: string;
  title: string;
  message: string;
  errorCount: number;
}): Promise<void> {
  const firstName = data.name.split(' ')[0];

  const content = `
    ${greeting(firstName)}
    ${para(`<strong>Alert:</strong> ${esc(data.title)}`)}
    ${para(esc(data.message))}

    ${infoCard(`
      <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6">
        🔴 <strong>${data.errorCount} errors</strong> were logged in the last 5 minutes.<br/>
        Visit the admin portal to review and resolve them.
      </p>
    `, '#FEF2F2', '#FECACA')}

    ${ctaButton('Open Error Logs →', `${appUrl()}/admin/errors`)}
  `;

  await send({
    to:      data.to,
    subject: `[Subvoy Alert] ${data.title}`,
    html:    layout({
      previewText:  `${data.errorCount} errors in the last 5 min — action required.`,
      headerLabel:  '⚠ System Alert',
      headerColor:  'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
      content,
    }),
  });
}

// ── Announcement broadcast ────────────────────────────────────────────────────

export async function sendAnnouncementEmail(data: {
  to: string;
  name: string;
  title: string;
  body: string;
}): Promise<void> {
  const firstName = data.name.split(' ')[0];

  const content = `
    ${greeting(firstName)}
    ${para(`<strong>${esc(data.title)}</strong>`)}
    ${para(esc(data.body))}

    ${ctaButton('Open Subvoy →', appUrl())}
    ${para('You received this message because you have an active Subvoy account.', true)}
  `;

  await send({
    to:      data.to,
    subject: `[Subvoy] ${data.title}`,
    html:    layout({
      previewText:  data.title,
      headerLabel:  'Announcement',
      content,
    }),
  });
}
