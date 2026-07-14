import { expect } from 'vitest'
import * as Equal from '#internal/equal'

interface StructuralMatchers<R = unknown> {
  toStructurallyEqual(expected: unknown): R
}

declare module 'vitest' {
  // biome-ignore lint/suspicious/noExplicitAny: vitest's Assertion is typed this way
  interface Assertion<T = any> extends StructuralMatchers<T> {}
  interface AsymmetricMatchersContaining extends StructuralMatchers {}
}

expect.extend({
  toStructurallyEqual(received: unknown, expected: unknown) {
    const pass = Equal.equals(received, expected)
    return {
      pass,
      message: () =>
        `expected ${String(received)} to ${pass ? 'not ' : ''}structurally equal ${String(expected)}`,
    }
  },
})
