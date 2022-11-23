# Theme Tokens Tailwind Plugin

A Tailwind plugin for storing Tailwind Theme values in CSS custom properties.

## Motivation

There are a variety of reasons one might need to read from their Tailwind configuration outside utility classes. There are many existing solutions to this. This plugin makes (parts of) your Tailwind configuration available to your CSS through the use of CSS custom properties. By storing bits of your configuration in CSS, the information can be dynamically accessed at runtime. Dynamic, runtime access is the main difference between this approach and using Tailwind's own `theme()` function.

## Installation

Install `@fashionable/tailwind-plugin-theme-tokens` with your favorite package manager:

```sh
# with pnpm
pnpm add @fashionable/tailwind-plugin-theme-tokens

# or yarn
yarn add @fashionable/tailwind-plugin-theme-tokens

# or npm
npm install @fashionable/tailwind-plugin-theme-tokens
```

Then add it to your `tailwind.config`:

```javascript
// tailwind.config.cjs

const themeTokens = require('@fashionable/tailwind-plugin-theme-tokens')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.html'],
  theme: {
    extend: {},
  },
  plugins: [
    themeTokens({
      tokens: { spacing: true },
    }),
  ],
}
```

## Configuring Themes

Fragments of exposed config are referred to as themes.

### Theme Properties

Every theme has two properties:

#### `tokens`

- **Type**: `Record<keyof TailwindThemeConfig, TokenConfig>`
- **Required**: `true`

The tokens to include in the theme. See [Token Configs](#token-configs) for how to select from your Tailwind config.

#### `prefix`

- **Type**: `string`
- **Required**: `false`
- **Default**: `undefined`

If defined, the prefix will be prepended to every property in the theme:

```css
/* no prefix */
.theme {
  --spacing-0: 0px;
}

/* prefix "app" */
.theme {
  --app-spacing-0: 0px;
}
```

### Token Configs

Token Configs are values that represent a selection of some object from your Tailwind theme. They can select the entire object, certain keys, or reach deeper and select grand-child properties.

#### Truthy Values

When resolving a token config, this plugin considers the following values to be "truthy":

- `true`
- `[]`
- any array that includes `''` (i.e. `‌['']`, ` ['', 'foo']`)

These truthy values tell the plugin to include the entirety of the result from Tailwind's own `theme()` function.

```js
// tailwind.config.cjs

const themeTokens = require('@fashionable/tailwind-plugin-theme-tokens')

/** @type {import('tailwindcss').Config} */
module.exports = {
  // ...
  plugins: [
    themeTokens({
      tokens: { spacing: true },
    }),
  ],
}
```

Produces

```css
:root {
  --spacing-0: 0;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  /* ... */
}
```

#### Arrays of child keys

An array of string child keys tells this plugin to include each child property listed in the array. For example:

```js
// tailwind.config.cjs

const themeTokens = require('@fashionable/tailwind-plugin-theme-tokens')

/** @type {import('tailwindcss').Config} */
module.exports = {
  // ...
  plugins: [
    themeTokens({
      tokens: { spacing: ['0', '1', '2', '3', '4'] },
    }),
  ],
}
```

Produces

```css
:root {
  --spacing-0: 0px;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
}
```

In cases where the Tailwind theme itself has nested objects, the entirety of the object will be included:

```js
// tailwind.config.cjs

const themeTokens = require('@fashionable/tailwind-plugin-theme-tokens')

/** @type {import('tailwindcss').Config} */
module.exports = {
  // ...
  plugins: [
    themeTokens({
      tokens: { colors: ['red'] },
    }),
  ],
}
```

```css
:root {
  --colors-red-50: #fef2f2;
  --colors-red-100: #fee2e2;
  /* ... */
  --colors-red-900: #7f1d1d;
}
```

#### Selection Objects

When this plugin encounters an Object, it treats each key as a child key and evaluates the value as another Token Config. For example:

```js
// tailwind.config.cjs

const themeTokens = require('@fashionable/tailwind-plugin-theme-tokens')

/** @type {import('tailwindcss').Config} */
module.exports = {
  // ...
  plugins: [
    themeTokens({
      tokens: {
        colors: {
          red: ['100', '200'],
          blue: true,
        },
      },
    }),
  ],
}
```

Produces

```css
:root {
  --colors-red-100: #fee2e2;
  --colors-red-200: #fecaca;
  --colors-blue-50: #eff6ff;
  --colors-blue-100: #dbeafe;
  /* ... */
  --colors-blue-900: #1e3a8a;
}
```

### Alias Objects

In addition to paring a Token Config with a key from your Tailwind Config in the Theme's configuration, you can pair an Alias object. Alias objects have two properties:

#### `as`

- **Type**: `string`
- **Required**: `true`

The name to use when renaming the Tailwind config key.

#### `values`

- **Type**: `TokenConfig`
- **Required**: `true`

The values to use from the original Taiwind config key.

Together, `as` and `values` behave as such:

```js
// tailwind.config.cjs

const themeTokens = require('@fashionable/tailwind-plugin-theme-tokens')

/** @type {import('tailwindcss').Config} */
module.exports = {
  // ...
  plugins: [
    themeTokens({
      tokens: {
        spacing: {
          as: 'emptiness',
          values: ['0', '1', '2', '3', '4'],
        },
      },
    }),
  ],
}
```

Produces

```css
:root {
  --emptiness-0: 0rem;
  --emptiness-1: 0.25rem;
  --emptiness-2: 0.5rem;
  --emptiness-3: 0.75rem;
  --emptiness-4: 1rem;
}
```

You can also supply an array of Alias Objects, if you need to create multiple aliases for the same Taliwind Config Key.

## Configuring the Plugin

The plugin expects a configuration object when it is added to your Tailwind config. This options object serves two purposes:

- Define the `:root` theme
- Define any named themes

### The `:root` theme

The plugin's options object accepts a `prefix` and `tokens` property, allowing you to configure a theme that is scoped to the css `:root` selector.

For example:

```js
// tailwind.config.cjs

const themeTokens = require('@fashionable/tailwind-plugin-theme-tokens')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.html'],
  theme: {
    extend: {},
  },
  plugins: [
    themeTokens({
      tokens: { spacing: ['0'] },
    }),
  ],
}
```

Produces

```css
:root {
  --spacing-0: 0;
}
```

### Named Themes

If for some reason you need to conditionally apply a set of CSS vars, you can used a named theme.

The plugin options object also takes an array of Theme Configs under the `themes` property. These themes must also supply a `name` property, which will be the CSS class name of the theme.

For example:

```js
// tailwind.config.cjs

const themeTokens = require('@fashionable/tailwind-plugin-theme-tokens')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.html'],
  theme: {
    extend: {},
  },
  plugins: [
    themeTokens({
      themes: [{ name: 'theme', tokens: { spacing: ['0'] } }],
    }),
  ],
}
```

Produces

```css
.theme {
  --spacing-0: 0;
}
```
