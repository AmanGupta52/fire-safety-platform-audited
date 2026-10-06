/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme colours are stored as space-separated RGB channels in index.css so Tailwind's
        // opacity modifiers (bg-ink/40, bg-safety-light/30, ...) work in BOTH light and dark mode.
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          soft: 'rgb(var(--color-ink-soft) / <alpha-value>)',
          softer: 'rgb(var(--color-ink-softer) / <alpha-value>)'
        },
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        // Always-dark surface (footer, hero bands, top bar). `ink` flips to a light colour in dark
        // mode, so anything that must stay dark in both themes uses `inverse` instead.
        inverse: 'rgb(var(--color-inverse) / <alpha-value>)',
        // Text colour to put on top of a `bg-ink` fill (dark button in light mode, light in dark mode).
        'on-ink': 'rgb(var(--color-on-ink) / <alpha-value>)',
        // `safety` is the authoritative name for the primary red going forward — CTAs, alerts,
        // price emphasis, active nav state. Never used as a large background fill.
        safety: { DEFAULT: '#D32B1E', dark: '#A32014', light: 'rgb(var(--color-safety-light) / <alpha-value>)' },
        amber: { DEFAULT: '#F2A900', light: 'rgb(var(--color-amber-light) / <alpha-value>)' },
        forest: { DEFAULT: '#1F7A4D', light: 'rgb(var(--color-forest-light) / <alpha-value>)' },
        slateink: 'rgb(var(--color-slateink) / <alpha-value>)',
        slate: {
          50: 'rgb(var(--color-slate-50) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Condensed industrial face for headings — evokes stencilled tank labels and gauge
        // faceplates rather than a generic display sans.
        display: ['Oswald', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        sm: '4px', DEFAULT: '8px', lg: '12px', xl: '16px',
        // Canonical radii per the design system: one for cards, one for buttons/inputs, one for pills.
        card: '10px', btn: '8px', pill: '999px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(26,29,31,0.04), 0 2px 8px rgba(26,29,31,0.06)',
        'card-hover': '0 4px 12px rgba(26,29,31,0.10), 0 2px 4px rgba(26,29,31,0.06)',
        raised: '0 8px 24px rgba(26,29,31,0.12)',
        // Legacy names kept as aliases for pages not yet migrated.
        lift: '0 8px 24px rgba(26,29,31,0.12)',
        popover: '0 8px 24px rgba(26,29,31,0.14)'
      }
    }
  },
  plugins: []
};
