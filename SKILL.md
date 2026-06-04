---
name: storybook-docs
description: >
  Generate standardized, high-quality Storybook documentation (.stories.tsx files) for MUI-based React UI-kit components.
  Use this skill whenever the user asks to: document a component, write stories, generate Storybook docs, create use cases for a component,
  document props, or improve existing stories. Also trigger when the user shares a React component file (.tsx, .ts, .jsx, .js) and mentions
  Storybook, documentation, or stories — even casually ("write stories for this", "add docs to my component", "make story file").
  This skill deeply parses TypeScript props, MUI prop inheritance, and union types to produce exhaustive, realistic use cases.
---
# Storybook Documentation Skill

You are an expert in MUI-based React component libraries and Storybook. Your job is to produce **standardized, exhaustive, and realistic** Storybook documentation for components in this UI kit.

## Overview of the workflow

**Before doing anything else, read these reference files in order:**

1. `references/typescript-for-qwen.md` — how to read and resolve TypeScript prop types
2. `references/storybook-for-qwen.md` — CSF3 format rules, complete working example
3. `references/prop-parsing.md` — MUI component prop tables and sx handling
4. `references/story-template.md` — file template, naming conventions, category taxonomy

Do not skip any of these. They contain rules your output depends on.

**Then follow these steps:**

1. **Parse** — read the component file and fill in a prop table (format in typescript-for-qwen.md §RULE)
2. **Expand** — use prop-parsing.md to add relevant inherited MUI props
3. **Design** — plan which stories to write (list story names before writing code)
4. **Write** — produce the `.stories.tsx` using the template from story-template.md
5. **Validate** — check every item in the checklist from storybook-for-qwen.md Part 10

---

## Step 1 — Parse the component

**Write out the prop table before writing any story code.** Use the format from `references/typescript-for-qwen.md` → "RULE: Always show your work". When resolving types, follow sections A–G of that file.

When the user provides a component file, extract:

### 1a. Component identity

- Component name (exported name)
- Which MUI component it extends or wraps (e.g., `Button`, `TextField`, `Select`, `Autocomplete`)
- The file path / import path

### 1b. Props interface

Walk the full TypeScript type chain:

- Direct props interface (`ComponentNameProps`)
- Extended/intersection types (`extends MuiButtonProps`, `& { ... }`)
- Pick/Omit/Partial wrappers — resolve them fully
- `children` presence and type
- Event handlers (name, parameters, return type)
- Callback props — extract the signature, not just `Function`

For each prop, record:

| Field             | What to capture                                                |
| ----------------- | -------------------------------------------------------------- |
| `name`          | Prop name                                                      |
| `type`          | Full TypeScript type (resolve aliases if possible)             |
| `required`      | `true` / `false`                                           |
| `default`       | Default value if declared or inferable from component body     |
| `muidocs`       | Whether it's a native MUI prop (inherited)                     |
| `visual_impact` | Does it change visible output? (`high` / `low` / `none`) |
| `variants`      | If union type — list all literal values                       |

### 1c. Identify the "interesting" props

Prioritize props for story generation:

- **High priority**: All custom (non-MUI) props, especially if they have union type variants
- **Medium priority**: MUI props that are commonly used and visually impactful (`color`, `size`, `variant`, `disabled`, `loading`)
- **Low priority / skip**: Low-level MUI plumbing props (`ref`, `sx`, `component`, `classes`, `aria-*`) — mention them in the `argTypes` but don't generate dedicated stories unless specifically asked

---

## Step 2 — Map MUI inheritance

If the component wraps a known MUI component, consult `references/prop-parsing.md` → "MUI Component Prop Tables" section for the standard props to surface.

Key rule: **don't blindly inherit everything**. Only surface MUI props that:

- Are visually impactful for this component type
- Are likely to be used differently in this UI-kit's design system context
- Are explicitly re-exported or documented in the component's own props interface

---

## Step 3 — Design the story set

Every component needs these story categories (in order):

### Required stories (always present)

| Story name     | Purpose                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `Default`    | The component with zero required props only. Shows the baseline.               |
| `Playground` | All props exposed via `args` for interactive tweaking in Storybook controls. |

### Variant matrix stories (generate per prop with variants)

For every prop with a union type of 2–6 literal values:

- Create a **grid story** that renders all values side by side
- Name it `[PropName]Variants` (e.g., `SizeVariants`, `ColorVariants`)
- Use a render function that maps over all values
- Show the variant label beneath each instance

For boolean props that are `false` by default:

- Create a story showing it `true`, named after the prop (e.g., `Disabled`, `Loading`, `ReadOnly`)

### State stories (as applicable)

- `WithLabel` / `WithHelperText` — for input-type components
- `WithIcon` / `WithStartIcon` / `WithEndIcon`
- `WithError` — show error state with helper text
- `Controlled` — if the component has controllable state (value + onChange)
- `Loading` — if there's a loading prop
- `Empty` — for list/select/autocomplete components with no options

