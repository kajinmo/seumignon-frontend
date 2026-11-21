/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-bg-canvas)',
        surface: 'var(--color-bg-surface)',
        subtle: 'var(--color-bg-subtle)',
        border: 'var(--color-border)',
        ink: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        },
        brand: {
          primary: 'var(--color-brand-primary)',
          hover: 'var(--color-brand-primary-hover)',
          secondary: 'var(--color-brand-secondary)',
        },
        status: {
          success: 'var(--color-status-success)',
          error: 'var(--color-status-error)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-sans)'],
      },
    },
  },
  plugins: [],
};
