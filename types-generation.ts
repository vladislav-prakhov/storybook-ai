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
// 1. Args: positionals = [file, ...typeNames]; flags = --out --own --tsconfig --depth
// ---------------------------------------------------------------------------
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
const filePath = (flags.file as string) ?? positionals[0];
const typeNames = (flags.types ? [String(flags.types)] : positionals.slice(1))
  .flatMap(s => s.split(","))            // accept "A,B" or "A B"
  .map(s => s.trim())
  .filter(Boolean);
const tsConfigPath = (flags.tsconfig as string) ?? "tsconfig.json";
const ownOnly = Boolean(flags.own);              // keep ONLY your own props
const includeDom = Boolean(flags["include-dom"]); // keep aria-/DOM/event props too
const keepTree = Boolean(flags.tree);            // include the verbose nested _tree
const maxLen = Number(flags.maxlen ?? 200);      // collapse any prop whose rendered type exceeds this
const ignoreList = (flags.ignore ? String(flags.ignore).split(",") : [])
  .map(s => s.trim()).filter(Boolean);           // extra type names to keep abstract, e.g. --ignore Theme,CSSObject
const outFile = flags.out as string | undefined;
const maxDepth = Number(flags.depth ?? 6);

if (!filePath || typeNames.length === 0) {
  console.error("Usage: npm run props -- <file.ts> <TypeName> [MoreTypes...] [--own] [--include-dom] [--tree] [--ignore A,B] [--maxlen 200] [--out props.json] [--depth 6]");
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