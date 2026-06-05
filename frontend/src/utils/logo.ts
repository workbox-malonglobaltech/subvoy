/**
 * Resolves brand logo URLs from a subscription service name.
 *
 * Priority chain (handled in ServiceLogo component):
 *   1. Logo.dev  — high-quality brand logos (free plan, set VITE_LOGO_DEV_TOKEN)
 *   2. Google S2 favicons — reliable fallback, no key required
 *   3. Initials avatar — final fallback rendered in JSX
 */

/** Well-known service name → domain mappings */
const KNOWN_DOMAINS: Record<string, string> = {
  // Streaming
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  'apple music': 'apple.com',
  'apple tv': 'apple.com',
  'apple tv+': 'apple.com',
  'disney+': 'disneyplus.com',
  'disney plus': 'disneyplus.com',
  hulu: 'hulu.com',
  'hbo max': 'hbomax.com',
  max: 'max.com',
  'paramount+': 'paramountplus.com',
  peacock: 'peacocktv.com',
  'amazon prime': 'amazon.com',
  'prime video': 'amazon.com',
  youtube: 'youtube.com',
  'youtube premium': 'youtube.com',
  twitch: 'twitch.tv',
  crunchyroll: 'crunchyroll.com',
  dazn: 'dazn.com',

  // Music
  tidal: 'tidal.com',
  deezer: 'deezer.com',
  pandora: 'pandora.com',
  soundcloud: 'soundcloud.com',

  // Software & SaaS
  adobe: 'adobe.com',
  'adobe creative cloud': 'adobe.com',
  'microsoft 365': 'microsoft.com',
  'office 365': 'microsoft.com',
  microsoft: 'microsoft.com',
  dropbox: 'dropbox.com',
  'google one': 'one.google.com',
  'google workspace': 'workspace.google.com',
  github: 'github.com',
  notion: 'notion.so',
  slack: 'slack.com',
  zoom: 'zoom.us',
  figma: 'figma.com',
  canva: 'canva.com',
  '1password': '1password.com',
  lastpass: 'lastpass.com',
  dashlane: 'dashlane.com',
  nordvpn: 'nordvpn.com',
  expressvpn: 'expressvpn.com',
  surfshark: 'surfshark.com',
  grammarly: 'grammarly.com',
  evernote: 'evernote.com',
  todoist: 'todoist.com',
  linear: 'linear.app',
  jira: 'atlassian.com',
  confluence: 'atlassian.com',
  atlassian: 'atlassian.com',
  trello: 'trello.com',
  asana: 'asana.com',
  monday: 'monday.com',
  airtable: 'airtable.com',
  webflow: 'webflow.com',
  framer: 'framer.com',
  loom: 'loom.com',
  intercom: 'intercom.com',
  hubspot: 'hubspot.com',
  salesforce: 'salesforce.com',
  mailchimp: 'mailchimp.com',
  sendgrid: 'sendgrid.com',
  twilio: 'twilio.com',
  vercel: 'vercel.com',
  netlify: 'netlify.com',
  heroku: 'heroku.com',
  digitalocean: 'digitalocean.com',
  aws: 'aws.amazon.com',
  azure: 'azure.microsoft.com',
  'google cloud': 'cloud.google.com',
  cloudflare: 'cloudflare.com',
  'new relic': 'newrelic.com',
  datadog: 'datadoghq.com',
  sentry: 'sentry.io',
  supabase: 'supabase.com',
  planetscale: 'planetscale.com',
  mongodb: 'mongodb.com',

  // Gaming
  'xbox game pass': 'xbox.com',
  xbox: 'xbox.com',
  'playstation plus': 'playstation.com',
  'ps plus': 'playstation.com',
  'nintendo online': 'nintendo.com',
  'nintendo switch online': 'nintendo.com',
  steam: 'store.steampowered.com',
  'ea play': 'ea.com',
  'ubisoft+': 'ubisoft.com',

  // Health & Fitness
  headspace: 'headspace.com',
  calm: 'calm.com',
  peloton: 'onepeloton.com',
  noom: 'noom.com',
  myfitnesspal: 'myfitnesspal.com',
  whoop: 'whoop.com',
  strava: 'strava.com',

  // Finance
  mint: 'mint.com',
  ynab: 'ynab.com',
  'you need a budget': 'ynab.com',
  robinhood: 'robinhood.com',
  coinbase: 'coinbase.com',

  // Food & Delivery
  'hello fresh': 'hellofresh.com',
  hellofresh: 'hellofresh.com',
  'blue apron': 'blueapron.com',
  factor: 'factormeals.com',
  doordash: 'doordash.com',
  'doordash dashpass': 'doordash.com',
  'uber one': 'uber.com',
  instacart: 'instacart.com',

  // Education
  coursera: 'coursera.org',
  udemy: 'udemy.com',
  skillshare: 'skillshare.com',
  'linkedin learning': 'linkedin.com',
  duolingo: 'duolingo.com',
  masterclass: 'masterclass.com',
  pluralsight: 'pluralsight.com',
  "o'reilly": 'oreilly.com',

  // News & Reading
  'new york times': 'nytimes.com',
  nytimes: 'nytimes.com',
  'the atlantic': 'theatlantic.com',
  medium: 'medium.com',
  substack: 'substack.com',
  audible: 'audible.com',
  kindle: 'amazon.com',
  scribd: 'scribd.com',
};

function guessDomain(serviceName: string): string {
  const lower = serviceName.toLowerCase().trim();
  if (KNOWN_DOMAINS[lower]) return KNOWN_DOMAINS[lower];
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (lower.includes(key) || key.includes(lower)) return domain;
  }
  const slug = lower.replace(/[^a-z0-9]/g, '');
  return `${slug}.com`;
}

/**
 * Returns an ordered list of image URLs to try for a service name.
 * The ServiceLogo component tries each in order, falling back to the next on error.
 *
 *  [0] Logo.dev   — full brand logo (requires VITE_LOGO_DEV_TOKEN; skipped if unset)
 *  [1] Google S2  — site favicon at 128 px, no key needed, very reliable
 */
export function getLogoUrls(serviceName: string): string[] {
  const domain = guessDomain(serviceName);
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN as string | undefined;
  const urls: string[] = [];

  if (token) {
    urls.push(`https://img.logo.dev/${domain}?token=${token}&size=128`);
  }

  urls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);

  return urls;
}

/** @deprecated Use getLogoUrls instead */
export function getLogoUrl(serviceName: string): string {
  return getLogoUrls(serviceName)[0] ?? '';
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-pink-500', 'bg-rose-500',
  'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-blue-500',
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
