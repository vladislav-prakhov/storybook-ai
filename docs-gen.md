---
name: docs-gen
description: Generate Storybook documentation for a single caldera-ui component.
---

# Storybook Documentation Skill

You generate one Storybook documentation file (`.stories.tsx`) for one caldera-ui
component. You do this by **filling a fixed template with looked-up values**. You do
**not** write stories freehand, and you do **not** copy another component's story file.

---

## INPUTS (provided to you each run — never guess these)

```
COMPONENT   = <component folder name, e.g. text-input>
MUI_NAME    = <matching MUI component name, e.g. TextField>   # may be empty if none
MUI_SLUG    = <MUI docs folder slug, e.g. text-field>         # may be empty if no MUI docs
MUI_DEMOS   = <optional: specific demo filenames, comma-separated, e.g. BasicTextFields.tsx>
              # leave empty to use ALL demos in the MUI docs folder
```

> `MUI_SLUG` is the folder name under `docs/data/material/components/` in your local
> material-ui-docs (v7) repo — it is often plural or kebab-case and differs from `MUI_NAME`
> (e.g. component `TextField` lives in slug `text-field`). Both the overview `.md` and the
> example `.tsx` demos live inside that one folder.

You are launched from the **Development** folder. Both repos are direct subfolders of it:
the caldera-ui repo and the material-ui-docs repo. You do **not** know their exact folder
names or absolute paths — you will discover them in STEP 0 and store them as:

```
UIKIT_ROOT     = <absolute path to the caldera-ui repo>      (resolved in STEP 0)
MUI_DOCS_ROOT  = <absolute path to the material-ui-docs repo> (resolved in STEP 0)
```

After STEP 0, every path in this skill is `UIKIT_ROOT` or `MUI_DOCS_ROOT` joined with a
literal sub-path. Never write a path relative to "wherever you are" — always join to one of
these two absolute roots.

---

## HARD RULES (apply to every step)

1. **Never invent a path.** If a file or folder does not exist, STOP and print the exact
   path you tried, then exit. Do not continue.
2. **Never copy from another component's story file.** Existing stories are not templates.
   The only template is the one in this document (Section: TEMPLATE).
3. **Never paraphrase or "improve" a type description.** Copy descriptions verbatim from the
   sources named below.
4. **Substitute variables literally.** Wherever you see `${COMPONENT}` or `${MUI_NAME}`,
   replace it with the input value. Do not reinterpret it.
5. If a step says "copy", copy the text exactly. If a step says "skip", produce nothing for it.

---

## STEP 0 — Resolve the two repo roots (run once; copy the output)

You are in the Development folder. Run these two commands **exactly as written**. Each prints
one absolute path. Copy that printed line verbatim — that string is the variable's value for
the rest of the run.

**0a. Find the caldera-ui root** (the subfolder that has both `package.json` and `src/components`):
```bash
for d in */; do
  [ -f "${d}package.json" ] && [ -d "${d}src/components" ] && (cd "$d" && pwd)
done
```
Set `UIKIT_ROOT` = the printed line.

**0b. Find the material-ui-docs root** (the subfolder that has `docs/data/material/components`):
```bash
for d in */; do
  [ -d "${d}docs/data/material/components" ] && (cd "$d" && pwd)
done
```
Set `MUI_DOCS_ROOT` = the printed line.

**Stop conditions:**
- If 0a prints nothing → STOP. You are not in the Development folder, or the repo is nested
  deeper. Print: `UIKIT_ROOT not found from $(pwd)` and exit.
- If 0a prints more than one line → STOP and print all lines; a human must pick the right one.
- If 0b prints nothing → set `MUI_DOCS_ROOT = ""` (MUI docs are optional; Step 3 will skip).

From here on, use the resolved absolute strings. Examples (do not reason, just join):
```
${UIKIT_ROOT}/src/components/${COMPONENT}/index.ts
${MUI_DOCS_ROOT}/docs/data/material/components/${MUI_SLUG}/${MUI_SLUG}.md
```

---

## STEP 1 — Parse the component

**1a. Open the index file.** Try in this order and use the first that exists:
```
${UIKIT_ROOT}/src/components/${COMPONENT}/index.ts
${UIKIT_ROOT}/src/components/${COMPONENT}/index.tsx
```
If neither exists → STOP (Hard Rule 1).

