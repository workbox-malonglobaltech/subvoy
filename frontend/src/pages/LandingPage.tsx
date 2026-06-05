import { Link } from 'react-router-dom';
import { LogoMark } from '../components/LogoMark';

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: 'Track everything in one place',
    desc: 'Netflix, Spotify, AWS, Canva — all your subscriptions in a single dashboard, whether they charge in dollars or naira.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    title: 'Smart reminders before every charge',
    desc: "Get email alerts 3 and 7 days before renewals so you're never caught off guard by an unexpected deduction.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: 'Dual-currency wallet',
    desc: 'Fund a USD wallet from your naira account at competitive rates. Pay USD subscriptions directly — no more card declines.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Spend analytics',
    desc: 'See exactly where your money goes — by category, by month, and by currency — with clear charts and zero spreadsheets.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Add your subscriptions',
    desc: 'Type them in manually or upload a bank CSV — Subvoy detects recurring payments automatically.',
  },
  {
    num: '02',
    title: 'Set reminders & budget limits',
    desc: "Choose how many days' notice you want before each renewal. Set a monthly budget cap to stay in control.",
  },
  {
    num: '03',
    title: "Relax — we'll handle the alerts",
    desc: 'Get timely email reminders, spot subscription creep early, and keep your spending on track.',
  },
];

// Mock subscription cards for the hero mockup
const MOCK_SUBS = [
  { name: 'Netflix', amount: '$15.99', cycle: 'monthly', tag: 'Entertainment', days: 3, urgent: true },
  { name: 'Spotify', amount: '$9.99', cycle: 'monthly', tag: 'Music', days: 12, urgent: false },
  { name: 'AWS',     amount: '$42.00', cycle: 'monthly', tag: 'Software & SaaS', days: 8, urgent: false },
  { name: 'Canva',   amount: '$12.99', cycle: 'yearly', tag: 'Design', days: 45, urgent: false },
];

