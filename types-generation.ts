#!/usr/bin/env tsx
/**
 * Resolve the props of one or more TS types in a file, recursively, to a table.
 *
 *   npm run props -- src/types.ts WrapperTextFieldProps
 *   npm run props -- src/types.ts WrapperTextFieldProps OtherProps
 *   npm run props -- src/types.ts WrapperTextFieldProps --out props.json --own
 *
 * Run directly if the npm script misbehaves:
 *   npx tsx scripts/extract-props.ts src/types.ts WrapperTextFieldProps
 */
import { Project, Type, Node, ts } from "ts-morph";
import * as fs from "node:fs";

// ---------------------------------------------------------------------------
// 1. Command-line arguments
// ---------------------------------------------------------------------------

/**
 * Minimal argv parser — no external dependency (no commander/yargs).
 *
 * Splits raw argv into two buckets:
 *
 * - **positionals** — bare words. The first is the source file, the rest are
 *   type names: `[file, ...typeNames]`.
 * - **flags** — `--name value` pairs, or `--name` alone for booleans. A flag
 *   followed by another `--flag` (or nothing) is treated as `true`.
 *
 * A lone `--` separator is skipped, so `npm run props -- src/types.ts Foo`
 * works: npm forwards everything after `--`, and any stray `--` is ignored.
 *
 * Note: values are **not** type-coerced. Numeric flags come back as strings and
 * are converted at the call site (e.g. `Number(flags.depth)`).
 *
 * @param argv - Argument list, normally `process.argv.slice(2)`.
 * @returns `positionals` in the order given, and `flags` keyed without the
 *          leading `--` (so `--include-dom` becomes `flags["include-dom"]`).
 *
 * @example
 * parseArgs(["src/types.ts", "ButtonProps", "--own", "--depth", "4"]);
 * // => {
 * //      positionals: ["src/types.ts", "ButtonProps"],
 * //      flags: { own: true, depth: "4" }
 * //    }
 */
function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) flags[key] = true;
      else { flags[key] = next; i++; }
    } else positionals.push(a);
  }
  return { positionals, flags };
}

const { positionals, flags } = parseArgs(process.argv.slice(2));

/**
 * **Which file to read.** Path to the `.ts` file that *declares* your props.
 *
 * It must be the file where `interface Foo` or `type Foo = ...` is literally
 * written — pointing at a barrel that merely re-exports the type will fail with
 * "not found".
 *
 * Given as the **first bare argument**; `--file <path>` also works.
 *
 * @example `npm run props -- src/TextField/types.ts WrapperTextFieldProps`
 */
const filePath = (flags.file as string) ?? positionals[0];

/**
 * **Which types to document.** One or more type names declared in {@link filePath}.
 *
 * Given as **all remaining bare arguments**, separated by spaces or commas
 * (both forms work, and can be mixed); `--types A,B` also works. Each type gets
 * its own table. If a name isn't found, the script lists the type names that
 * *are* declared in the file so you can spot a typo.
 *
 * @example `npm run props -- src/types.ts ButtonProps IconButtonProps`
 */
const typeNames = (flags.types ? [String(flags.types)] : positionals.slice(1))
  .flatMap(s => s.split(","))
  .map(s => s.trim())
  .filter(Boolean);

/**
 * **Where your compiler settings live.** `--tsconfig <path>`, default `tsconfig.json`.
 *
 * This is what lets MUI types and your `@/...` path aliases resolve at all. If
 * props come out as `any` or a wrapped type looks half-empty, you're almost
 * certainly on the wrong tsconfig — point this at your real one. If the file is
 * missing, the script warns and falls back to built-in defaults.
 *
 * @example `--tsconfig packages/ui/tsconfig.json`
 */
const tsConfigPath = (flags.tsconfig as string) ?? "tsconfig.json";

/**
 * **Hide everything you didn't write.** `--own`, default off.
 *
 * Keeps only props declared in your own source, dropping all inherited ones —
 * including the documented MUI props. Useful for reviewing just your wrapper's
 * additions. For a Storybook table you usually want the default instead
 * (yours + MUI, minus DOM noise).
 */
const ownOnly = Boolean(flags.own);

