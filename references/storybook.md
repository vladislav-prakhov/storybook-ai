# Storybook CSF3 — Complete Reference for Story Writing

Read this file BEFORE writing any .stories.tsx file.
This skill uses Storybook 7+ with Component Story Format 3 (CSF3).
Do NOT use older patterns (Template.bind, storiesOf). They are deprecated and will break.

---

## Part 1 — What is a .stories.tsx file?

A `.stories.tsx` file documents one React component. It exports:

1. A **default export** (`meta`) — describes the component to Storybook
2. **Named exports** (`Story` objects) — each one is a documented use case

Storybook reads this file and builds an interactive UI where developers can:

- See all stories in a sidebar
- Click on a story to render it in isolation
- Change props using the "Controls" panel
- Read the auto-generated docs page

---

## Part 2 — The Meta Object (default export)

The meta object is the FIRST thing in the file after imports.

```tsx
const meta: Meta<typeof YourComponent> = {
  title: 'Components/Inputs/YourComponent',   // path in the sidebar
  component: YourComponent,                    // the component being documented
  tags: ['autodocs'],                          // REQUIRED — enables the docs page
  parameters: {
    layout: 'centered',                        // how to display stories: 'centered' | 'padded' | 'fullscreen'
    docs: {
      description: {
        component: 'Description of the component shown on the docs page.',
      },
    },
  },
  argTypes: {
    // prop controls configuration — see Part 4
  },
};
export default meta;
```

**CRITICAL:** `export default meta;` must come AFTER the `const meta = {...}` declaration.
**CRITICAL:** `tags: ['autodocs']` MUST be present or the docs page won't generate.

### layout values

- `'centered'` — component centered in viewport. Use for small components (buttons, chips, badges).
- `'padded'` — component at top-left with padding. Use for inputs, cards, medium components.
- `'fullscreen'` — no padding, full viewport. Use for page-level or table components.

---

## Part 3 — The Story Object (named exports)

Each story is a named export. CSF3 format:

```tsx
// Minimum story (no props needed):
export const Default: Story = {};

// Story with props:
export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Submit',
  },
};

// Story with a custom render function:
export const InForm: Story = {
  render: (args) => (
    <form>
      <YourComponent {...args} />
      <button type="submit">Submit</button>
    </form>
  ),
  args: {
    label: 'Email address',
  },
};

// Story with docs description:
export const WithError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Shows the error state with a helper message.',
      },
    },
  },
  args: {
    error: true,
    helperText: 'This field is required.',
  },
};
```

### WRONG patterns — do NOT use these:

```tsx
// ❌ WRONG: CSF2 Template pattern (deprecated)
const Template = (args) => <YourComponent {...args} />;
export const Default = Template.bind({});
Default.args = { label: 'Click me' };

// ❌ WRONG: storiesOf API (very old, removed)
storiesOf('Button', module).add('default', () => <Button />);

// ❌ WRONG: using 'as Story' loses type checking
export const Default = { args: {} } as Story;

// ✅ CORRECT: CSF3 with satisfies
export const Default: Story = {};
// Note: use 'Story' type annotation directly on the variable declaration
```

### Type annotation

Always use: `export const StoreName: Story = { ... }`
The type `Story` comes from: `type Story = StoryObj<typeof YourComponent>;`

---

## Part 4 — argTypes (Controls Configuration)

argTypes tells Storybook how to render a control for each prop.

```tsx
argTypes: {
  // String literal union → dropdown select
  size: {
    description: 'Controls the visual size of the component.',
    control: { type: 'select' },
    options: ['small', 'medium', 'large'],
    table: {
      type: { summary: "'small' | 'medium' | 'large'" },
      defaultValue: { summary: 'medium' },
    },
  },

  // Boolean → checkbox/toggle
  disabled: {
    description: 'Disables interaction with the component.',
    control: 'boolean',
    table: { defaultValue: { summary: 'false' } },
  },

  // Open string → text input
  placeholder: {
    description: 'Placeholder text shown when the field is empty.',
    control: 'text',
    table: { defaultValue: { summary: 'undefined' } },
  },

  // Number → number input
  maxLength: {
    description: 'Maximum character count.',
    control: 'number',
  },

  // Callback/event handler → logged in Actions panel
  onChange: {
    description: 'Fired when the value changes. Receives the new value.',
    action: 'onChange',
    table: {
      type: { summary: '(value: string) => void' },
    },
  },

  // ReactNode / complex object → no control (shown as-is)
  icon: {
    description: 'Icon element rendered inside the component.',
    control: false,
  },

  // Hidden from controls entirely
  sx: {
    control: false,
    table: { disable: true },
  },
},
```

