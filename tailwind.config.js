/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f0f5fb',
          100: '#dce8f5',
          200: '#b4cfe9',
          300: '#7aaed8',
          400: '#3d89c5',
          500: '#1e6dac',
          600: '#155490',
          700: '#124174',
          800: '#0e2f57',
          900: '#0a1e3a',
          950: '#060e1d',
        },
      },
      fontFamily: {
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        mono:  ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
