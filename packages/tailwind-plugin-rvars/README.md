# Responsive Variables Tailwind Plugin

A Tailwind utility for declaring css custom properties that change across breakpoints

## Motivation

Tailwind classes are a great way to build UI components in popular frontend frameworks such as Vue and React. However, often times we want a prop in one of those components to govern some styles, which take the form of Tailwind class lists. Writing out all of the possible classes can be a chore. It gets worse when you want the prop to be dynamic across breakpoints (i.e., accepting `{ sm: '1rem', lg: '2rem' })` as the value of a prop). In responsive scenarios, you need to list out every value at every breakpoint in order for the final CSS to have everything you need. `@fashionable/tailwind-plugin-rvars` helps here: use the `rvars` utility to create responsive css properties that match your Tailwind breakpoints, and remap them to css properties on the fly.

## Installation

Install `@fashionable/tailwind-plugin-rvars` with your favorite package manager:

```sh
# with pnpm
pnpm add @fashionable/tailwind-plugin-rvars

# or yarn
yarn add @fashionable/tailwind-plugin-rvars

# or npm
npm install @fashionable/tailwind-plugin-rvars
```

Then add it to your `tailwind.config`:

```javascript
// tailwind.config.cjs

const rvars = require('@fashionable/tailwind-plugin-rvars')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.html'],
  theme: {
    extend: {},
  },
  plugins: [rvars({ orderedBreakpoints: ['sm', 'md', 'lg', 'xl'] })],
}
```

## Configuration

The plugin requires an options object to be passed in when adding it to your Tailwind configuration. This object has two options:

### `orderedBreakpoints`

- **Type**: `string[]`
- **Required**: `true`

The `orderedBreakpoints` array should be the list of breakpoints this plugin should consider for its properties, from smallest to largest.

There are a variety of ways of specifying screens in Tailwind. This plugin makes no attempt to parse pixel values from your config, and instead relies on this array to know which breakpoints to look at.

This plugin only supports `min-width` breakpoints, and will throw an error upon initialization if a Tailwind breakpoint with a `raw` or `max` key is found.

```javascript
// tailwind.config.cjs

const rvars = require('@fashionable/tailwind-plugin-rvars')

module.exports = {
  // ...
  plugins: [rvars({ orderedBreakpoints: ['sm', 'md', 'lg', 'xl'] })],
}
```

### `baseBreakpointName`

- **Type**: `string`
- **Required**: `false`
- **Default**: `'xs'`

The `baseBreakpointName` is the suffix that will be added to the variable that governs the responsive prop before the first breakpoint applies. In other words, this is the "base case" of the reponsive value.

```javascript
// tailwind.config.cjs

const rvars = require('@fashionable/tailwind-plugin-rvars')

module.exports = {
  // ...
  plugins: [
    rvars({
      orderedBreakpoints: ['sm', 'md', 'lg', 'xl'],
      baseBreakpointName: 'xs',
    }),
  ],
}
```

## Usage

To declare a responsive variable, use the `rvars` utility in your Tailwind content. Note that this utility can _only_ accept arbitrary values at the moment, so you'll need to use the `[name]` syntax:

```html
<div class="rvar-[spacing]">
  <!-- ... -->
</div>
```

In the above example, there is now a `--spacing` custom property, as well as custom properties for each breakpoint configured:

- `--spacing-xs` (`'xs'` is the `baseBreakpointName`)
- `--spacing-sm`
- `--spacing-md`
- `--spacing-lg`

This works well when using the `--spacing` variable in other utilities with the same arbitrary value syntax:

```html
<!-- A simple <Stack> component, perhaps? -->
<div
  class="flex flex-col rvar-[spacing] gap-[var(--spacing)]"
  style="--spacing-xs: 1rem; --spacing-md: 2rem; --spacing-xl: 3rem;"
>
  <!-- ... -->
</div>
```

### Default Values

By default, no value is set as the default value in the absence of a base variable being assigned. You can customize this by adding the desired default value after a comma in the utility name:

```html
<div class="rvar-[spacing,1rem]">
  <!-- ... -->
</div>
```

In the above example, if no `--spacing-*` variables are set, the value of `--spacing` will be `1rem`.