/**
 * **Stop hiding the `aria-*` flood.** `--include-dom`, default off.
 *
 * By default every prop inherited from `@types/react` — `aria-*`, `onCopy`,
 * `className`, `style`, and the rest of `HTMLAttributes` — is dropped, leaving
 * your props plus the MUI props that appear in MUI's documentation. Pass this
 * to keep them all. Overrides {@link ownOnly}.
 */
const includeDom = Boolean(flags["include-dom"]);

/**
 * **Include the raw nested structure.** `--tree`, default off.
 *
 * Adds a verbose `_tree` field to each prop in the JSON output, holding the
 * full recursive type description. Off by default because the flat `type` and
 * `variants` fields are all Storybook needs; turn it on only if something
 * downstream walks the nested shape.
 */
const keepTree = Boolean(flags.tree);

/**
 * **Guard against monster types.** `--maxlen <n>`, default `200` characters.
 *
 * Any prop whose rendered type string grows past this is collapsed back to the
 * short name the author wrote. This is what stops types like `sx` from dumping
 * megabytes of expanded CSS properties into your table, even for types you
 * never thought to exclude. Lower it (`--maxlen 120`) for terser tables, raise
 * it to let more detail through.
 */
const maxLen = Number(flags.maxlen ?? 200);

/**
 * **Types to show by name instead of expanding.** `--ignore A,B`, default none.
 *
 * Comma-separated type names added to the built-in opaque list (which already
 * covers `ReactNode`, `SxProps`, `Theme`, `CSSProperties`, event types, refs).
 * Use it when some type in your own kit is large or uninteresting and you'd
 * rather see the alias than its contents.
 *
 * @example `--ignore CSSObject,SystemStyleObject`
 */
const ignoreList = (flags.ignore ? String(flags.ignore).split(",") : [])
  .map(s => s.trim()).filter(Boolean);

/**
 * **Save the results.** `--out <path>`, default none.
 *
 * Writes all extracted props as JSON to this path — the input for generating
 * Storybook `argTypes`. The console table prints either way; the JSON keeps
 * full type strings, while the table truncates long ones for readability.
 *
 * @example `--out src/TextField/props.json`
 */
const outFile = flags.out as string | undefined;

/**
 * **How deep to recurse.** `--depth <n>`, default `6`.
 *
 * Nested objects and callback parameters are expanded down to primitives up to
 * this depth; past it, a type is emitted as-is. Raise it for deeply nested
 * config props, lower it if tables get noisy.
 */
const maxDepth = Number(flags.depth ?? 6);

/**
 * Human-readable help. Printed on `--help`, `-h`, or bare `help`, and also when
 * a required argument is missing. Requires no file or type name — it is checked
 * and exits before any file access or type resolution happens.
 */
const HELP = `
Extract all props of a TypeScript type, recursively resolved, as a table.

USAGE
  npm run props -- <file.ts> <TypeName> [MoreTypes...] [options]

ARGUMENTS
  <file.ts>        File that declares the type. Must be where "interface Foo"
                   is actually written, not a barrel that re-exports it.
  <TypeName>       One or more type names, space- or comma-separated.

OPTIONS
  --tsconfig <p>   Compiler config to use.                  [default: tsconfig.json]
                   Needed for MUI types and "@/" path aliases to resolve.
  --own            Only props you declared yourself; hides all inherited ones.
  --include-dom    Also keep aria-*, className, style and other DOM/event props.
                   (By default these are hidden, leaving your props + MUI's
                   documented ones.)
  --maxlen <n>     Collapse any type longer than n chars to its short name,
                   so types like "sx" don't dump megabytes.      [default: 200]
  --ignore <A,B>   Extra type names to show by name instead of expanding.
                   ReactNode, SxProps, Theme, refs and events are already hidden.
  --depth <n>      How deep to expand nested objects and callbacks. [default: 6]
  --tree           Add the full nested "_tree" structure to JSON output.
  --out <path>     Write results to a JSON file. Table prints either way.
  --help           Show this message. (also -h, or: npm run props:help)

EXAMPLES
  # Your props plus MUI's documented ones, saved for Storybook
  npm run props -- src/TextField/types.ts WrapperTextFieldProps --out props.json

  # Just your own additions, compact types
  npm run props -- src/TextField/types.ts WrapperTextFieldProps --own --maxlen 120

  # Several types at once
  npm run props -- src/types.ts ButtonProps IconButtonProps
`;

