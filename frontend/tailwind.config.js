/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        rcpit: {
          50: '#f0f6ff',
          100: '#e0edff',
          200: '#b9d9fe',
          300: '#7cb9fd',
          400: '#3695fa',
          500: '#0c75eb',
          600: '#0059c8',
          700: '#0047a3',
          800: '#053c85',
          900: '#0a336f',
          950: '#072049',
        },
      },
    },
  },
  plugins: [],
}
