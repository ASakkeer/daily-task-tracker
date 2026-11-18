/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Google Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          primary: '#ff2d5f',
          primaryHover: '#e62252',
          primaryLight: '#ff668a',
          primaryGlow: 'rgba(255, 45, 95, 0.4)',
          cyan: '#ff2d5f',
          cyanHover: '#e62252',
          cyanLight: '#ff668a',
          cyanGlow: 'rgba(255, 45, 95, 0.4)',
        },
        dark: {
          base: '#020612',
          surface: '#050c21',
          card: '#08122f',
          elevated: '#0c1a40',
          border: '#142552',
          borderSubtle: '#101d3f',
        },
        obsidian: {
          950: '#020612',
          900: '#050c21',
          850: '#08122f',
          800: '#0c1a40',
          700: '#142552',
          600: '#1e346b',
        },
      },
      boxShadow: {
        'brand': '0 0 16px rgba(255, 45, 95, 0.35)',
        'brand-lg': '0 0 25px rgba(255, 45, 95, 0.45)',
        'dark-card': '0 10px 30px -10px rgba(0, 0, 0, 0.7)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-primary': 'glowPrimary 2.5s ease-in-out infinite alternate',
      },
      keyframes: {
        glowPrimary: {
          '0%': { boxShadow: '0 0 12px -2px rgba(255, 45, 95, 0.3)' },
          '100%': { boxShadow: '0 0 24px 4px rgba(255, 45, 95, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