function MockDashboard() {
  return (
    <div className="w-full max-w-lg mx-auto bg-gray-50 rounded-2xl border border-gray-200 shadow-2xl overflow-hidden select-none pointer-events-none">
      {/* Mock header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <span className="text-base font-bold text-indigo-600">Subvoy</span>
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">+ Add</div>
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Mock summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Monthly</p>
            <p className="mt-1 text-xl font-bold text-gray-900">$80.97</p>
            <p className="text-xs text-emerald-600 mt-0.5">₦129,552/mo</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active subs</p>
            <p className="mt-1 text-xl font-bold text-gray-900">4</p>
            <p className="text-xs text-gray-400 mt-0.5">2 due this week</p>
          </div>
        </div>

        {/* Mock wallet widget */}
        <div className="bg-gradient-to-r from-indigo-400 to-indigo-700 rounded-xl p-3 text-white flex items-center justify-between">
          <div>
            <p className="text-xs opacity-75">Wallet · USD</p>
            <p className="text-lg font-bold">$120.00</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-75">NGN</p>
            <p className="text-sm font-semibold">₦4,800</p>
          </div>
        </div>

        {/* Mock subscription list */}
        <div className="space-y-2">
          {MOCK_SUBS.map(sub => (
            <div key={sub.name} className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-indigo-700">{sub.name[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{sub.name}</p>
                  <p className="text-xs text-gray-400">{sub.tag}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{sub.amount}</p>
                <p className={`text-xs font-medium ${sub.urgent ? 'text-red-500' : 'text-gray-400'}`}>
                  {sub.urgent ? `⚠ In ${sub.days} days` : `In ${sub.days} days`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Navigation ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <LogoMark />

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Get started free
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="bg-gradient-to-b from-indigo-50/60 to-white pt-16 pb-24 px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Built for Nigeria & the diaspora
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
                Every subscription.
                <br />
                <span className="text-indigo-600">Always in control.</span>
              </h1>
              <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-md">
                Subvoy tracks all your recurring payments — Netflix, Spotify, AWS and more —
                in one dashboard. Get reminders before charges hit, and pay USD bills
                directly from your naira wallet.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-base"
                >
                  Start tracking free
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 font-medium px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors text-base"
                >
                  Sign in
                </Link>
              </div>
              <p className="mt-4 text-sm text-gray-400">No credit card required · Free to use</p>
            </div>

            {/* Mock dashboard preview */}
            <div className="hidden lg:block">
              <MockDashboard />
            </div>
          </div>
        </section>

        {/* ── Mobile mockup ── */}
        <section className="lg:hidden px-4 pb-12 -mt-4">
          <MockDashboard />
        </section>

        {/* ── Social proof strip ── */}
        <section className="border-y border-gray-100 bg-gray-50 py-6 px-4">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-center text-sm text-gray-500">
            <div>
              <span className="block text-2xl font-bold text-gray-900">₦ + $</span>
              Dual-currency support
            </div>
            <div className="hidden sm:block w-px h-8 bg-gray-200"></div>
            <div>
              <span className="block text-2xl font-bold text-gray-900">3 & 7 days</span>
              Advance renewal alerts
            </div>
            <div className="hidden sm:block w-px h-8 bg-gray-200"></div>
            <div>
              <span className="block text-2xl font-bold text-gray-900">Auto</span>
              Wallet top-up
            </div>
            <div className="hidden sm:block w-px h-8 bg-gray-200"></div>
            <div>
              <span className="block text-2xl font-bold text-gray-900">0 fees</span>
              Free to start
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900">
                Everything you need to stay in control
              </h2>
              <p className="mt-3 text-gray-500 max-w-xl mx-auto">
                Subvoy is purpose-built for people managing subscriptions across currencies —
                so you always know what's coming and when.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {FEATURES.map(f => (
                <div key={f.title} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="bg-indigo-950 py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-white">How it works</h2>
              <p className="mt-3 text-indigo-300">Set up in under 3 minutes</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-8">
              {STEPS.map((step, i) => (
                <div key={step.num} className="relative">
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden sm:block absolute top-8 left-full w-8 h-px bg-indigo-700 -translate-x-4 z-0" aria-hidden="true" />
                  )}
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-800 border border-indigo-700 flex items-center justify-center mb-4">
                      <span className="text-xl font-bold text-indigo-300">{step.num}</span>
                    </div>
                    <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-indigo-300 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pain point callout ── */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-8 sm:p-12 border border-indigo-100">
              <div className="grid sm:grid-cols-2 gap-10 items-center">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">
                    USD subscriptions killing your naira card?
                  </h2>
                  <p className="mt-4 text-gray-600 leading-relaxed">
                    Subvoy's built-in wallet lets you pre-fund USD at today's rate from your naira account.
                    When Netflix or Spotify renews, it draws from your wallet — no card decline, no surprise charge.
                  </p>
                  <Link
                    to="/register"
                    className="mt-6 inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Open your wallet
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                    </svg>
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'USD Balance', value: '$120.00', sub: 'Available to spend', color: 'bg-indigo-600 text-white' },
                    { label: 'NGN Balance', value: '₦4,800', sub: 'Top up anytime', color: 'bg-white border border-gray-200' },
                    { label: 'Auto top-up', value: 'Active', sub: 'Threshold: $20', color: 'bg-emerald-50 border border-emerald-200' },
                    { label: 'Rate today', value: '₦1,600', sub: 'per $1 USD', color: 'bg-white border border-gray-200' },
                  ].map(card => (
                    <div key={card.label} className={`${card.color} rounded-xl p-4 shadow-sm`}>
                      <p className={`text-xs font-medium ${card.color.includes('indigo-600') ? 'text-indigo-200' : 'text-gray-500'}`}>{card.label}</p>
                      <p className={`text-lg font-bold mt-1 ${card.color.includes('indigo-600') ? 'text-white' : card.color.includes('emerald') ? 'text-emerald-700' : 'text-gray-900'}`}>{card.value}</p>
                      <p className={`text-xs mt-0.5 ${card.color.includes('indigo-600') ? 'text-indigo-300' : card.color.includes('emerald') ? 'text-emerald-600' : 'text-gray-400'}`}>{card.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-20 px-4 bg-gradient-to-b from-white to-indigo-50">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Stop losing money to forgotten subscriptions
            </h2>
            <p className="mt-4 text-gray-500 text-lg">
              Join Subvoy today. It takes 3 minutes to add your first subscription and set up reminders.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-base"
              >
                Create free account
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center text-gray-600 font-medium px-8 py-3.5 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors text-base"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-400">Free to use · No credit card required</p>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="footer-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#818CF8"/>
                      <stop offset="100%" stopColor="#4338CA"/>
                    </linearGradient>
                  </defs>
                  <rect width="32" height="32" rx="7" fill="url(#footer-g)"/>
                  <rect x="8" y="7" width="16" height="10" rx="2.5" fill="white" fillOpacity="0.35" transform="rotate(-6 16 12)"/>
                  <rect x="7" y="12" width="16" height="10" rx="2.5" fill="white"/>
                  <rect x="9" y="14.5" width="5" height="3.5" rx="1" fill="#C7D2FE"/>
                  <circle cx="23" cy="9" r="4.5" fill="#312E81" fillOpacity="0.9"/>
                  <path d="M 23 5.5 A 3.5 3.5 0 1 1 19.8 11.5" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
                  <path d="M 18.8 10.3 L 19.8 11.5 L 21.3 10.8" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-white font-bold">
                  <span className="font-normal">Sub</span>voy
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                Your trusted subscription envoy.
                Track, manage, and control every recurring payment.
              </p>
            </div>

            {/* Product links */}
            <div>
              <h4 className="text-white text-sm font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/register" className="hover:text-white transition-colors">Get started</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Sign in</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white text-sm font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><span className="opacity-50 cursor-default">Privacy Policy</span></li>
                <li><span className="opacity-50 cursor-default">Terms of Service</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <p>© {new Date().getFullYear()} Subvoy. All rights reserved.</p>
            <p>subvoy.com</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
