/* eslint-disable @typescript-eslint/no-var-requires */
const themeTokens = require('../')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.html'],
  theme: {
    extend: {},
  },
  plugins: [themeTokens({ tokens: { colors: true } })],
}
