# TypeScript Prop Resolution — Step-by-Step Guide

This file teaches you how to read TypeScript component code and extract props correctly.
Read this file FIRST before parsing any component. Work through each section that applies.

---

## RULE: Always show your work

Before writing any story, write a "prop table" comment block at the top of your reasoning.
This forces you to resolve types before guessing. Format:

```
PROP TABLE for ComponentName
| prop        | type                          | required | default   | variants              |
|-------------|-------------------------------|----------|-----------|-----------------------|
| size        | 'small' | 'medium' | 'large'  | no       | 'medium'  | small, medium, large  |
| disabled    | boolean                       | no       | false     | -                     |
| onChange    | (val: string) => void         | no       | -         | -                     |
```

Only after completing this table should you start writing stories.

---

## Section A — Reading the Props Interface

### A1. Simple interface

```ts
interface ButtonProps {
  label: string;        // required (no ?)
  disabled?: boolean;   // optional (has ?)
  size?: 'sm' | 'md' | 'lg';
}
```

→ Extract:

- `label`: type=string, required=YES, variants=none
- `disabled`: type=boolean, required=NO, default=false (boolean defaults to false when absent)
- `size`: type=union, required=NO, variants=[sm, md, lg]

### A2. Interface with extends

```ts
interface ChipProps extends MuiChipProps {
  sentiment?: 'positive' | 'negative' | 'neutral';
}
```

→ `ChipProps` has ALL of `MuiChipProps` props PLUS `sentiment`.
→ For your prop table: add `sentiment` as a custom prop with variants [positive, negative, neutral].
→ For inherited MUI props: check references/prop-parsing.md → MUI Chip section. Only include the ones listed there. Do NOT include all of MuiChipProps — there are 40+ props and most are irrelevant.

### A3. Interface with intersection (&)

```ts
type TagProps = MuiChipProps & {
  variant?: 'filled' | 'outlined';
  removable?: boolean;
};
```

→ Same as extends. `TagProps` = MuiChipProps props + `variant` + `removable`.
→ Note: if MuiChipProps ALSO has a `variant` prop, the local definition WINS — use the local one.

---

## Section B — Utility Types (resolve these before anything else)

### B1. Pick<Type, Keys>

**Meaning:** Keep ONLY the listed keys from Type.

```ts
type ButtonProps = Pick<MuiButtonProps, 'color' | 'size' | 'disabled'>;
```

→ ButtonProps has EXACTLY: `color`, `size`, `disabled` — nothing else from MuiButtonProps.
→ For each key, look up its type in the MUI prop table in references/prop-parsing.md.

```ts
// Example with local props added:
type ButtonProps = Pick<MuiButtonProps, 'color' | 'size'> & {
  loading?: boolean;
};
```

→ Props: `color` (from MUI), `size` (from MUI), `loading` (custom boolean).

### B2. Omit<Type, Keys>

**Meaning:** Keep EVERYTHING from Type EXCEPT the listed keys.

```ts
type TextFieldProps = Omit<MuiTextFieldProps, 'variant' | 'size'> & {
  variant?: 'default' | 'compact';
  size?: 'small' | 'large';
};
```

→ Step 1: Start with all MuiTextFieldProps.
→ Step 2: Remove `variant` and `size`.
→ Step 3: Add the custom `variant` (values: default, compact) and `size` (values: small, large).
→ The custom definitions REPLACE the MUI ones.

### B3. Partial`<Type>`

**Meaning:** Makes ALL props of Type optional.

```ts
type FormFieldProps = Partial<BaseFieldProps> & {
  name: string;  // this one stays required
};
```

