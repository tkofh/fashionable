/* eslint-disable @typescript-eslint/no-var-requires */
const rvars = require('../')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.html'],
  theme: {
    extend: {},
  },
  plugins: [rvars({ orderedBreakpoints: ['sm', 'md', 'lg', 'xl'] })],
}