if (flags.help || flags.h || positionals[0] === "-h" || positionals[0] === "help") {
  console.log(HELP);
  process.exit(0);
}
if (!filePath || typeNames.length === 0) {
  if (!filePath) console.error("! Missing <file.ts> — the file that declares your props type.");
  else console.error("! Missing <TypeName> — at least one type name to extract.");
  console.error(HELP);
  process.exit(1);
}
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Project — use your tsconfig if present (needed for MUI + @/ path aliases),
//    otherwise fall back to sane defaults so it still runs.
// ---------------------------------------------------------------------------
const project = fs.existsSync(tsConfigPath)
  ? new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true })
  : (console.warn(`! No ${tsConfigPath} found — MUI/path-alias types may not fully resolve.`),
     new Project({
       compilerOptions: {
         jsx: ts.JsxEmit.ReactJSX,
         moduleResolution: ts.ModuleResolutionKind.Bundler,
         esModuleInterop: true,
         skipLibCheck: true,
         target: ts.ScriptTarget.ESNext,
       },
     }));

const sf = project.addSourceFileAtPath(filePath);
const checker = project.getTypeChecker().compilerObject;

// ---------------------------------------------------------------------------
// 3. Recursive describer
// ---------------------------------------------------------------------------
const OPAQUE = new Set([
  "ReactNode", "ReactElement", "ReactPortal", "Element", "JSX.Element",
  "CSSProperties", "SxProps", "SystemStyleObject", "Theme",
  "Ref", "RefObject", "MutableRefObject", "ForwardedRef",
  "SyntheticEvent", "ChangeEvent", "FocusEvent", "MouseEvent",
  "KeyboardEvent", "PointerEvent", "EventTarget", "FormEvent",
]);
for (const n of ignoreList) OPAQUE.add(n);

// "SxProps<Theme>" -> "SxProps", "CSSObject[]" -> "CSSObject"
function topLevelName(text: string): string {
  return text.replace(/<[\s\S]*$/, "").replace(/\[\]$/, "").trim();
}

type Desc =
  | { kind: "primitive"; text: string }
  | { kind: "leaf"; text: string }
  | { kind: "literalUnion"; values: string[] }
  | { kind: "union"; members: Desc[] }
  | { kind: "object"; props: Record<string, Desc> }
  | { kind: "callback"; params: { name: string; type: Desc }[]; returns: Desc }
  | { kind: "array"; element: Desc };

function describe(type: Type, node: Node, depth = 0, seen = new WeakSet<object>()): Desc {
  const name = type.getSymbol()?.getName() ?? type.getAliasSymbol()?.getName();
  if (name && OPAQUE.has(name)) return { kind: "leaf", text: name };
  if (depth > maxDepth) return { kind: "leaf", text: type.getText() };

  const ct = type.compilerType as unknown as object;
  if (seen.has(ct)) return { kind: "leaf", text: type.getText() };
  seen.add(ct);

  if (type.isUnion()) {
    const real = type.getUnionTypes().filter(m => !m.isUndefined() && !m.isNull());
    if (real.length === 2 && real.every(m => m.isBooleanLiteral()))
      return { kind: "primitive", text: "boolean" };
    if (real.length && real.every(m => m.isStringLiteral() || m.isNumberLiteral()))
      return { kind: "literalUnion", values: real.map(m => m.getText()) };
    return { kind: "union", members: real.map(m => describe(m, node, depth + 1, seen)) };
  }

  const sigs = type.getCallSignatures();
  if (sigs.length) {
    const sig = sigs[0];
    return {
      kind: "callback",
      params: sig.getParameters().map(p => ({
        name: p.getName(),
        type: describe(p.getTypeAtLocation(node), node, depth + 1, seen),
      })),
      returns: describe(sig.getReturnType(), node, depth + 1, seen),
    };
  }

  if (type.isArray())
    return { kind: "array", element: describe(type.getArrayElementType()!, node, depth + 1, seen) };

  if (
    type.isStringLiteral() || type.isNumberLiteral() || type.isBooleanLiteral() ||
    type.isString() || type.isNumber() || type.isBoolean() || type.isLiteral()
  ) return { kind: "primitive", text: type.getText() };

  if (type.isObject() && type.getProperties().length) {
    const props: Record<string, Desc> = {};
    for (const p of type.getProperties())
      props[p.getName()] = describe(p.getTypeAtLocation(node), node, depth + 1, seen);
    return { kind: "object", props };
  }

  return { kind: "primitive", text: type.getText() };
}

