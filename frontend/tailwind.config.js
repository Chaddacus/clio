/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#131312',
          dim: '#131312',
          bright: '#393938',
          container: {
            lowest: '#0e0e0d',
            low: '#1c1c1b',
            DEFAULT: '#20201f',
            high: '#2a2a29',
            highest: '#353533',
          },
          variant: '#353533',
          tint: '#ffb59c',
        },
        'on-surface': {
          DEFAULT: '#e5e2e0',
          variant: '#dec0b6',
        },
        primary: {
          DEFAULT: '#ffb59c',
          container: '#ff7f50',
          fixed: { DEFAULT: '#ffdbcf', dim: '#ffb59c' },
        },
        secondary: {
          DEFAULT: '#ffe2ab',
          container: '#ffbf00',
        },
        tertiary: {
          DEFAULT: '#c7c6c4',
          container: '#a4a4a2',
        },
        'on-tertiary': '#303130',
        outline: { DEFAULT: '#a68b82', variant: '#57423b' },
        error: { DEFAULT: '#ffb4ab', container: '#93000a' },
        'on-error': '#690005',
      },
      fontFamily: {
        editorial: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 2s infinite',
      },
      keyframes: {
        wave: {
          '0%': { transform: 'rotate(0.0deg)' },
          '10%': { transform: 'rotate(14deg)' },
          '20%': { transform: 'rotate(-8deg)' },
          '30%': { transform: 'rotate(14deg)' },
          '40%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(10.0deg)' },
          '60%': { transform: 'rotate(0.0deg)' },
          '100%': { transform: 'rotate(0.0deg)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