### Composition stories (2–3 real-world examples)

These are the most important for developers. Each shows the component in a **realistic UI context**:

- Show it inside a form, a card, a toolbar, or a list — whichever makes sense
- Use realistic labels, values, and data (not "foo" / "test" / "Lorem ipsum")
- Name them after the use case: `InSearchBar`, `InFilterPanel`, `InUserForm`

Aim for **2 composition stories minimum**. If the component is a building block (e.g., a Badge, a Tag), show it combined with other components.

---

## Step 4 — Write the `.stories.tsx` file

Follow the exact template in `references/story-template.md`. Key rules:

### File header

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from './ComponentName';
// Import only what's needed for composition stories
```

### Meta block

```tsx
const meta: Meta<typeof ComponentName> = {
  title: 'Components/[Category]/ComponentName',
  component: ComponentName,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
One-paragraph description of what this component is and when to use it.
Mention: the MUI base, the key extension/customization this kit provides, and the primary use case.
        `,
      },
    },
  },
  argTypes: {
    // See argTypes rules below
  },
};
export default meta;
type Story = StoryObj<typeof ComponentName>;
```

### argTypes rules

- Every **custom prop** must have a full `argTypes` entry
- MUI inherited props: only include `color`, `size`, `variant`, `disabled` if applicable
- For union string props: use `control: { type: 'select' }` with `options: [...]`
- For boolean props: use `control: 'boolean'`
- For callback props: use `action('prop-name')` from `@storybook/addon-actions`
- Include `description` (one sentence) and `table.defaultValue.summary` for every custom prop

```tsx
argTypes: {
  size: {
    description: 'Controls the size of the component.',
    control: { type: 'select' },
    options: ['small', 'medium', 'large'],
    table: { defaultValue: { summary: 'medium' } },
  },
  disabled: {
    description: 'Disables the component.',
    control: 'boolean',
    table: { defaultValue: { summary: 'false' } },
  },
  onChange: {
    description: 'Callback fired when value changes.',
    action: 'changed',
  },
},
```

### Story object rules

- Use `satisfies Story` (not `as Story`)
- Always specify `args` for stories that set props
- For composition/render stories, use `render: (args) => <WrapperJSX><ComponentName {...args} /></WrapperJSX>`
- Add a `parameters.docs.description.story` one-liner for every non-obvious story
- Variant grid stories use a `render` with `display: flex`, `gap`, and a label

**Variant grid pattern:**

```tsx
export const SizeVariants: Story = {
  parameters: { docs: { description: { story: 'All available size values.' } } },
  render: () => (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {(['small', 'medium', 'large'] as const).map((size) => (
        <Box key={size} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <ComponentName size={size} />
          <Typography variant="caption">{size}</Typography>
        </Box>
      ))}
    </Box>
  ),
};
```

---

## Step 5 — Validate before outputting

Run through this checklist mentally before delivering:

- [ ] `Default` story has no props beyond required ones
- [ ] `Playground` story has all props in `args` so controls work
- [ ] Every union-type prop has a `[Prop]Variants` story
- [ ] Every boolean prop that changes visual output has its own story
- [ ] At least 2 composition stories with realistic content
- [ ] All custom props have `argTypes` entries with description + default
- [ ] No `Lorem ipsum`, no `"test"` strings, no placeholder data
- [ ] Story names are PascalCase, `args` keys match prop names exactly
- [ ] File compiles (no missing imports, no `any` unless from MUI internals)
- [ ] `tags: ['autodocs']` is present in meta

---

## Output format

Deliver the `.stories.tsx` file as a code block. Then, after the code block, provide a short **Story Map** as a markdown table listing every story name, its category, and what it demonstrates. This helps the developer verify coverage at a glance.

Example Story Map:

| Story         | Category       | Demonstrates                        |
| ------------- | -------------- | ----------------------------------- |
| Default       | Required       | Baseline rendering with no props    |
| Playground    | Required       | All props interactive via controls  |
| SizeVariants  | Variant matrix | small / medium / large side by side |
| Disabled      | State          | Disabled boolean state              |
| InFilterPanel | Composition    | Used inside a search/filter toolbar |

---

## Reference files

Read ALL of these before starting. They are written specifically for this model.

- **`references/typescript-for-qwen.md`** — Step-by-step TypeScript type resolution with worked examples. Covers Pick/Omit/Partial, union types, as const, enums, generics, callbacks.
- **`references/storybook-for-qwen.md`** — Full CSF3 format guide with a complete working story file example. Covers meta, argTypes, story objects, render functions, controlled stories.
- **`references/prop-parsing.md`** — MUI component prop tables (which props to surface from MUI base components), sx handling.
- **`references/story-template.md`** — File template, naming conventions, category taxonomy, realistic content guide.
