/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f6fa', 100: '#e8eaf2', 200: '#cbcfe0', 300: '#a3a9c6',
          400: '#757ea6', 500: '#545d88', 600: '#41486c', 700: '#353a57',
          800: '#22263c', 900: '#141728', 950: '#0a0c18',
        },
        brand: {
          50: '#f5f2ff', 100: '#ebe5ff', 200: '#d9ceff', 300: '#bda8ff',
          400: '#9b77ff', 500: '#7c45f7', 600: '#6d28d9', 700: '#5b21b6',
          800: '#4a1d93', 900: '#2e1065', 950: '#1c0942',
        },
        gold: {
          50: '#fffaeb', 100: '#fdf0c8', 200: '#fbe08c', 300: '#f8ca50',
          400: '#f5b229', 500: '#e79111', 600: '#cc6c0b', 700: '#a94c0d',
          800: '#8a3c12', 900: '#733212',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Sora', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(10,12,24,.04), 0 8px 24px -12px rgba(10,12,24,.18)',
        lift: '0 2px 4px rgba(10,12,24,.04), 0 18px 40px -16px rgba(10,12,24,.28)',
        card: '0 30px 60px -24px rgba(10,12,24,.45)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        'scale-in': { '0%': { opacity: 0, transform: 'scale(.96)' }, '100%': { opacity: 1, transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'fade-up': 'fade-up .4s cubic-bezier(.2,.8,.2,1) both',
        'scale-in': 'scale-in .25s cubic-bezier(.2,.8,.2,1) both',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
}