### action vs control

- `action: 'eventName'` — for callbacks (onChange, onClick, onClose). Shows fired events in the Actions panel.
- `control: 'boolean'` — for interactive controls. Shows a toggle/input in the Controls panel.
- Do NOT put both on the same prop.

---

## Part 5 — The args Object

`args` inside a story sets the initial prop values for that story.

```tsx
export const WithLabel: Story = {
  args: {
    label: 'Email address',    // sets the label prop
    required: true,            // sets required=true
    placeholder: 'you@example.com',
  },
};
```

**Rules:**

- Prop names in `args` must EXACTLY match the component's prop names (case-sensitive)
- Don't include props you want to stay at their default value
- Don't include callback props in args (they're handled by argTypes action)

---

## Part 6 — The render Function

Use `render` when you need to wrap the component or render multiple instances.

```tsx
// Wrapping in a container:
export const InSidebar: Story = {
  render: (args) => (
    <Box sx={{ width: 240, bgcolor: 'background.paper', p: 2 }}>
      <YourComponent {...args} />
    </Box>
  ),
  args: { label: 'Filter by status' },
};

// Rendering multiple instances (variant grid):
export const ColorVariants: Story = {
  render: () => (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {(['primary', 'secondary', 'error'] as const).map((color) => (
        <Box key={color} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <YourComponent color={color} label="Button" />
          <Typography variant="caption">{color}</Typography>
        </Box>
      ))}
    </Box>
  ),
};
```

**When to use render vs args:**

- Use `args` only when one set of props is enough for the story
- Use `render` when you need a wrapper, multiple instances, or state (useState)

---

## Part 7 — Controlled Component Stories

When a component has `value` + `onChange`, show a controlled example using React state.

```tsx
import { useState } from 'react';

export const Controlled: Story = {
  parameters: {
    docs: {
      description: { story: 'Fully controlled example. Value is managed externally via useState.' },
    },
  },
  render: (args) => {
    // useState MUST be inside the render function, not at the module level
    const [value, setValue] = useState('');
    return (
      <YourComponent
        {...args}
        value={value}
        onChange={(newValue) => setValue(newValue)}
      />
    );
  },
};
```

**IMPORTANT:** `useState` must be called inside the `render` function.
Do NOT write `const [value, setValue] = useState('')` at the top of the file — hooks can only run inside React components/functions.

---

## Part 8 — Import Rules

Always import in this order:

```tsx
// 1. Storybook types
import type { Meta, StoryObj } from '@storybook/react';

// 2. React (only if using hooks like useState in render)
import { useState } from 'react';

// 3. MUI layout components (only what you use in stories)
import { Box, Typography, Stack } from '@mui/material';

// 4. The component being documented
import { YourComponent } from './YourComponent';

// 5. Related exports from the component file (constants, types)
import { SIZES, COLORS } from './YourComponent';
```

**DO NOT import:**

- `React` as a default import (not needed in modern React)
- MUI components you don't actually use in story JSX
- The component's internal helpers or private utilities

---

## Part 9 — Complete Working Example

Here is a complete, correct .stories.tsx file. Use this as your reference.

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Box, Typography } from '@mui/material';

import { StatusBadge } from './StatusBadge';

// Component: StatusBadge
// MUI Base: Chip
// Custom props: status ('active'|'inactive'|'pending'), pulse (boolean)
// Inherited MUI props used: size, onDelete