function render(d: Desc): string {
  switch (d.kind) {
    case "primitive":
    case "leaf":         return d.text;
    case "literalUnion": return d.values.join(" | ");
    case "union":        return d.members.map(render).join(" | ");
    case "array":        return `${render(d.element)}[]`;
    case "object":       return `{ ${Object.entries(d.props).map(([k, v]) => `${k}: ${render(v)}`).join("; ")} }`;
    case "callback":     return `(${d.params.map(p => `${p.name}: ${render(p.type)}`).join(", ")}) => ${render(d.returns)}`;
  }
}

// ---------------------------------------------------------------------------
// 4. Walk each named type
// ---------------------------------------------------------------------------
function getNamedType(name: string) {
  const iface = sf.getInterface(name);
  if (iface) return { type: iface.getType(), node: iface as Node };
  const alias = sf.getTypeAlias(name);
  if (alias) return { type: alias.getType(), node: alias as Node };
  return undefined;
}

// Where was this prop physically declared? That decides if it's yours, a real
// MUI API prop, or inherited DOM/aria noise from @types/react.
function classify(sym: import("ts-morph").Symbol): "own" | "mui" | "dom" {
  const paths = sym.getDeclarations().map(d =>
    d.getSourceFile().getFilePath().replace(/\\/g, "/"));   // normalize Windows paths
  if (paths.some(p => !p.includes("/node_modules/"))) return "own";  // your code wins
  if (paths.some(p => /\/node_modules\/@mui\//.test(p)))  return "mui";  // documented MUI prop
  return "dom";  // @types/react (aria-*, events, HTMLAttributes), emotion, etc.
}

const result: Record<string, any[]> = {};

for (const typeName of typeNames) {
  const found = getNamedType(typeName);
  if (!found) {
    const available = [...sf.getInterfaces(), ...sf.getTypeAliases()].map(d => d.getName());
    console.error(`x "${typeName}" not found in ${filePath}.`);
    console.error(`  Types declared here: ${available.length ? available.join(", ") : "(none)"}`);
    continue;
  }
  const { type, node } = found;

  const rows = type.getProperties().map(sym => {
    const t = sym.getTypeAtLocation(node);
    const provenance = classify(sym);
    const doc = sym.compilerSymbol.getDocumentationComment(checker).map(c => c.text).join(" ").trim();
    const defaultTag = sym.compilerSymbol.getJsDocTags(checker).find(tag => tag.name === "default");

    // What the author actually wrote, e.g. "SxProps<Theme>" — survives even when
    // the resolved type has lost the alias and exploded into a giant union.
    const decl = sym.getDeclarations()[0] as any;
    const written: string | undefined = decl?.getTypeNode?.()?.getText();
    const writtenName = written ? topLevelName(written) : undefined;

    let desc: Desc;
    if (writtenName && OPAQUE.has(writtenName)) {
      desc = { kind: "leaf", text: written! };          // keep it abstract: show "SxProps<Theme>"
    } else {
      desc = describe(t, node);
      if (render(desc).length > maxLen) {               // safety net for anything too large
        desc = { kind: "leaf", text: written ?? t.getAliasSymbol()?.getName() ?? "<complex>" };
      }
    }

    return {
      prop: sym.getName(),
      required: !sym.isOptional(),
      provenance,                       // "own" | "mui" | "dom"
      variants: desc.kind === "literalUnion" ? desc.values : [],
      type: render(desc),
      default: defaultTag?.text?.map(p => p.text).join("") ?? "",
      description: doc,
      ...(keepTree ? { _tree: desc } : {}),
    };
  }).filter(r => {
    if (includeDom) return true;                 // keep everything
    if (ownOnly)    return r.provenance === "own"; // only yours
    return r.provenance !== "dom";               // default: yours + documented MUI, drop DOM/aria
  });

  result[typeName] = rows;

  console.log(`\n=== ${typeName} (${rows.length} props) ===`);
  console.table(rows.map(({ _tree, type, variants, ...r }) => ({
    ...r,
    variants: variants.length ? variants.join(" | ") : "",
    type: type.length > 70 ? type.slice(0, 67) + "..." : type,
  })));
}

if (outFile) {
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\n-> wrote ${outFile}`);
}