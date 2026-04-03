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
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        success: {
          400: '#34d399',
          500: '#10b981',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
        },
        cyan: {
          400: '#22d3ee',
          500: '#00D9FF',
          600: '#0891b2',
        },
        neon: {
          cyan: '#00D9FF',
          purple: '#9D4EDD',
          pink: '#FF2D78',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'linear-gradient(135deg, #0F1729 0%, #1a1040 50%, #0F1729 100%)',
        'gradient-hero': 'linear-gradient(135deg, #0F1729 0%, #0d1f3c 40%, #1a0a2e 100%)',
        'gradient-cyan-purple': 'linear-gradient(135deg, #00D9FF, #9D4EDD)',
        'gradient-purple-pink': 'linear-gradient(135deg, #9D4EDD, #FF2D78)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'glow-cyan': 'glowCyan 2s ease-in-out infinite',
        'glow-purple': 'glowPurple 2s ease-in-out infinite',
        'progress-stripe': 'progressStripe 1s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'gradient-shift': 'gradientShift 4s ease infinite',
        'border-glow': 'borderGlow 3s ease-in-out infinite',
        'text-glow-pulse': 'textGlowPulse 3s ease-in-out infinite',
        'progress-fill': 'progressFill 2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(14,165,233,0.4)' },
          '50%': { boxShadow: '0 0 24px rgba(14,165,233,0.8)' },
        },
        glowCyan: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,217,255,0.3), 0 0 20px rgba(0,217,255,0.1)' },
          '50%': { boxShadow: '0 0 20px rgba(0,217,255,0.6), 0 0 40px rgba(0,217,255,0.3)' },
        },
        glowPurple: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(157,78,221,0.3), 0 0 20px rgba(157,78,221,0.1)' },
          '50%': { boxShadow: '0 0 20px rgba(157,78,221,0.6), 0 0 40px rgba(157,78,221,0.3)' },
        },
        progressStripe: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradientShift: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(0,217,255,0.3)' },
          '50%': { borderColor: 'rgba(157,78,221,0.6)' },
        },
        textGlowPulse: {
          '0%, 100%': { textShadow: '0 0 10px rgba(0,217,255,0.4), 0 0 20px rgba(0,217,255,0.2)' },
          '50%': { textShadow: '0 0 20px rgba(0,217,255,0.8), 0 0 40px rgba(0,217,255,0.4)' },
        },
        progressFill: {
          '0%': { width: '0%' },
          '100%': { width: '73%' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.4)',
        'glow-brand': '0 0 24px rgba(14,165,233,0.4)',
        'glow-success': '0 0 24px rgba(16,185,129,0.4)',
        'glow-danger': '0 0 24px rgba(239,68,68,0.3)',
        'glow-cyan': '0 0 20px rgba(0,217,255,0.4), 0 0 40px rgba(0,217,255,0.2)',
        'glow-cyan-lg': '0 0 30px rgba(0,217,255,0.6), 0 0 60px rgba(0,217,255,0.3)',
        'glow-purple': '0 0 20px rgba(157,78,221,0.4), 0 0 40px rgba(157,78,221,0.2)',
        'glow-purple-lg': '0 0 30px rgba(157,78,221,0.6), 0 0 60px rgba(157,78,221,0.3)',
        'neon-border': '0 0 0 1px rgba(0,217,255,0.3), 0 0 20px rgba(0,217,255,0.1)',
      },
    },
  },
  plugins: [],
}
