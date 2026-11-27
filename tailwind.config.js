/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bahi: { DEFAULT: '#9E1B1F', dark: '#6E1013', light: '#C8383C' },   // red cloth cover of the register
        patra: { DEFAULT: '#FAEFC4', deep: '#F1DE96', line: '#D9C27A' },    // ledger paper and its ruling
        neel: { DEFAULT: '#1D2766', soft: '#3B4690', faint: '#8C93C2' },    // indigo ink
        mohar: { DEFAULT: '#1C7A48', light: '#2E9A60' },                    // green "sahi" stamp
        haldi: { DEFAULT: '#E0A100', light: '#F5C84B' },
      },
      fontFamily: {
        display: ['"Yatra One"', '"Hind"', 'system-ui', 'sans-serif'],
        body: ['"Hind"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        stamp: {
          '0%': { transform: 'scale(2.2) rotate(-18deg)', opacity: '0' },
          '60%': { transform: 'scale(0.92) rotate(-9deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-9deg)', opacity: '0.9' },
        },
        ink: { '0%': { clipPath: 'inset(0 100% 0 0)' }, '100%': { clipPath: 'inset(0 0 0 0)' } },
      },
      animation: {
        stamp: 'stamp 420ms cubic-bezier(.2,.9,.3,1.2) both',
        ink: 'ink 600ms ease-out both',
      },
    },
  },
  plugins: [],
};
