/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: {
          DEFAULT: '#0f172a',
          card: 'rgba(15, 23, 42, 0.75)',
          hover: '#1e293b',
        },
        brand: {
          primary: '#6366f1',
          cyan: '#06b6d4',
          glow: '#818cf8',
        },
        medallion: {
          bronze: '#f97316',
          silver: '#94a3b8',
          gold: '#eab308',
          report: '#10b981',
        },
        border: 'rgba(51, 65, 85, 0.4)',
      },
      backdropBlur: {
        glass: '16px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
