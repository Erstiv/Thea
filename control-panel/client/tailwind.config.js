/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        thea: {
          bg: '#0a0a0f',
          surface: '#141420',
          card: '#1a1a2e',
          border: '#2a2a3e',
          accent: '#6366f1',
          'accent-hover': '#818cf8',
          gold: '#f59e0b',
          text: '#e2e8f0',
          muted: '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
