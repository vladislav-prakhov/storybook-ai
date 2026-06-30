---
name: docs-gen
description: Generate one controllable Storybook Docs page (a single story driven by argTypes) for a caldera-ui component.
---

# Storybook Documentation Skill — single story + autodocs

You generate ONE `.stories.tsx` file for one component. The file has:
- a **single story** (`Playground`) that is manipulated entirely through **argTypes controls**,
- an **autodocs Docs page** in the sidebar,
- **one argTypes entry per prop**, each with a category, a control, and a description.

You fill a fixed template. You do NOT write stories freehand, you do NOT add extra stories, and
you do NOT copy another component's story file.

---

## INPUTS (provided each run — never guess these)

```
COMPONENT = <component folder name, e.g. text-input>
MUI_NAME  = <matching MUI component name, e.g. TextField>   # leave empty if it wraps no MUI component
```

Roots are discovered in STEP 0 and stored as:
```
UIKIT_ROOT    = <absolute path to the caldera-ui repo>        (STEP 0)
MUI_DOCS_ROOT = <absolute path to the material-ui-docs repo>  (STEP 0; only needed if MUI_NAME is set)
```
After STEP 0, every path is one of these absolute roots joined with a literal sub-path.

---

## HARD RULES (apply to every step)

1. **Never invent a path.** If a file does not exist, STOP and print the exact path you tried.
2. **Never copy from another story file.** The only template is in STEP 5.
3. **Only ONE story** (`Playground`). Do not add example/demo stories.
4. **Every prop appears exactly once** in argTypes. No duplicates.
5. **Every prop has a description.** If none exists in the sources, you generate one (STEP 4c).
6. Substitute `${COMPONENT}`, `${MUI_NAME}`, `${COMPONENT_EXPORT}` literally; do not reinterpret.

---

## STEP 0 — Resolve the repo roots (run once; copy the output)

You are launched from the **Development** folder, with both repos as direct subfolders.

**0a. caldera-ui root** (the subfolder with `package.json` AND `src/components`):
```bash
for d in */; do
  [ -f "${d}package.json" ] && [ -d "${d}src/components" ] && (cd "$d" && pwd)
done
```
Set `UIKIT_ROOT` = the printed line. If nothing prints → STOP and print `UIKIT_ROOT not found from $(pwd)`. If more than one line prints → STOP and print all of them.

**0b. material-ui-docs root** (only if `MUI_NAME` is set):
```bash
for d in */; do
  [ -d "${d}docs/translations/api-docs" ] && (cd "$d" && pwd)
done
```
Set `MUI_DOCS_ROOT` = the printed line. If nothing prints → set `MUI_DOCS_ROOT = ""`.

---

## STEP 1 — Parse the component

**1a. Open the index file** (first that exists):
```
${UIKIT_ROOT}/src/components/${COMPONENT}/index.ts
${UIKIT_ROOT}/src/components/${COMPONENT}/index.tsx
```
If neither exists → STOP.

**1b. Read the exported types.** The index re-exports types from `./types`, e.g.:
```ts
export type { TextInputProps, FormikTextFieldProps } from "./types";
```
Collect every name in the braces → `ComponentsTypes`.

**1c. Identify the base component.** Classify each type by prefix:

| Prefix on the type name | Meaning                            |
|-------------------------|------------------------------------|
| `Formik`                | Wrapped variant (ignore for props) |
| `RHF`                   | Wrapped variant (ignore for props) |
| (no known prefix)       | **Base** component                 |

The BASE type (no prefix) backs the component. Its value export name in `index.ts` (the export
that is NOT a `type` export) is `${COMPONENT_EXPORT}` (e.g. `TextInput`).

**1d. Run the extractor** from the caldera-ui root:
```bash
cd "${UIKIT_ROOT}"
npm run extract-props -- --file src/components/${COMPONENT}/types.ts --types ${ComponentsTypes} --out src/components/${COMPONENT}/extracted/types.json
```

**1e. Read the output:**
```
${UIKIT_ROOT}/src/components/${COMPONENT}/extracted/types.json
```
If it does not exist → STOP and print the command you ran. This file gives, per prop of the
BASE type: its **name**, its **TS type**, and its **description** (often empty). These props are
the **Caldera props**.

---

## STEP 2 — Get the title from the source story