const meta: Meta<typeof StatusBadge> = {
  title: 'Components/DataDisplay/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
**StatusBadge** displays a user or record status as a color-coded label.

It extends MUI's \`Chip\` and adds a \`status\` prop that maps to semantic colors,
and an optional \`pulse\` animation for active states.

**When to use:** In data tables, user lists, or dashboards to show entity status at a glance.
        `.trim(),
      },
    },
  },
  argTypes: {
    status: {
      description: 'The status value. Determines color and label.',
      control: { type: 'select' },
      options: ['active', 'inactive', 'pending'],
      table: {
        type: { summary: "'active' | 'inactive' | 'pending'" },
        defaultValue: { summary: 'inactive' },
      },
    },
    pulse: {
      description: 'When true, adds a pulsing animation to indicate live status.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    size: {
      description: 'Size of the badge (inherited from MUI Chip).',
      control: { type: 'select' },
      options: ['small', 'medium'],
      table: { defaultValue: { summary: 'medium' } },
    },
    onDelete: {
      description: 'If provided, renders a delete icon. Called when delete icon is clicked.',
      action: 'deleted',
    },
    sx: { control: false, table: { disable: true } },
  },
};
export default meta;
type Story = StoryObj<typeof StatusBadge>;

// --- Required ---

export const Default: Story = {};

export const Playground: Story = {
  parameters: {
    docs: { description: { story: 'Adjust controls to explore all prop combinations.' } },
  },
  args: {
    status: 'active',
    pulse: false,
    size: 'medium',
  },
};

// --- Variant Matrix ---

export const StatusVariants: Story = {
  parameters: {
    docs: { description: { story: 'All status values with their corresponding colors.' } },
  },
  render: () => (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {(['active', 'inactive', 'pending'] as const).map((status) => (
        <Box key={status} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <StatusBadge status={status} />
          <Typography variant="caption">{status}</Typography>
        </Box>
      ))}
    </Box>
  ),
};

export const SizeVariants: Story = {
  render: () => (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {(['small', 'medium'] as const).map((size) => (
        <Box key={size} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <StatusBadge status="active" size={size} />
          <Typography variant="caption">{size}</Typography>
        </Box>
      ))}
    </Box>
  ),
};

// --- State Stories ---

export const WithPulse: Story = {
  parameters: {
    docs: { description: { story: 'Active status with pulse animation enabled.' } },
  },
  args: { status: 'active', pulse: true },
};

export const WithDeleteAction: Story = {
  parameters: {
    docs: { description: { story: 'Renders a delete icon when onDelete is provided.' } },
  },
  args: { status: 'pending', onDelete: () => {} },
};

// --- Composition Stories ---

export const InUserTable: Story = {
  parameters: {
    layout: 'padded',
    docs: { description: { story: 'StatusBadge as it appears in a user management table.' } },
  },
  render: () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: 480 }}>
      {[
        { name: 'Alice Johnson', email: 'alice@company.com', status: 'active' as const },
        { name: 'Bob Chen', email: 'bob@company.com', status: 'inactive' as const },
        { name: 'Carla Rossi', email: 'carla@company.com', status: 'pending' as const },
      ].map((user) => (
        <Box
          key={user.email}
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
        >
          <Box>
            <Typography variant="body2" fontWeight={500}>{user.name}</Typography>
            <Typography variant="caption" color="text.secondary">{user.email}</Typography>
          </Box>
          <StatusBadge status={user.status} size="small" />
        </Box>
      ))}
    </Box>
  ),
};
```

---

## Part 10 — Checklist Before Outputting

Go through this list item by item. Fix any NO before writing the final file.

| Check                                                      | What to verify                           |
| ---------------------------------------------------------- | ---------------------------------------- |
| meta has `tags: ['autodocs']`                            | Present?                                 |
| meta has `export default meta`                           | Present and AFTER the const declaration? |
| `type Story = StoryObj<typeof Component>`                | Present?                                 |
| Every story is `export const Name: Story = {}`           | No `Template.bind({})` patterns?       |
| `Default` story has only required props (or empty)       | No optional props set?                   |
| `Playground` story has all props in `args`             | Controls will work?                      |
| Every union prop has a Variants story                      | Counted?                                 |
| Every boolean prop (non-default true) has a state story    | Covered?                                 |
| Composition stories use realistic content                  | No "test", "foo", "Lorem ipsum"?         |
| useState is inside render function                         | Not at module level?                     |
| All imports are actually used                              | No unused imports?                       |
| argTypes actions are on callbacks, controls on value props | Not mixed up?                            |
