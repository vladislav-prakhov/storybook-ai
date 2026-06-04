# Prop Parsing Reference

## Table of Contents

1. [Resolving TypeScript Types](#1-resolving-typescript-types)
2. [MUI Base Component Prop Tables](#2-mui-base-component-prop-tables)
3. [Handling the `sx` prop](#3-handling-the-sx-prop)
4. [Enums and Const Assertions](#4-enums-and-const-assertions)
5. [Event Handler Signatures](#5-event-handler-signatures)

---

## 1. Resolving TypeScript Types

### Pick / Omit / Partial

When you see `Pick<MuiButtonProps, 'color' | 'size'>`:

- Resolve to: only `color` and `size` from MuiButtonProps
- Document only those, not the full MuiButtonProps

When you see `Omit<MuiTextFieldProps, 'variant'>`:

- Inherit all MuiTextFieldProps EXCEPT `variant`
- If the component has its own `variant` prop, use that definition instead

When you see `Partial<SomeType>`:

- All props from `SomeType` become optional (mark `required: false`)

### Intersection types

`ComponentProps & { extraProp: string }`:

- Document both the inherited props (filtered as above) AND `extraProp`
- `extraProp` is a custom prop — high priority

### Generic components

`ComponentProps<T>` — note that `T` affects the type of `value`, `onChange`, and similar.
Generate stories using a concrete type (e.g., `string`, `number`, or a sample object type from the codebase). State this assumption in a comment in the story file.

### String literals vs string

- `type Color = 'primary' | 'secondary' | 'error'` → union type, generate Variants story
- `color: string` → open-ended, use `control: 'text'` in argTypes, no Variants story

### Recursive / nested types

If a prop type references another type defined elsewhere in the codebase (e.g., `option: OptionType`), try to resolve it. If it's a complex object, show a realistic example object in the story's `args`.

---

## 2. MUI Base Component Prop Tables

For each base MUI component, here are the props to **surface** in Storybook (the rest can be ignored unless the component explicitly re-exports them):

### MuiButton / ButtonBase

| Prop          | Type                                                                   | Story priority           |
| ------------- | ---------------------------------------------------------------------- | ------------------------ |
| `variant`   | `'text' \| 'outlined' \| 'contained'`                                  | High — Variants story   |
| `color`     | `'primary' \| 'secondary' \| 'error' \| 'info' \| 'success' \| 'warning'` | High — Variants story   |
| `size`      | `'small' \| 'medium' \| 'large'`                                       | High — Variants story   |
| `disabled`  | `boolean`                                                            | High — State story      |
| `startIcon` | `ReactNode`                                                          | Medium — WithIcon story |
| `endIcon`   | `ReactNode`                                                          | Medium — WithIcon story |
| `fullWidth` | `boolean`                                                            | Medium — State story    |
| `href`      | `string`                                                             | Low                      |
| `loading`   | `boolean` (MUI v6+)                                                  | High if present          |

### MuiTextField / Input

| Prop            | Type                                        | Story priority                          |
| --------------- | ------------------------------------------- | --------------------------------------- |
| `variant`     | `'outlined' \| 'filled' \| 'standard'`      | High                                    |
| `size`        | `'small' \| 'medium'`                      | High                                    |
| `color`       | `'primary' \| 'secondary' \| 'error' \| ...` | Medium                                  |
| `disabled`    | `boolean`                                 | High                                    |
| `error`       | `boolean`                                 | High — always pair with `helperText` |
| `helperText`  | `ReactNode`                               | Medium                                  |
| `label`       | `string`                                  | Medium                                  |
| `placeholder` | `string`                                  | Low                                     |
| `required`    | `boolean`                                 | Medium                                  |
| `fullWidth`   | `boolean`                                 | Medium                                  |
| `multiline`   | `boolean`                                 | Medium if exposed                       |
| `InputProps`  | `object`                                  | Low (only if component uses it)         |

### MuiSelect / Autocomplete

| Prop                     | Type        | Story priority           |
| ------------------------ | ----------- | ------------------------ |
| `value`                | generic     | High — Controlled story |
| `onChange`             | function    | High — Controlled story |
| `options`              | array       | High                     |
| `disabled`             | `boolean` | High                     |
| `multiple`             | `boolean` | High if present          |
| `loading`              | `boolean` | High if present          |
| `open`                 | `boolean` | Low (internal state)     |
| `renderOption`         | function    | Medium if exposed        |
| `getOptionLabel`       | function    | Medium                   |
| `isOptionEqualToValue` | function    | Low                      |

### MuiChip / Badge / Tag

| Prop          | Type                      | Story priority         |
| ------------- | ------------------------- | ---------------------- |
| `label`     | `string`                | High                   |
| `color`     | union                     | High — Variants story |
| `size`      | union                     | High — Variants story |
| `variant`   | `'filled' \| 'outlined'` | High                   |
| `onDelete`  | function                  | Medium — State story  |
| `avatar`    | `ReactNode`             | Medium                 |
| `icon`      | `ReactNode`             | Medium                 |
| `clickable` | `boolean`               | Medium                 |
| `disabled`  | `boolean`               | Medium                 |

### MuiDialog / Modal

| Prop           | Type                                 | Story priority                        |
| -------------- | ------------------------------------ | ------------------------------------- |
| `open`       | `boolean`                          | High — always use controlled pattern |
| `onClose`    | function                             | High                                  |
| `maxWidth`   | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | High — Variants story                |
| `fullWidth`  | `boolean`                          | Medium                                |
| `fullScreen` | `boolean`                          | Medium                                |

### MuiTable

| Prop                                   | Type                   | Story priority                    |
| -------------------------------------- | ---------------------- | --------------------------------- |
| `rows` / `data`                    | array                  | High — use realistic sample data |
| `columns`                            | array                  | High                              |
| `loading`                            | `boolean`            | High                              |
| `onRowClick`                         | function               | Medium                            |
| `selectable` / `checkboxSelection` | `boolean`            | Medium                            |
| `pagination`                         | `boolean` or object  | Medium                            |
| `sortable` / `onSortChange`        | `boolean` / function | Medium                            |
| `emptyStateMessage`                  | `ReactNode`          | Medium — Empty story             |

---

## 3. Handling the `sx` prop

The `sx` prop is inherited from MUI's `SystemProps`. Rules:

- **Never** generate a story specifically for `sx`
- **Do** include it in `argTypes` as `control: false` so it's visible but not interactive
- In composition stories, you may use `sx` for layout purposes (spacing, alignment), but not as the point of the story
- In the argTypes, document it briefly: `"MUI system prop for one-off styling overrides."`

---

## 4. Enums and Const Assertions

If the component file exports or imports an enum or `as const` object for prop values:

```ts
export const SIZES = ['small', 'medium', 'large'] as const;
export type Size = typeof SIZES[number];
```

→ Use `SIZES` directly in the story render for the Variants story:

```tsx
import { SIZES } from './ComponentName';
// ...
{SIZES.map(size => <ComponentName key={size} size={size} />)}
```

This is better than hardcoding the values — it stays in sync when the enum grows.

---

## 5. Event Handler Signatures

Document these precisely in argTypes because developers copy them:

```tsx
// Bad — too vague
onChange: { description: 'Called when value changes.' }

// Good — precise
onChange: {
  description: 'Callback fired when the selected value changes.',
  table: {
    type: { summary: '(event: React.ChangeEvent<HTMLInputElement>, value: string) => void' },
  },
}
```

For custom event handlers that don't follow the MUI convention, extract the exact signature from the component's TypeScript definition and paste it into `table.type.summary`.
