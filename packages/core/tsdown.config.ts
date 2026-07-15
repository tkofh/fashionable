import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/utils.ts',
    'src/calc/index.ts',
    'src/data/index.ts',
    'src/declaration/index.ts',
    'src/fontFace/index.ts',
    'src/property/index.ts',
    'src/query/index.ts',
    'src/rule/index.ts',
    'src/selector/index.ts',
    'src/stylesheet/index.ts',
  ],
  format: 'esm',
  dts: true,
  sourcemap: true,
  target: 'es2022',
  clean: true,
  outputOptions: {
    entryFileNames: '[name].mjs',
    chunkFileNames: 'shared/[name]-[hash].mjs',
  },
  tsconfig: './tsconfig.json',
})