Open the existing source story (read two values only; never use it as a layout template):
```
${UIKIT_ROOT}/src/components/${COMPONENT}/__stories__/${COMPONENT}.stories.tsx
```
> The stories folder is `__stories__` (two leading and two trailing underscores).

**2a. Title (controls the sidebar).** Find the existing `title: "..."` line, copy it exactly, and set:
```
TITLE = <existing title string> + "/Generated/" + ${COMPONENT_EXPORT}
```
Example: existing `"Components/Inputs/TextInput"` with export `TextInput` →
`TITLE = "Components/Inputs/TextInput/Generated/TextInput"`. This nests the generated page in a
`Generated` group under the same sidebar node as the component. If no `title:` is found → STOP
and print that the title is missing (do not guess one).

**2b. Component description (optional).** If the source story has
`parameters.docs.description.component`, copy that text → `DESCRIPTION`. Otherwise write ONE
clear sentence describing the component from its name and `MUI_NAME` → `DESCRIPTION`. Sanitize
it per STEP 4c rule "S".

---

## STEP 3 — Get MUI prop descriptions (skip if no MUI_NAME)

If `MUI_NAME` is empty OR `MUI_DOCS_ROOT` is empty → set `MUI_PROP_DOCS = {}` and skip to STEP 4.

Open (first that exists):
```
${MUI_DOCS_ROOT}/docs/translations/api-docs/${MUI_NAME}/${MUI_NAME}.json
${MUI_DOCS_ROOT}/docs/translations/api-docs/${MUI_NAME}.json
```
If neither exists → set `MUI_PROP_DOCS = {}`. Otherwise build `MUI_PROP_DOCS` as the map of
prop name → description from this file. (We use it for prop descriptions and to know which extra
MUI props exist. No overview text, no demos.)

---

## STEP 4 — Build the argTypes (the core of this skill)

**4a. Merge props with hierarchy (Caldera overrides MUI).**
- Caldera props = every prop in `extracted/types.json`.
- MUI props = every prop name in `MUI_PROP_DOCS`.
- Form one set of unique prop names. If a name is in **both**, keep a SINGLE entry and treat it
  as a **Caldera** prop (its type and description come from the extracted file). A name only in
  MUI → MUI prop. **No prop name may appear twice in argTypes.**
- Category per prop (this sets `table.category`):
  - Caldera prop → `"Caldera props"`
  - MUI prop     → `"MUI Props"`

**4b. Pick the `control` from the prop's TS type:**

| Prop's TS type is…                          | control                                        | Technical? |
|---------------------------------------------|------------------------------------------------|------------|
| `boolean`                                   | `control: "boolean"`                           | no         |
| `number`                                    | `control: "number"`                            | no         |
| `string`                                    | `control: "text"`                              | no         |
| union of string literals (`"a" \| "b"`)     | `control: "select"`, plus `options: ["a","b"]` | no         |
| starts with `on…` (event handler)           | `control: false`                               | **yes**    |
| anything else (function, object, ReactNode) | `control: false`                               | **yes**    |

A prop whose control is `false` is **technical** (QA cannot exercise it from the Controls panel).

**4c. Resolve a description for EVERY prop (mandatory — never leave it empty).** In order:
1. Caldera prop with a non-empty description in `extracted/types.json` → use it.
2. Else if the prop is in `MUI_PROP_DOCS` → use the MUI description.
3. Else → **generate one clear sentence** from: the component's purpose, the prop name, and its
   type. Be accurate and specific, not boilerplate. Examples:
   - `disabled: boolean` → `Disables the field so it cannot be focused or edited.`
   - `size: "small" | "medium"` → `Controls the overall size of the component.`
   - `startAdornment: ReactNode` → `Content rendered at the start of the field, such as an icon.`

