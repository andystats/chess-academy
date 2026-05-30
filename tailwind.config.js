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
        // Tao-inspired learning-tool palette: neutral foundation with clear accent signals.
        brand: {
          50: '#edf6fc',
          100: '#dff3fb',
          300: '#38c6ff',
          400: '#1c9ed3',
          500: '#0077a8',
          600: '#075e84',
          700: '#0a4057',
        },
        accent: {
          mint: '#5bfdb2',
          teal: '#00897b',
          orange: '#e07020',
          yellow: '#ffef45',
          ink: '#1a1a1a',
          paper: '#fffef5',
        },
        correct: '#16a34a',
        retry: '#e07020',
        // Semantic ink/paper pair for the high-contrast "editorial print" treatment.
        foreground: '#1a1a1a',
        background: '#ffffff',
      },
      borderRadius: {
        xl: '0.5rem',
        '2xl': '0.5rem',
      },
      borderWidth: {
        3: '3px',
      },
      boxShadow: {
        // Hard offset "print" shadows — no blur, pure ink/accent offset (the tao-rwd signature).
        hard: '4px 4px 0 0 #1a1a1a',
        'hard-lg': '6px 6px 0 0 #1a1a1a',
        'hard-brand': '5px 5px 0 0 #1c9ed3',
        'hard-yellow': '5px 5px 0 0 #ffef45',
      },
      fontFamily: {
        display: ['"Work Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        book: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      minHeight: {
        touch: '3rem',
      },
    },
  },
  plugins: [typography],
}
