import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Kid-friendly brand palette: warm, high-contrast, calm.
        brand: {
          50: '#eef6ff',
          100: '#d9ecff',
          500: '#2f6fed',
          600: '#1d57d6',
          700: '#1745ab',
        },
        // Semantic feedback colors, deliberately friendly rather than alarming.
        correct: '#16a34a',
        retry: '#ea8a2f',
      },
      borderRadius: {
        // Generous rounding throughout for a softer, kid-appropriate feel.
        xl: '1rem',
        '2xl': '1.5rem',
      },
      fontFamily: {
        display: ['"Baloo 2"', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        // Large, finger-friendly tap targets for ages 6-12.
        touch: '3rem',
      },
    },
  },
  plugins: [typography],
}
