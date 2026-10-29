import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        // Con la base de 14 px (index.css), el text-xs de Tailwind (0,75rem) quedaría en 10,5 px: se sube a ~11,2 px.
        xs: ['0.8rem', { lineHeight: '1.15rem' }],
      },
      colors: {
        primary: {
          DEFAULT: '#00b86b', // Verde principal: acentos, bordes, íconos grandes y gráficos (2,6:1 sobre blanco: no para texto)
          light: '#ecfdf5',   // Verde claro para fondos y hover
          dark: '#007f4a',    // Mismo verde, oscuro: texto verde y fondos con texto blanco (5,1:1, WCAG AA)
          darker: '#006b3e',  // Hover de los botones primary-dark
        },
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        warning: {
          DEFAULT: '#f59e0b' // Amarillo/Naranja para advertencias
        }
      }
    },
  },
  plugins: [],
}
