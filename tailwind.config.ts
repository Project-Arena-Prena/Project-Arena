import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#000000',
          900: '#080808',
          850: '#0A0A0A',
          800: '#151515',
          700: '#222222',
          600: '#333333',
        },
        bone: {
          DEFAULT: '#F9F9F9',
          dim: '#A7A7A7',
          faint: '#646464',
        },
        arena: { DEFAULT: '#E85002', hot: '#F16001' },
        live: '#F16001',
        gain: '#E85002',
        gold: '#D9C3AB',
        danger: '#C10801',
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
        ticker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 1.6s ease-in-out infinite',
        sweep: 'sweep 2.6s linear infinite',
        'rise-in': 'riseIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
        ticker: 'ticker 32s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