**1b. Read the exported types.** The index re-exports types from `./types`. A line looks like:
```ts
export type { TextInputProps, FormikTextFieldProps } from "./types";
```
Collect every type name in the braces. Call this list:
```
ComponentsTypes = TextInputProps, FormikTextFieldProps   # example only — use the real ones
```

**1c. Classify each type using this table. Do not infer — match the prefix.**

| Prefix on the type name | Meaning                                      |
|-------------------------|----------------------------------------------|
| `Formik`                | Wrapped variant of the base component        |
| `RHF`                   | Wrapped variant of the base component        |
| (no known prefix)       | Base component                               |

Example: `TextInputProps` → base. `FormikTextFieldProps` → wrapped variant of the base.

**1d. Run the extractor.** The `npm` script must run from the caldera-ui root, so `cd` there
first. Run these two lines exactly, with `${COMPONENT}` and `${ComponentsTypes}` substituted
(comma-separated, no spaces around commas):

```bash
cd "${UIKIT_ROOT}"
npm run extract-props -- --file src/components/${COMPONENT}/types.ts --types ${ComponentsTypes} --out src/components/${COMPONENT}/extracted/types.json
```

**1e. Read the output:**
```
${UIKIT_ROOT}/src/components/${COMPONENT}/extracted/types.json
```
If it does not exist after the command → STOP and print the command you ran.
This file holds, for each prop of each type: its name, its TypeScript type, and its
description (if any). You will use these in Step 4.

**Also build `LOCAL_PROPS` now:** the set of every prop **name** belonging to the BASE
component type (the type from Step 1c with no `Formik`/`RHF` prefix — the one that backs
`${COMPONENT_EXPORT}`). This is the allow-list of props the wrapped component accepts; Step 3d
uses it to reconcile the MUI example props.

---

## STEP 2 — Get the description AND the title from the source story

Open the existing source story (used **only** to read two values, never as a layout template):
```
${UIKIT_ROOT}/src/components/${COMPONENT}/__stories/${COMPONENT}.stories.tsx
```
> Note: the stories folder is `__stories` (two leading underscores), NOT `stories`.

**2a. Description.** Scan the top of the file for:
```ts
parameters: { docs: { description: { component: "DESCRIPTION TEXT HERE" } } },
```
- If found → set `DESCRIPTION` = that exact text.
- If not found → set `DESCRIPTION` = `""`. Do not write your own.

**2b. Title (this controls the Storybook sidebar — get it right).** Find the existing line:
```ts
title: "Components/SomePath/TextInput",
```
Copy that exact string and set:
```
TITLE = <existing title string> + "/Generated"
```
Example: existing `"Components/Inputs/TextInput"` → `TITLE = "Components/Inputs/TextInput/Generated"`.

This makes the generated doc appear as a **child of the same component node** in the sidebar
instead of a separate folder. Do NOT invent a new title like `components/${COMPONENT}/...`.
If no `title:` exists in the source story → STOP and print that the title could not be found
(do not guess a title; a wrong title splits the sidebar).

---

## STEP 3 — Get the MUI documentation

If `MUI_NAME` is empty **or** `MUI_DOCS_ROOT` is empty → set `MUI_OVERVIEW = ""`, set
`MUI_PROP_DOCS = {}`, set the three demo variables (see 3d) empty, and skip to Step 4.

**3a. Explanation text — this IS the MUI description; capture it richly.** Open:
```
${MUI_DOCS_ROOT}/docs/data/material/components/${MUI_SLUG}/${MUI_SLUG}.md
```
If it does not exist → STOP and print the path (the `MUI_SLUG` input is probably wrong).

Build `MUI_OVERVIEW` by reading the file top to bottom and keeping the explanatory prose while
dropping only the machinery. Do NOT keep "first paragraph only" — keep the full explanation
(intro, "when to use", accessibility notes, any pros/cons, every prose paragraph).

