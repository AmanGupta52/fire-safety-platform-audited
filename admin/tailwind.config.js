/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme colours are stored as space-separated RGB channels in index.css so Tailwind's
        // opacity modifiers (bg-ink/40, bg-brand-light/30, ...) work in BOTH light and dark mode.
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          soft: 'rgb(var(--color-ink-soft) / <alpha-value>)',
          softer: 'rgb(var(--color-ink-softer) / <alpha-value>)'
        },
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        // Always-dark surface (sidebar, login hero). `ink` flips to a light colour in dark mode,
        // so anything that must stay dark in both themes uses `inverse` instead.
        inverse: 'rgb(var(--color-inverse) / <alpha-value>)',
        // Text colour to put on top of a `bg-ink` fill (dark button in light mode, light in dark mode).
        'on-ink': 'rgb(var(--color-on-ink) / <alpha-value>)',
        brand: {
          DEFAULT: '#C1272D',
          dark: '#9A1E23',
          light: 'rgb(var(--color-brand-light) / <alpha-value>)'
        },
        amber: {
          DEFAULT: '#E1890F',
          light: 'rgb(var(--color-amber-light) / <alpha-value>)'
        },
        forest: {
          DEFAULT: '#2E7D4F',
          light: 'rgb(var(--color-forest-light) / <alpha-value>)'
        },
        slateink: 'rgb(var(--color-slateink) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,32,39,0.04)',
        popover: '0 8px 24px rgba(27,32,39,0.12)'
      }
    }
  },
  plugins: []
};
