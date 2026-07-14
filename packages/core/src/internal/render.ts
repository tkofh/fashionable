/**
 * Shared text-emission helpers for the block renderers: the default
 * indentation unit, CSS string quoting, and the `prelude { lines }`
 * assembly the declaration-block at-rules render with.
 */

/**
 * The default indentation unit shared by every block renderer.
 *
 * @internal
 */
export const DEFAULT_INDENT = '\t'

/** @internal */
export const quote = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** @internal */
export const renderBlock = (
  prelude: string,
  declarations: ReadonlyArray<string>,
  indent: string,
): string => `${prelude} {\n${declarations.map((line) => `${indent}${line};`).join('\n')}\n}`