Go line by line. **DROP** a line if any is true:
- It is inside the frontmatter block (from the first `---` line through the next `---`).
- It is inside a fenced code block (between ``` ``` ``` fences) — drop the fences too.
- It starts with `{{` (a demo directive such as `{{"demo": "...js"}}`).
- It starts with `import ` or `export `.
- It is a lone component/HTML tag with no readable sentence (e.g. `<Demo ... />`, `<codeblock>`).

**KEEP** everything else, verbatim and in order:
- Headings (`#`, `##`, `###`) as section titles.
- Every normal prose paragraph (the real explanation).
- For a line shaped like `<p class="description">TEXT</p>`, keep only `TEXT` (strip the tag).

**Then sanitize so Storybook actually renders it.** The string is (a) inserted into a
`` `...` `` template literal AND (b) rendered by Storybook as Markdown→HTML. Both can silently
eat content, so apply ALL of these replacements to the kept text, in order:
1. Replace every backtick `` ` `` with a single quote `'`  (protects the template literal).
2. Replace any literal `${` with `\${`                      (protects the template literal).
3. Replace every `<` with `&lt;` and every `>` with `&gt;`  (**critical** — a single stray
   `<` such as in "the `<input>` element" is read as an opening HTML tag and makes Storybook
   drop everything after it; this is the main reason content "just doesn't show").
4. Delete inline MDX expressions: any `{{ ... }}` occurrence (e.g. `{{"component": "..."}}`).
5. Delete admonition fences: any line that is just `:::something` or `:::` (keep the text
   between them).

Do not summarize, shorten, reorder, or rephrase anything else.

The result, `MUI_OVERVIEW`, goes into the story's `description.component` (Step 5). It only
renders on the **Docs page**, which the `autodocs` tag in the template creates (Step 5).

**3b. MUI prop descriptions.** Open:
```
${MUI_DOCS_ROOT}/docs/translations/api-docs/${MUI_NAME}/${MUI_NAME}.json
```
If it does not exist, try:
```
${MUI_DOCS_ROOT}/docs/translations/api-docs/${MUI_NAME}.json
```
If neither exists → set `MUI_PROP_DOCS = {}` and continue.
This file maps prop name → description. Build `MUI_PROP_DOCS` as that map.

**3c. Description precedence (per prop). Read, do not override:**
- If a prop has a description in `extracted/types.json` → use the caldera description.
- Else if that prop exists in `MUI_PROP_DOCS` → use the MUI description.
- Else → leave the description empty.
Never replace an existing caldera description with the MUI one.

**3d. Copy the example demos as RENDERED TSX stories (not description text).**

The examples must appear as real, rendered stories in the Storybook canvas — each demo becomes
its own `export const ... : Story` with a `render` function. They must NOT be pasted into the
`description` field. If `MUI_SLUG` or `MUI_DOCS_ROOT` is empty → set `DEMO_IMPORTS = ""`,
`DEMO_COMPONENTS = ""`, `MUI_EXAMPLE_STORIES = ""` and skip to Step 4.

**3d-1. List the demo files** in the slug folder:
```bash
ls "${MUI_DOCS_ROOT}/docs/data/material/components/${MUI_SLUG}/"*.tsx 2>/dev/null
```
- If `MUI_DEMOS` was provided → keep only those filenames.
- Else → use every `.tsx` file listed.
- If nothing is listed → set the three demo variables empty and skip to Step 4.

**3d-2. For each demo file `{Name}.tsx`** (`{Name}` = filename without `.tsx`), read the whole
file. The goal: keep the demo's **layout**, but make it render the **wrapped library
component** (`${COMPONENT_EXPORT}`), not the raw MUI one. Process in this order:

a) **Relevance filter.** If the body does NOT use the MUI component as a JSX tag (no
   `<${MUI_NAME} `, `<${MUI_NAME}>`, or `<${MUI_NAME}/>` anywhere) → **SKIP this demo entirely.**
   We only document the wrapped component; a demo that never uses it is not our story.

b) **Imports.** Copy every `import ` line into the pool `DEMO_IMPORTS` **except** the import of
   `${MUI_NAME}` itself — the wrapped component is already imported from `"../.."`, so the MUI
   one must be removed:
   - Line imports only it (`import ${MUI_NAME} from '@mui/material/...';` or
     `import { ${MUI_NAME} } from '@mui/material';`) → drop the whole line.
   - It is one of several names in a braced import
     (`import { ${MUI_NAME}, Box } from '@mui/material';`) → remove only `${MUI_NAME}` (and its
     trailing/leading comma) from the braces; keep the line and the other names.
   Keep all other imports (Box, Stack, MenuItem, etc.) unchanged.

c) **Swap the component in the JSX.** In the non-import lines, replace the MUI tag with the
   wrapped export. Replace ONLY these exact tag forms (whole-token, never inside a longer word):
   - `<${MUI_NAME} `  → `<${COMPONENT_EXPORT} `
   - `<${MUI_NAME}>`  → `<${COMPONENT_EXPORT}>`
   - `<${MUI_NAME}/>` → `<${COMPONENT_EXPORT}/>`
   - `</${MUI_NAME}>` → `</${COMPONENT_EXPORT}>`
   Do NOT touch `${MUI_NAME}` when it is part of a longer identifier (e.g. a function named
   `Basic${MUI_NAME}s`). Do NOT add an import for `${COMPONENT_EXPORT}` — it is already at the top.

