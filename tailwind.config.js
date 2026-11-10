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
        gov: {
          blue: '#002B66',
          navy: '#0b192c',
          gold: '#FFD700',
          yellow: '#F59E0B',
          red: '#DC2626',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash-glow': 'flashGlow 1.5s ease-in-out infinite',
      },
      keyframes: {
        flashGlow: {
          '0%, 100%': { borderColor: '#F59E0B', boxShadow: '0 0 25px rgba(245, 158, 11, 0.7)' },
          '50%': { borderColor: '#10B981', boxShadow: '0 0 35px rgba(16, 185, 129, 0.9)' },
        }
      }
    },
  },
  plugins: [],
}
