/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        styleBg: '#C7EDCC',
        styleBg2: '#D5EDD8',
        styleBtn: '#A8D4A8',
        styleEntry: '#E8F5E9',
        btnCancel: '#FFCCCC',
        labelBg: '#C7EDCC',
        fieldBg: '#E8F5E9',
        purple: '#7755CC',
      },
      fontFamily: {
        yahei: ['"Microsoft YaHei"', '"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}