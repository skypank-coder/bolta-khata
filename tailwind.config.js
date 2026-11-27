/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mitti: { 50: '#fdf6ec', 100: '#f8e8d2', 200: '#efcfa6', 300: '#e2ad72', 500: '#c2703a', 700: '#7c2d12', 900: '#3b1406' },
        haldi: '#e8a317',
        neel: '#1e3a8a',
        patta: '#2f6b3a',
      },
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        body: ['"Mukta"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
