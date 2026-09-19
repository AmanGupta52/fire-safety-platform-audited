/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Industrial theme v2: charcoal steel + fire-engine red + hazard amber, on a cool
        // brushed-grey background instead of the old warm paper — grounded in equipment
        // colourways (extinguisher red, hazard tape amber/black, galvanised steel) rather
        // than a generic warm palette.
        ink: { DEFAULT: '#1A1D1F', soft: '#242830', softer: '#2E333C' },
        paper: '#EEF1F0',
        card: '#FFFFFF',
        line: '#DBDFDC',
        // `safety` is the authoritative name for the primary red going forward — CTAs, alerts,
        // price emphasis, active nav state. Never used as a large background fill.
        safety: { DEFAULT: '#D32B1E', dark: '#A32014', light: '#FCE6E2' },
        // `brand` is kept as an alias of `safety` (same values) so pages not yet migrated to the
        // new token name keep rendering correctly. New/updated components should use `safety`.
        brand: { DEFAULT: '#D32B1E', dark: '#A32014', light: '#FCE6E2' },
        amber: { DEFAULT: '#F2A900', light: '#FDF0D2' },
        forest: { DEFAULT: '#1F7A4D', light: '#E3F2E9' },
        slateink: '#454B52',
        slate: { 50: '#F5F6F5', 100: '#EAEDEA', 400: '#8B9198', 600: '#565C63', 700: '#3B4046' }
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
