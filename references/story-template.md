# Story Template Reference

## Table of Contents

1. [Full File Template](#1-full-file-template)
2. [Category Taxonomy](#2-category-taxonomy)
3. [Naming Conventions](#3-naming-conventions)
4. [Import Order](#4-import-order)
5. [Realistic Content Guide](#5-realistic-content-guide)
6. [Common Pitfalls](#6-common-pitfalls)

---

## 1. Full File Template

Use this template exactly. Do not add/remove top-level blocks without a reason.

```tsx
// [ComponentName].stories.tsx

/*
 * Component: ComponentName
 * MUI Base: [e.g. Button, TextField, Autocomplete]
 * Category: [e.g. Inputs, Feedback, Navigation]
 *
 * Story Coverage:
 * - Default: baseline with no optional props
 * - Playground: all props available as Storybook controls
 * - [PropName]Variants: grid of all union values for [propName]
 * - [StateName]: [propName]=true / error / loading etc.
 * - [CompositionName]: real-world usage in [context]
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Box, Typography } from '@mui/material';
// Only import MUI components actually used in stories

import { ComponentName } from './ComponentName';
// If the component exports its variants/options as const, import them:
// import { COMPONENT_SIZES, COMPONENT_VARIANTS } from './ComponentName';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof ComponentName> = {
  title: 'Components/[Category]/ComponentName',
  component: ComponentName,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',    // use 'padded' for full-width components like tables/inputs
    docs: {
      description: {
        component: `
**ComponentName** is a [brief description of what it is].

It extends MUI's \`[BaseMuiComponent]\` and adds [key differentiators this kit provides,
e.g. "a standardized loading state, custom size tokens, and integrated error handling"].

**When to use:** [1–2 sentences on primary use case.]

**When NOT to use:** [1 sentence if there's a common misuse to flag.]
        `.trim(),
      },
    },
  },
  argTypes: {
    // --- Custom props (always document these) ---
    customProp: {
      description: 'One-sentence description.',
      control: { type: 'select' },
      options: ['option1', 'option2', 'option3'],
      table: {
        defaultValue: { summary: 'option1' },
        type: { summary: "'option1' | 'option2' | 'option3'" },
      },
    },
    booleanProp: {
      description: 'One-sentence description.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    callbackProp: {
      description: 'Callback fired when [event].',
      action: 'callbackProp',
      table: {
        type: { summary: '(value: string) => void' },
      },
    },
    // --- Inherited MUI props worth surfacing ---
    disabled: {
      description: 'Disables the component, preventing user interaction.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    // --- Props to hide from controls (low-level) ---
    sx: {
      description: 'MUI system prop for one-off styling overrides. Avoid in production; use theme instead.',
      control: false,
    },
    ref: { control: false, table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof ComponentName>;

// ---------------------------------------------------------------------------
// Required Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  // Only required props here. No args if there are no required props.
};

export const Playground: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Use the Controls panel to interactively explore all available props.',
      },
    },
  },
  args: {
    // Provide a representative value for every prop so controls work:
    customProp: 'option1',
    booleanProp: false,
    // children / label if applicable:
    // children: 'Button Label',
  },
};

// ---------------------------------------------------------------------------
// Variant Matrix Stories
// ---------------------------------------------------------------------------

// Generate one of these per union-type prop with 2–6 values.
// Pattern: render a flex row with all values + a caption label.

export const SizeVariants: Story = {
  parameters: {
    docs: {
      description: { story: 'All available `size` values rendered side by side.' },
    },
  },
  render: () => (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {(['small', 'medium', 'large'] as const).map((size) => (
        <Box
          key={size}
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
        >
          <ComponentName size={size} />
          <Typography variant="caption" color="text.secondary">
            {size}
          </Typography>
        </Box>
      ))}
    </Box>
  ),
};

// ---------------------------------------------------------------------------
// State Stories
// ---------------------------------------------------------------------------

export const Disabled: Story = {
  parameters: {
    docs: {
      description: { story: 'Disabled state prevents interaction and applies reduced opacity.' },
    },
  },
  args: { disabled: true },
};

// export const Loading: Story = { args: { loading: true } };
// export const WithError: Story = { args: { error: true, helperText: 'This field is required.' } };

// ---------------------------------------------------------------------------
// Composition Stories
// ---------------------------------------------------------------------------

// IMPORTANT: Use realistic content. No "Lorem ipsum", no "test", no "foo".
// Show the component in a real UI context.

export const InUserForm: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'ComponentName used in a typical user profile form alongside other inputs.',
      },
    },
  },
  render: (args) => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: 360,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Typography variant="h6">Edit Profile</Typography>
      <ComponentName {...args} label="Display name" placeholder="e.g. Jane Doe" />
      {/* Other realistic form fields */}
    </Box>
  ),
};
```

---

## 2. Category Taxonomy

Use exactly one of these as the `title` segment:

| Category                   | Use for                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| `Components/Inputs`      | Text fields, selects, autocomplete, checkboxes, radios, sliders, date pickers |
| `Components/Buttons`     | Button variants, icon buttons, FABs, split buttons                            |
| `Components/Feedback`    | Alerts, snackbars, progress indicators, skeletons, toasts                     |
| `Components/Navigation`  | Tabs, breadcrumbs, menus, drawers, steppers, pagination                       |
| `Components/DataDisplay` | Tables, lists, chips, badges, avatars, tooltips, cards                        |
| `Components/Layout`      | Dividers, grids, stacks, boxes (when documented as a component)               |
| `Components/Overlays`    | Dialogs, modals, popovers, drawers                                            |
| `Components/Forms`       | Composite form components (FormSection, FieldGroup)                           |

Sub-categorize with a third level if there are many components in a category:
`Components/Inputs/Autocomplete`

---

## 3. Naming Conventions

### Story names (export names)

- `PascalCase` always
- Be descriptive: `WithLeadingIcon` not `Icon1`
- Variant stories: `[PropName]Variants` — e.g., `ColorVariants`, `SizeVariants`
- State stories: describe the state — `Disabled`, `Loading`, `WithError`, `ReadOnly`
- Composition stories: `In[Context]` — e.g., `InSearchBar`, `InFilterPanel`, `InDashboardHeader`

### File name

Always `[ComponentName].stories.tsx`. Match the component export name exactly.

### `title` field

`Components/[Category]/[ComponentName]`

- ComponentName matches the export name
- No abbreviations

---

## 4. Import Order

Follow this order strictly:

```tsx
// 1. Storybook
import type { Meta, StoryObj } from '@storybook/react';

// 2. MUI components (only what's used in stories)
import { Box, Typography, Stack } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

// 3. The component under documentation
import { ComponentName } from './ComponentName';

// 4. Related types / constants from the component (if exported)
import type { ComponentNameProps } from './ComponentName';
import { COMPONENT_SIZES } from './ComponentName';

// 5. Any fixture data for composition stories
// (define inline below if small, or import from a __fixtures__ file if large)
```

---

## 5. Realistic Content Guide

Poor content makes stories useless for developers who want to understand real behavior.

### Labels and text

| ❌ Avoid              | ✅ Use instead                               |
| --------------------- | -------------------------------------------- |
| `"test"`            | `"Save changes"`, `"Submit form"`        |
| `"label"`           | `"Email address"`, `"Search users"`      |
| `"Lorem ipsum"`     | `"No results found for your search."`      |
| `"foo"` / `"bar"` | `"primary"` / `"secondary"`              |
| `"Click me"`        | `"Add to cart"`, `"Cancel subscription"` |

### Data arrays (for Select, Autocomplete, Table)

Use domain-appropriate sample data, not sequential numbers:

```tsx
// ❌
const options = ['option1', 'option2', 'option3'];

// ✅ for a user selector
const options = [
  { id: 1, name: 'Alice Johnson', role: 'Admin' },
  { id: 2, name: 'Bob Chen', role: 'Editor' },
  { id: 3, name: 'Carla Rossi', role: 'Viewer' },
];

// ✅ for a country selector
const countries = ['Brazil', 'Germany', 'Japan', 'Nigeria', 'United States'];
```

### Composition story wrappers

Keep wrappers minimal and realistic. Use MUI `Box` for layout:

```tsx
// ✅ Looks like a real app UI
<Box sx={{ p: 3, width: 480, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
  <Typography variant="subtitle2" gutterBottom>Filter results</Typography>
  <ComponentName {...args} />
</Box>
```

---

## 6. Common Pitfalls

| Pitfall                                                                     | Fix                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Using `as Story` instead of `satisfies Story`                           | Use `satisfies Story` — better type inference                   |
| `args` keys don't match prop names (e.g., `lable` instead of `label`) | Double-check against the Props interface                           |
| Missing `render` for composition stories that need a wrapper              | Always wrap with `render: (args) => ...`                         |
| Forgetting `export` on stories                                            | Every story object must be `export const`                        |
| `Default` story has optional props set                                    | Remove them — Default shows zero-config behavior                  |
| Callback props missing from `argTypes`                                    | Add with `action: 'propName'` — devs need to see when they fire |
| Union props missing from `argTypes.options`                               | Every literal value must be in `options: [...]`                  |
| Composition story has `layout: 'centered'` but component is full-width    | Use `layout: 'padded'` for inputs, tables, forms                 |