d) **Reconcile props against the local component (use `LOCAL_PROPS` from Step 1e).** The demo
   was written for MUI's API; keep only the props the wrapped component actually declares. For
   each swapped `<${COMPONENT_EXPORT} ...>` element, inspect every JSX attribute by its **name**:
   - Attribute forms to recognize: `name="..."`, `name={...}` (the `{...}` value may be an
     object, arrow function, or span multiple lines), and bare boolean `name`.
   - A spread `{...something}` → keep unchanged (cannot be checked).
   - If `name` ∈ `LOCAL_PROPS` → keep the attribute exactly as written.
   - If `name` ∉ `LOCAL_PROPS` → remove that whole attribute (its name **and** its value), and
     add `name` to a list `DROPPED` for this demo.
   Safety: if you cannot confidently find an attribute's start/end (e.g. a deeply nested value),
   do NOT edit it — leave it as-is and add the demo filename to your final summary. Never emit
   broken JSX. Do not rename or remap props; only keep-or-drop by exact name.

e) **Convert the default export** into a local, non-exported component named `{Name}Demo`,
   using exactly ONE of these literal edits (do not improvise):
   - `export default function {Name}(` → `function {Name}Demo(`
   - `export default function (`       → `function {Name}Demo(`   (anonymous form)
   - file ends with `export default {X};` → rename the definition of `{X}` (its
     `function {X}(` or `const {X} =`) to `{Name}Demo`, then delete the `export default {X};` line.
   - **None match → STOP and print the filename.** Do not emit a guessed conversion.
   Append the converted block to `DEMO_COMPONENTS`.

f) **Story** — append to `MUI_EXAMPLE_STORIES` exactly (replace `{DROPPED}` with the
   comma-separated dropped prop names, or `none`):
```tsx
// Adapted from docs/data/material/components/${MUI_SLUG}/{Name}.tsx (mui/material-ui-docs v7)
// — renders the wrapped ${COMPONENT_EXPORT}, not MUI's ${MUI_NAME}.
// Props dropped (not declared on ${COMPONENT_EXPORT}): {DROPPED}
export const {Name}: Story = {
  render: () => <{Name}Demo />,
};
```

> Note: props are now reconciled against `LOCAL_PROPS` in step (d), so a swapped demo should
> only pass props the wrapped component declares. Any prop that was removed is listed in the
> story's `// Props dropped:` comment so nothing disappears silently. If a demo still won't
> type-check, flag its filename in your summary rather than guessing edits.

**3d-3. Dedupe imports.** In `DEMO_IMPORTS`, delete exact-duplicate lines, keeping the first
occurrence (this collapses repeated `import * as React from 'react';`). Keep the remaining
lines in their original order.

---

## STEP 4 — Build argTypes (one entry per prop, with a control)

Produce **one `argType` entry for EVERY prop** — do not skip a prop just because it has no
description. **Split them into two labelled groups** (this split must be visible in the file):

- **Caldera props:** every prop in `extracted/types.json`. Include all of them.
- **MUI props:** every prop in `MUI_PROP_DOCS` that is *not* already a Caldera prop.

**4a-1. Pick the `control` from the prop's TS type** (this is what makes a prop show up and be
editable in the Docs/Controls table — without it some props render as blank). Use this table:

