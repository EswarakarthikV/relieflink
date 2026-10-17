import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      // ── Design Tokens from Stitch (with overrides) ─────────────────────
      colors: {
        // Brand / Primary
        'navy-900':       '#0B2447',
        'navy-700':       '#14315C',
        'brand-600':      '#2563EB',
        'brand-100':      '#DBEAFE',

        // ReliefLink Brand Palette
        'brand-navy':     '#071426',
        'brand-teal':     '#22D3C5',
        'brand-amber':    '#FFBE55',

        // Application surfaces
        'bg-app':         '#F6F8FC',
        'surface':        '#FFFFFF',

        // Text
        'ink':            '#0F172A',
        'ink-muted':      '#64748B',

        // Semantic feedback
        'success':        '#15803D',
        'success-bg':     '#DCFCE7',
        'warning':        '#B45309',
        'warning-bg':     '#FEF3C7',
        'danger':         '#B91C1C',
        'danger-bg':      '#FEE2E2',
        'info':           '#1D4ED8',
        'info-bg':        '#DBEAFE',

        // Urgency spectrum
        'urgency-low':       '#64748B',
        'urgency-low-bg':    '#F1F5F9',
        'urgency-medium':    '#B45309',
        'urgency-medium-bg': '#FEF3C7',
        'urgency-high':      '#EA580C',  // ← override from Stitch (not #C2410C)
        'urgency-high-bg':   '#FFEDD5',
        'urgency-critical':  '#B91C1C',
        'urgency-critical-bg': '#FEE2E2',

        // Surface containers (Material-style token names from Stitch screens)
        'surface-lowest':    '#FFFFFF',
        'surface-low':       '#F2F3FF',
        'surface-container': '#EAEDFF',
        'surface-high':      '#E2E7FF',
        'surface-highest':   '#DAE2FD',

        // On-colors
        'on-surface':        '#131B2E',
        'on-surface-muted':  '#44474E',
        'outline':           '#74777F',
        'outline-variant':   '#C4C6CF',

        // Error (matches danger)
        'error-container':   '#FFDAD6',
        'on-error-container':'#93000A',
      },

      // ── Shape tokens ───────────────────────────────────────────────────
      borderRadius: {
        'card':  '12px',
        'input': '8px',
        'pill':  '9999px',
      },

      // ── Shadow tokens ──────────────────────────────────────────────────
      boxShadow: {
        'card':   '0 1px 3px rgba(11,36,71,0.08)',
        'sheet':  '0 -4px 24px rgba(11,36,71,0.12)',
        'nav':    '0 -1px 0 #E2E8F0',
        'fab':    '0 4px 12px rgba(37,99,235,0.35)',
      },

      // ── Typography scale ───────────────────────────────────────────────
      fontSize: {
        'h1':      ['24px', { lineHeight: '32px',  letterSpacing: '-0.015em', fontWeight: '600' }],
        'h2':      ['20px', { lineHeight: '28px',  letterSpacing: '-0.01em',  fontWeight: '600' }],
        'h3':      ['18px', { lineHeight: '24px',                             fontWeight: '600' }],
        'h4':      ['16px', { lineHeight: '22px',                             fontWeight: '600' }],
        'body':    ['16px', { lineHeight: '24px',                             fontWeight: '400' }],
        'medium':  ['16px', { lineHeight: '24px',                             fontWeight: '500' }],
        'caption': ['13px', { lineHeight: '18px',  letterSpacing: '0.01em',  fontWeight: '500' }],
        'label':   ['11px', { lineHeight: '16px',                             fontWeight: '500' }],
      },

      // ── Spacing & touch targets ────────────────────────────────────────
      minHeight: {
        'touch': '48px',
      },

      // ── Animation ─────────────────────────────────────────────────────
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
      animation: {
        'skeleton': 'skeleton-pulse 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
