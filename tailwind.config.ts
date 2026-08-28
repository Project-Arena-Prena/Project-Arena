import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#050403',
          900: '#0B0907',
          850: '#100D0A',
          800: '#191511',
          700: '#28221C',
          600: '#39312A',
        },
        bone: {
          DEFAULT: '#F2EEE7',
          dim: '#AAA198',
          faint: '#6F6861',
        },
        arena: { DEFAULT: '#E85002', hot: '#F16001' },
        live: '#F16001',
        gain: '#E85002',
        gold: '#CDB58E',
        danger: '#C10801',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Arial Narrow', 'sans-serif'],
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