| Prop's TS type is…                          | control                                            |
|---------------------------------------------|----------------------------------------------------|
| `boolean`                                   | `control: "boolean"`                               |
| `number`                                    | `control: "number"`                                |
| `string`                                    | `control: "text"`                                  |
| a union of string literals (`"a" \| "b"`)   | `control: "select"`, plus `options: ["a","b"]`     |
| starts with `on…` (event handler)           | `control: false`                                   |
| anything else (object, ReactNode, function) | `control: false`                                   |

**4a-2. Emit each entry in this exact shape** (omit the `description` line if empty; omit the
`options` line unless it is a string-literal union):
```ts
propName: {
  description: `DESCRIPTION_FROM_PRECEDENCE_RULE`,
  control: CONTROL_FROM_TABLE,
  options: [ ... ],                       // only for string-literal unions
  table: { type: { summary: "TS_TYPE_FROM_EXTRACTED_JSON" } },
},
```
Backtick-escape any description exactly as in Step 3a (backtick → `'`).

Collect the Caldera entries into `CALDERA_ARGTYPES` and the MUI entries into `MUI_ARGTYPES`.
Before moving on, count the props in `extracted/types.json` and confirm `CALDERA_ARGTYPES` has
the same number of entries — if fewer, you skipped some; add them.

**4b. Build `DEFAULT_ARGS` so the rendered story is not empty.** For every prop in
`extracted/types.json` that is **required** (its TypeScript type does NOT contain `undefined`
and the prop name does NOT end with `?`), add one entry to `DEFAULT_ARGS` using this exact
type→value table — do not improvise values:

