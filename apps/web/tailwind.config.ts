import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090B',
        surface: '#111114',
        surface2: '#18181B',
        primary: '#8B5CF6',
        primary2: '#7C3AED',
        fg: '#F5F5F5',
        muted: '#A1A1AA',
        line: '#292929',
        ok: '#34D399',
        warn: '#FBBF24',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
