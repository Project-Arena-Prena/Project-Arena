import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080A',
          900: '#0B0D0F',
          850: '#0F1215',
          800: '#14181C',
          700: '#1B2026',
          600: '#252C34',
        },
        bone: {
          DEFAULT: '#ECEDEE',
          dim: '#9BA3AC',
          faint: '#616A73',
        },
        arena: { DEFAULT: '#FF4B1F', hot: '#FF5F38' },
        live: '#2FE08A',
        gain: '#2FE08A',
        gold: '#D8B34A',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        headline: '-0.04em',
        widest: '0.28em',
      },
      borderRadius: {
        DEFAULT: '2px',
        md: '3px',
        lg: '4px',
      },
      keyframes: {
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.82)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        riseIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 1.6s ease-in-out infinite',
        sweep: 'sweep 2.6s linear infinite',
        'rise-in': 'riseIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
