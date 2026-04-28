/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: {
          primary: '#0a0b0e',
          secondary: '#111318',
          card: '#16181f',
          hover: '#1c1f29',
          border: '#1f2333',
        },
        accent: {
          green: '#00d4aa',
          red: '#ff4d6d',
          yellow: '#fbbf24',
          blue: '#3b82f6',
          purple: '#8b5cf6',
        },
        text: {
          primary: '#e8eaf0',
          secondary: '#8b91a8',
          muted: '#4a5068',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