→ Everything from BaseFieldProps becomes optional (add ? to all).
→ `name` is required (it's declared directly without Partial).

### B4. Required`<Type>`

**Meaning:** Makes ALL props required (removes ?).

```ts
type StrictButtonProps = Required<ButtonProps>;
```

→ Every prop from ButtonProps that was optional (?) becomes required.

### B5. Nested utility types

Sometimes they stack:

```ts
type Props = Omit<Partial<MuiButtonProps>, 'color'> & { color: 'brand' | 'muted' };
```

→ Resolve INSIDE OUT:

1. `Partial<MuiButtonProps>` → all MUI button props become optional
2. `Omit<..., 'color'>` → remove `color`
3. `& { color: 'brand' | 'muted' }` → add custom `color` with these variants
   → Result: all MUI button props (optional) + custom color (required? no, has no `?` marker, so required).

---

## Section C — Union Types (this is where variants come from)

### C1. String literal union

```ts
type Size = 'small' | 'medium' | 'large';
```

→ variants = [small, medium, large]
→ This needs a `SizeVariants` story.

### C2. Union via type alias

```ts
type Color = 'primary' | 'secondary' | 'error';
interface ButtonProps {
  color?: Color;
}
```

→ Same as writing `color?: 'primary' | 'secondary' | 'error'` directly.
→ Always expand the alias. variants = [primary, secondary, error].

### C3. as const array

```ts
const SIZES = ['small', 'medium', 'large'] as const;
type Size = typeof SIZES[number];
```

→ `typeof SIZES[number]` means: take each element of the SIZES array as a type.
→ Result: `Size = 'small' | 'medium' | 'large'`
→ In your stories, import SIZES and iterate over it:

```tsx
import { SIZES } from './ComponentName';
{SIZES.map(size => <ComponentName key={size} size={size} />)}
```

### C4. as const object

```ts
const VARIANTS = { filled: 'filled', outlined: 'outlined' } as const;
type Variant = typeof VARIANTS[keyof typeof VARIANTS];
```

→ `keyof typeof VARIANTS` = 'filled' | 'outlined'
→ `typeof VARIANTS[keyof typeof VARIANTS]` = 'filled' | 'outlined'
→ variants = [filled, outlined]

### C5. Enum

```ts
enum Status { Active = 'active', Inactive = 'inactive', Pending = 'pending' }
interface Props { status?: Status; }
```

→ variants = [active, inactive, pending] (use the string VALUES, not the enum keys)
→ In stories, import and use the enum: `status={Status.Active}`

### C6. Union with non-string types (skip variants story)

```ts
type Value = string | number | null;
```

→ This is NOT a literal union — do NOT generate a Variants story.
→ Use `control: 'text'` in argTypes. Show examples in args.

---

## Section D — Function / Callback Props

### D1. Arrow function type

```ts
onChange?: (value: string) => void;
```

→ Record signature as-is: `(value: string) => void`
→ In argTypes, use `action: 'onChange'`
→ In stories that need a working handler (like Controlled), write: `onChange: (val) => console.log(val)`

### D2. React event handler

```ts
onClick?: React.MouseEventHandler<HTMLButtonElement>;
// which expands to:
onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
```

→ Record as: `(event: MouseEvent<HTMLButtonElement>) => void`
→ In argTypes: `action: 'onClick'`

### D3. Generic callback

```ts
onSelect?: <T>(item: T, index: number) => void;
```

→ For stories, use a concrete type. Write in a comment: `// Using T=OptionType for stories`
→ args example: `onSelect: (item, idx) => console.log(item, idx)`

### D4. The difference between prop and function

```ts
// This is a VALUE prop (renders something):
icon?: React.ReactNode;
prefix?: React.ReactNode;

// This is a CALLBACK prop (called when something happens):
onChange?: (val: string) => void;
onClose?: () => void;
```

→ ReactNode props → use `control: false` in argTypes, show examples in render stories
→ Callback props → use `action: 'propName'` in argTypes

---

## Section E — Default Values

### E1. Destructuring defaults

```tsx
function Button({ size = 'medium', disabled = false, label }: ButtonProps) {
```

→ `size` default = 'medium', `disabled` default = false, `label` has no default (required)

### E2. defaultProps (older pattern, still exists)

```tsx
Button.defaultProps = { size: 'medium', color: 'primary' };
```

→ Same — record these as defaults in your prop table.

### E3. No default visible

If no default is visible in the component body and the prop is optional:
→ Write `default: undefined` in your prop table.
→ In `argTypes`, set `table: { defaultValue: { summary: 'undefined' } }`

### E4. Boolean defaults

- `disabled?: boolean` with no default → practically defaults to `false` (undefined is falsy)
- Write `default: false` in your prop table.

---

## Section F — Generic Components

```tsx
interface SelectProps<T> {
  options: T[];
  value?: T;
  onChange?: (value: T) => void;
  getOptionLabel?: (option: T) => string;
}

function Select<T>({ options, value, onChange }: SelectProps<T>) { ... }
```

→ For stories, pick a CONCRETE type. Use `string` for simple cases, or a small object type for realistic ones.
→ Add a comment at the top of the stories file:

```tsx
// Stories use T = { id: number; label: string } as the option type.
```

→ Example args:

```tsx
args: {
  options: [
    { id: 1, label: 'Option A' },
    { id: 2, label: 'Option B' },
  ],
  getOptionLabel: (o) => o.label,
}
```

---

## Section G — What to SKIP (do not document these)

These props exist in almost all MUI components. Skip them unless the component does something special with them:

| Prop          | Reason to skip                                 |
| ------------- | ---------------------------------------------- |
| `ref`       | Internal React mechanism, not user-facing      |
| `sx`        | Include in argTypes as `control: false` only |
| `classes`   | MUI internal styling, not for kit users        |
| `component` | Polymorphic override, advanced use only        |
| `aria-*`    | Accessibility plumbing, not visual             |
| `data-*`    | Test/tracking attributes                       |
| `tabIndex`  | Accessibility plumbing                         |
| `id`        | HTML attribute, not component behavior         |
| `style`     | Use sx instead in MUI ecosystem                |

---

## Quick Reference: TypeScript → argTypes control mapping

| TypeScript type                            | argTypes control                                    |
| ------------------------------------------ | --------------------------------------------------- |
| `'a' \| 'b' \| 'c'` (string literal union) | `{ type: 'select' }` + `options: ['a','b','c']` |
| `boolean`                                | `'boolean'`                                       |
| `string` (open)                          | `'text'`                                          |
| `number`                                 | `'number'`                                        |
| `React.ReactNode`                        | `control: false`                                  |
| `() => void` (callback)                  | `action: 'propName'`                              |
| `object / array`                         | `control: false` (show in render)                 |
| `string \| number` (mixed)                | `'text'`                                          |
| `enum`                                   | `{ type: 'select' }` + enum values as options     |
