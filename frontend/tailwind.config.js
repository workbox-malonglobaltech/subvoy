import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Design System "Envoy" — semantic tokens (additive; existing indigo/gray
      //    utility classes keep working). App code should prefer these tokens. ──
      colors: {
        primary: { DEFAULT: '#4F46E5', fg: '#FFFFFF', 50: '#EEF2FF', 100: '#E0E7FF', 600: '#4F46E5', 700: '#4338CA' },
        surface: { DEFAULT: '#FFFFFF', subtle: '#F9FAFB', muted: '#F3F4F6' },
        fg:      { DEFAULT: '#111827', muted: '#4B5563', subtle: '#6B7280' },
        line:    { DEFAULT: '#E5E7EB', strong: '#D1D5DB' },
        success: { 50: '#ECFDF5', 500: '#10B981', 600: '#059669', 700: '#047857' },
        warning: { 50: '#FFFBEB', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' },
        error:   { 50: '#FEF2F2', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
        info:    { 50: '#EFF6FF', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8' },
      },
      fontFamily: {
        sans: ['"InterVariable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing?, fontWeight? }]
        eyebrow:  ['0.75rem',  { lineHeight: '1rem',    letterSpacing: '0.06em', fontWeight: '600' }],
        caption:  ['0.8125rem',{ lineHeight: '1rem',    fontWeight: '500' }],
        body:     ['0.875rem', { lineHeight: '1.25rem' }],
        'body-lg':['1rem',     { lineHeight: '1.5rem'  }],
        h4:       ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        h3:       ['1.25rem',  { lineHeight: '1.75rem', fontWeight: '600' }],
        h2:       ['1.5rem',   { lineHeight: '2rem',    fontWeight: '700' }],
        h1:       ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.01em', fontWeight: '700' }],
        display:  ['2.25rem',  { lineHeight: '2.5rem',  letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      boxShadow: {
        card:  '0 1px 3px rgb(16 24 40 / 0.10), 0 1px 2px rgb(16 24 40 / 0.06)',
        pop:   '0 4px 8px -2px rgb(16 24 40 / 0.10), 0 2px 4px -2px rgb(16 24 40 / 0.06)',
        modal: '0 12px 16px -4px rgb(16 24 40 / 0.10), 0 4px 6px -2px rgb(16 24 40 / 0.04)',
      },
      zIndex: {
        dropdown: '1000', overlay: '1040', modal: '1050', popover: '1060', toast: '1080',
      },
      keyframes: {
        'slide-in': {
          '0%':   { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}
