/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17231D',
        forest: '#0A4FA8',
        leaf: '#1F90FF',
        mint: '#E6F1FF',
        canvas: '#F5F7FB',
        muted: '#6E7B8F',
        line: '#E7ECF3',
        amber: '#D28A30',
        danger: '#C94F4F',
      },
      // Barcha qutilar (karta, tugma, kiritish maydoni, modal) bir xil 8px.
      // Halqalar (avatar, nuqta, pill) uchun rounded-full o'z joyida qoladi.
      borderRadius: {
        none: '0px',
        sm: '8px',
        DEFAULT: '8px',
        md: '8px',
        lg: '8px',
        xl: '8px',
        '2xl': '8px',
        '3xl': '8px',
        full: '9999px',
      },
      boxShadow: {
        soft: '0 12px 34px rgba(16, 42, 84, 0.07)',
        float: '0 20px 60px rgba(15, 35, 70, 0.18)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
