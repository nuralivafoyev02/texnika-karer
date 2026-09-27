/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17231D',
        forest: '#174A32',
        leaf: '#2A7650',
        mint: '#E8F2EC',
        canvas: '#F5F7F5',
        muted: '#76827A',
        line: '#E7ECE8',
        amber: '#D28A30',
        danger: '#C94F4F',
      },
      boxShadow: {
        soft: '0 12px 34px rgba(31, 55, 41, 0.06)',
        float: '0 20px 60px rgba(23, 35, 29, 0.18)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
