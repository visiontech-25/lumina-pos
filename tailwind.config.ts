import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx,js,jsx}',
    './services/**/*.{ts,tsx,js,jsx}',
    './utils/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('tailwindcss/plugin')(function({ addComponents }: { addComponents: any }) {
      addComponents({
        '.btn-neutral': {
          '@apply bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold transition-colors dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600': {},
        },
      })
    })
  ],
};

export default config;
