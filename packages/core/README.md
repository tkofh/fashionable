# Fashionable

JS utilities for working with CSS classnames

## Features

- Organize groups of classes into component variants with [Specs](#specs)

## Specs

### Features

- Organize CSS classnames into base and variant groups
- Create a typesafe API for constructing the right classes for a given input
- Works great with Tailwind
- Organize complex styles with compound variants

### Getting Started

First, install `@fashionable/core`:

```sh
# with pnpm
pnpm add @fashionable/core

# or yarn
yarn add @fashionable/core

# or npm
npm install @fashionable/core
```

Then import `createSpec` into your component:

```typescript
import { createSpec } from '@fashionable/core'

const button = createSpec({
  base: 'btn-base',
  variants: {
    theme: {
      primary: 'btn-theme-primary',
      secondary: 'btn-theme-secondary',
    },
    size: {
      small: 'btn-size-small',
      base: 'btn-size-base',
      large: 'btn-size-large',
    },
  },
  defaults: {
    theme: 'primary',
    size: 'base',
  },
})

const defaultPrimaryButton = button()
// returns `btn-base btn-theme-primary btn-size-base`

const largeSecondaryButton = button({ theme: 'secondary', size: 'large' })
// returns `btn-base btn-theme-secondary btn-size-large`
```

### Base

Specs can include a base string or list of strings with every result, regardless of the variants a user selects:

```typescript
import { createSpec } from '@fashionable/core'

const spec = createSpec({
  base: 'base',
  variants: {
    first: {
      a: 'first-a',
      b: 'first-b',
    },
  },
})

spec()
// returns 'base'

spec({ first: 'a' })
// returns 'base first-a'

spec({ first: 'b' })
// returns 'base first-b'
```

### Variants

Specs define maps of variants, the names of which are determined by their key in the `VariantDefinition` map. For example:

```typescript
import { createSpec } from '@fashionable/core'

const spec = createSpec({
  variants: {
    variantOne: {
      optionA: ' ... ',
      optionB: ' ... ',
    },
  },
})
```

The above example creates a single variant, `variantOne`, with options `optionA` and `optionB`. This means that when calling `spec()`, you can (but do not have to) pass in an object with a `variantOne` property, and a value of either `optionA` or `optionB`:

```typescript
spec({}) // valid
spec({ variantOne: 'optionA' }) // valid
spec({ variantOne: 'optionB' }) // valid
spec({ variantOne: 'notAnOption' }) // invalid
spec({ notAVariant: 'optionA' }) // invalid
```

#### Error Handling

Invalid variant names and option names are ignored in production. In development, a warning is emitted that includes the variant and/or option that is unknown to the spec.

#### Booleans

If an option map specifies the strings `'true'` and `'false'` as its only options, the input for that variant is converted to a boolean type:

```typescript
import { createSpec } from '@fashionable/core'

const spec = createSpec({
  variants: {
    variantOne: {
      true: 'true',
      false: 'false',
    },
  },
})

spec({ variantOne: true }) // valid
spec({ variantOne: 'true' }) // invalid
```

### Defaults

You can define default variant options should the user not specify an option when calling the spec:

```typescript
import { createSpec } from '@fashionable/core'

const spec = createSpec({
  variants: {
    variantOne: {
      optionA: 'optionA',
      optionB: 'optionB',
    },
  },
  defaults: {
    variantOne: 'optionA',
  },
})
```

When specifying defaults, if the user does not supply an option to the defaulted variant when calling the spec function, the default will be used. The user can override these at any time:

```typescript
spec() // returns `'optionA'`
spec({ variantOne: 'optionB' }) // returns `'optionB'`
```

### Compound Variants

Sometimes, certain styles should only be applied if multiple conditions are met. To avoid the need to flatten variant maps too much, compound conditions can be specified:

```typescript
import { createSpec } from '@fashionable/core'

const spec = createSpec({
  variants: {
    first: {
      a: 'first-a',
      b: 'first-b',
    },
    second: {
      a: 'second-a',
      b: 'second-b',
    },
  },
  compound: [
    {
      when: { first: 'a', second: 'b' },
      value: 'first-a-and-second-b',
    },
    {
      when: { first: 'b', second: 'a' },
      value: 'first-b-and-second-a',
    },
  ],
})

spec({ first: 'a', second: 'a' })
// returns 'first-a second-a'

spec({ first: 'a', second: 'b' })
// returns 'first-a second-b first-a-and-second-b'
```

Compound variants are objects with `when` and `value` properties. The `when` property is a selection of variants and options that trigger the compound variant, and the `value` is the string or strings to include in the result.

### Deduplication

All strings collected from the user input, be them from variants or compound variants, are split by space characters and de-duplicated so that the final result only includes one instance of every string. This means that you can safely include the same class in multiple variant conditions without worrying about it unnecessarily being included more than once.

### API

#### `createSpec(options: SpecDefinition): SpecFn`

The `options` object accepts the following properties:

- `options.base?: string | string[]` (optional)

  The string or list of strings to always include, no matter which variants are specified later

- `options.variants?: Record<string, Record<string, string | string[]>>` (optional)

  The map of variants made available to the resultant `SpecFn`. The `variants` object is a map of variant names as keys, and option maps as values.

  - `options.variants[string]: Record<string, string | string[]>`

    Option maps define option names as keys, and the string or strings to include in the final value if the option is selected

- `options.defaults?: Record<string, string | boolean>` (optional)

  Default selection of variants to use. User input overrides each individual property. Keys of this must be variant names, and their values must be option names.

- `options.compund?: Array<{ when: Record<string, string | boolean>; value: string | string[] }>` (optional)

  List of compound variant objects

  - `options.compound[number].when: Record<string, string | boolean>`

    Conditions under which the associated `value` should be included in the result

  - `options.compound[number].value: string | string[]`

    The string or strings to include when the associated `when` condition is met by the user's input

### Credits

A special thank you to `@vanilla-extract/recipes` project for the API inspiration and starting point for the types.
