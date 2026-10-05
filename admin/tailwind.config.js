/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'var(--color-ink, #1B2027)',
          soft: 'var(--color-ink-soft, #262D37)',
          softer: 'var(--color-ink-softer, #323B47)'
        },
        paper: 'var(--color-paper, #F7F5F1)',
        card: 'var(--color-card, #FFFFFF)',
        line: 'var(--color-line, #E4E0D8)',
        brand: {
          DEFAULT: '#C1272D',
          dark: '#9A1E23',
          light: '#FBEAEA'
        },
        amber: {
          DEFAULT: '#E1890F',
          light: '#FDF1DE'
        },
        forest: {
          DEFAULT: '#2E7D4F',
          light: '#E6F3EB'
        },
        slateink: '#4B5563'
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