| Prop type contains…                  | Value to use                          |
|--------------------------------------|---------------------------------------|
| `string`                             | `"${propName}"` (the prop's own name) |
| `number`                             | `0`                                   |
| `boolean`                            | `false`                               |
| an enum / union of string literals   | the **first** literal in the union    |
| starts with `on` (event handler)     | skip it (Storybook auto-mocks these)  |
| anything else (object, node, custom) | skip it                               |

If no props are required, also add the single most common optional display prop if present —
in priority order: `label`, then `placeholder`, then `children` — using the string rule above,
so the story renders something visible. Format each entry as `propName: value,`.
This becomes `{{DEFAULT_ARGS}}`.

---

## STEP 5 — Fill the TEMPLATE

Copy the template below **exactly**. Replace only the `{{PLACEHOLDERS}}`. Change nothing else.

**DOCS PAGE (why the sidebar had no "Docs" entry):** the `tags: ["autodocs"]` line in `meta`
is what generates the auto-documentation page in the Storybook sidebar. Without it there is no
Docs page, and `description.component` + the argTypes table never render anywhere. Keep that
line. (This requires Storybook 7/8 with `@storybook/addon-docs`/essentials enabled, which a
caldera-ui Storybook normally has. If your Storybook is v6, tell the maintainer — v6 uses a
different docs setup.)

**IMPORT RULE (read carefully — this is where unused imports come from):**
Do **NOT** copy import lines from `story_example.tsx` or from any other story. Copying an
example's imports drags in symbols this file never uses. The only imports allowed are:
1. `Meta, StoryObj` from `@storybook/react`
2. the component itself from the component folder's `index.ts`
3. the `{{DEMO_IMPORTS}}` block — the deduped imports from Step 3d, used by the demo components

Do not add any other import. Before writing the file, re-read your import lines and delete any
whose symbol does not appear anywhere in the file body.

**COMPONENT IMPORT PATH (do not change the `../..`):**
The file is written to `${COMPONENT}/__stories/generated/`. From there, the component's
`index.ts` is exactly **two levels up** (`generated/` → `__stories/` → the component folder).
So the import path is `"../.."`, which resolves to `index.ts`. Use the value export name from
`index.ts` (the export that is NOT a `type` export) as `{{COMPONENT_EXPORT}}`.

### TEMPLATE

```tsx
import { Meta, StoryObj } from "@storybook/react";
import { {{COMPONENT_EXPORT}} } from "../..";
{{DEMO_IMPORTS}}

const meta: Meta<typeof {{COMPONENT_EXPORT}}> = {
  title: "{{TITLE}}",
  component: {{COMPONENT_EXPORT}},
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `{{DESCRIPTION}}

{{MUI_OVERVIEW}}`,
      },
    },
  },
  argTypes: {
    // ===== Caldera props =====
    {{CALDERA_ARGTYPES}}

    // ===== MUI props =====
    {{MUI_ARGTYPES}}
  },
};

export default meta;
type Story = StoryObj<typeof {{COMPONENT_EXPORT}}>;

// ===== Demo components copied from mui/material-ui-docs (v7) =====
{{DEMO_COMPONENTS}}

export const Default: Story = {
  args: {
    {{DEFAULT_ARGS}}
  },
};

// ===== MUI examples — rendered in the canvas, NOT in the description =====
{{MUI_EXAMPLE_STORIES}}
```

Placeholder values:
- `{{COMPONENT_EXPORT}}` — the component's value export name from `index.ts` (e.g. `TextInput`).
- `{{DEMO_IMPORTS}}` — deduped demo imports from Step 3d (empty if no demos).
- `{{TITLE}}` — from Step 2b (existing title + `/Generated`).
- `{{DESCRIPTION}}` — from Step 2a.
- `{{MUI_OVERVIEW}}` — from Step 3a (empty string if no MUI docs).
- `{{CALDERA_ARGTYPES}}` / `{{MUI_ARGTYPES}}` — from Step 4.
- `{{DEFAULT_ARGS}}` — from Step 4b.
- `{{DEMO_COMPONENTS}}` — local `{Name}Demo` components from Step 3d (empty if no demos).
- `{{MUI_EXAMPLE_STORIES}}` — one `export const {Name}: Story` per demo from Step 3d (empty if none).

---

## STEP 6 — Write the file

Write the filled template to:
```
${UIKIT_ROOT}/src/components/${COMPONENT}/__stories/generated/${COMPONENT}.stories.tsx
```
This keeps everything inside the **existing component folder** — you are only adding a
`generated/` subfolder inside the component's existing `__stories/` folder. Do **not** create
a stories folder anywhere else. Create `__stories/generated/` if it does not exist, and do not
overwrite the source story at `__stories/${COMPONENT}.stories.tsx`.

---

## VALIDATION CHECKLIST (must all be true before finishing)

- [ ] Every path I opened actually existed; I did not invent any.
- [ ] I did not copy from any component's existing story file.
- [ ] Output is inside the component's own folder: `__stories/generated/${COMPONENT}.stories.tsx` — I did NOT create a stories folder anywhere else.
- [ ] `title` is the source story's title + `/Generated`, so it nests under the same sidebar node.
- [ ] The component import is `from ".."` resolving to the component's `index.ts` (path is `"../.."` from `__stories/generated/`).
- [ ] Imports contain ONLY: Storybook types, the component, and the deduped demo imports. No import whose symbol is unused; nothing copied from any example file.
- [ ] MUI examples are rendered as `export const ...: Story` with a `render` function in the canvas — NOT pasted into the `description`.
- [ ] Each example renders the **wrapped** `${COMPONENT_EXPORT}`, not the raw MUI `${MUI_NAME}`: the MUI import of `${MUI_NAME}` was removed and its JSX tags swapped.
- [ ] In each example, props were reconciled against `LOCAL_PROPS` (from `extracted/types.json`): props not declared on the wrapped component were removed and listed in the `// Props dropped:` comment.
- [ ] Demos that never used `${MUI_NAME}` were skipped.
- [ ] `description.component` contains the real MUI explanation prose (not empty, not one line); backticks were escaped.
- [ ] `Default.args` is populated for required props (not `{}`).
- [ ] `meta` has `tags: ["autodocs"]` so a Docs page appears in the sidebar.
- [ ] `CALDERA_ARGTYPES` has one entry per prop in `extracted/types.json` (count matches) — none skipped — and each entry has a `control`.
- [ ] `description.component` was sanitized: `<`/`>` escaped to `&lt;`/`&gt;`, `{{…}}` and `:::` removed, backticks escaped — so the full text renders on the Docs page.
- [ ] argTypes are split into a `Caldera props` group and a `MUI props` group.
- [ ] No type description was paraphrased; caldera descriptions were never overridden by MUI.
```