**Rule S — keep characters ordinary; only protect the JS template literal.** Storybook shows
HTML entities like `&lt;` literally, so do NOT convert anything to entities. Apply only:
- Leave `<` and `>` exactly as written (ordinary signs).
- Escape a backtick as `` \` `` and `${` as `\${` so the description string does not break —
  these render as a normal backtick / `${` on the page.
- Delete any `{{ ... }}` sequence.

Do not transform anything else.

**4d. Add the QA notice to technical props.** If the prop's control is `false` (technical),
append this exact text to its description:
```
 — ⚠️ Technical Property
```

**4e. Emit one entry per prop** (omit the `options` line unless it is a string-literal union):
```ts
propName: {
  description: `RESOLVED_DESCRIPTION (+ QA notice if technical)`,
  control: CONTROL_FROM_TABLE,
  options: [ ... ],
  table: {
    category: "Caldera props",        // or "MUI Props"
    type: { summary: "TS_TYPE_FROM_SOURCE" },
  },
},
```
Concatenate all entries into `{{ARGTYPES}}`. Confirm: (a) the entry count equals the number of
unique prop names, and (b) no prop name appears twice.

**4f. Build `DEFAULT_ARGS` so the single story renders something.** For every **required**
Caldera prop (TS type does NOT contain `undefined` and the name does NOT end with `?`), add one
`propName: value,` using this table:

| Prop type contains…                | Value                                 |
|------------------------------------|---------------------------------------|
| `string`                           | `"${propName}"` (the prop's own name) |
| `number`                           | `0`                                   |
| `boolean`                          | `false`                               |
| union of string literals           | the **first** literal                 |
| starts with `on` (handler)         | skip                                  |
| anything else                      | skip                                  |

If nothing is required, add the first present of `label`, `placeholder`, `children` (string
rule) so the story is not blank. This becomes `{{DEFAULT_ARGS}}`.

---

## STEP 5 — Fill the TEMPLATE

Copy the template exactly; replace only the `{{PLACEHOLDERS}}`.

**DOCS PAGE:** `tags: ["autodocs"]` is what creates the Docs page in the sidebar and renders the
description + the controls table. Keep that line. (Requires Storybook 7/8 with addon-docs /
essentials, which a caldera-ui Storybook normally has.)

**IMPORTS:** the only imports allowed are the two below. Do not copy imports from any example
file; do not add anything whose symbol is not used.

**IMPORT PATH:** the file is written to `${COMPONENT}/__stories__/generated/`, so the component's
`index.ts` is two levels up → import from `"../.."`.

### TEMPLATE

```tsx
import { Meta, StoryObj } from "@storybook/react";
import { {{COMPONENT_EXPORT}} } from "../..";

const meta: Meta<typeof {{COMPONENT_EXPORT}}> = {
  title: "{{TITLE}}",
  component: {{COMPONENT_EXPORT}},
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `{{DESCRIPTION}}`,
      },
    },
  },
  argTypes: {
    {{ARGTYPES}}
  },
};

export default meta;
type Story = StoryObj<typeof {{COMPONENT_EXPORT}}>;

export const Playground: Story = {
  args: {
    {{DEFAULT_ARGS}}
  },
};
```

Placeholders:
- `{{COMPONENT_EXPORT}}` — base component value export from `index.ts`.
- `{{TITLE}}` — STEP 2a (existing title + `/Generated`).
- `{{DESCRIPTION}}` — STEP 2b (sanitized).
- `{{ARGTYPES}}` — STEP 4 (one entry per prop, each with category + control + description).
- `{{DEFAULT_ARGS}}` — STEP 4f.

---

## STEP 6 — Write the file

Write to (inside the component's own folder — only add the `generated/` subfolder):
```
${UIKIT_ROOT}/src/components/${COMPONENT}/__stories__/generated/${COMPONENT}.stories.tsx
```
Create `__stories__/generated/` if missing. Do not overwrite `__stories__/${COMPONENT}.stories.tsx`.

---

## VALIDATION CHECKLIST (all must be true)

- [ ] Exactly ONE story (`Playground`); no example/demo stories were added.
- [ ] `meta` has `tags: ["autodocs"]` so a Docs page appears in the sidebar.
- [ ] `title` is the source story's title + `/Generated/` + the component name.
- [ ] The component import is `from ".."` (path `"../.."`) and imports nothing unused.
- [ ] Every prop appears exactly once in `{{ARGTYPES}}` — Caldera overrode any MUI duplicate.
- [ ] Every prop has `table.category` of `"Caldera props"` or `"MUI Props"`, strictly per source.
- [ ] Every prop has a `control` and a non-empty `description`; missing ones were generated.
- [ ] Descriptions keep ordinary signs (no `&lt;`/`&gt;`); only backticks and `${` were escaped, and `{{…}}` removed.
- [ ] Every technical prop (`control: false`) carries the `⚠️ Technical Property` notice in its description.
- [ ] Output written to `__stories__/generated/${COMPONENT}.stories.tsx`.