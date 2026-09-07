/** Options for the comment-reflow/reflow rule. */
export interface ReflowOptions {
  /** Target width, including indentation and comment markers. Default: 80. */
  printWidth?: number;
  /** Placement of eligible trailing comments. Default: "overflow". */
  trailingComments?: "ignore" | "always" | "overflow";
}

export const defaultOptions: Required<ReflowOptions> = {
  printWidth: 80,
  trailingComments: "overflow",
};

/** Count Unicode code points; tabs advance to the next four-column stop. */
export function columns(text: string): number {
  let width = 0;
  for (const character of text) {
    width += character === "\t" ? 4 - (width % 4) : 1;
  }
  return width;
}

/** Comments with tool directives or legal text must remain byte-for-byte intact. */
export function isProtected(text: string): boolean {
  return /(?:eslint|oxlint|biome|prettier|oxfmt|stylelint|jshint|jslint|istanbul|c8|v8|vitest|webpack|vite|rollup|parcel|coverage|tslint|deno-lint)[-\s:]|@(?:ts-|jsx|flow\b|noflow\b|license\b|preserve\b|copyright\b|cc_on\b)|[#@]__[A-Z_]+__|[#@]\s*source(?:Mapping)?URL\s*=|\b(?:copyright|SPDX-License-Identifier|@license)\b|^\s*(?:global[s]?\s|exported\s|<reference\s|<amd-|!|:|#?region\b|#?endregion\b|language\s*=)/im.test(
    text,
  );
}

// Read balanced inline constructs without changing their internal whitespace.
function balancedEnd(
  text: string,
  start: number,
  open: string,
  close: string,
  quoteStrings = false,
) {
  let depth = 0;
  let quote = "";
  for (let i = start; i < text.length; i++) {
    const character = text[i];
    if (character === "\\") {
      i++;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (
      quoteStrings &&
      (character === '"' || character === "'" || character === "`")
    ) {
      quote = character;
      continue;
    }
    if (character === open) depth++;
    if (character === close && --depth === 0) return i + 1;
  }
  return undefined;
}

function words(text: string): string[] | undefined {
  const result: string[] = [];
  let word = "";
  for (let i = 0; i < text.length;) {
    const character = text[i]!;
    if (/\s/.test(character)) {
      if (word) result.push(word);
      word = "";
      i++;
      continue;
    }
    let end: number | undefined;
    if (character === "`") {
      const delimiter = /^`+/.exec(text.slice(i))![0];
      const close = text.indexOf(delimiter, i + delimiter.length);
      if (close < 0) return undefined;
      end = close + delimiter.length;
    } else if (text.startsWith("{@", i)) {
      end = balancedEnd(text, i, "{", "}");
      if (!end) return undefined;
    } else if (character === "[") {
      end = balancedEnd(text, i, "[", "]");
      if (!end) return undefined;
      if (text[end] === "(" || text[end] === "[") {
        end = balancedEnd(text, end, text[end]!, text[end] === "(" ? ")" : "]");
        if (!end) return undefined;
      }
    }
    if (end) {
      word += text.slice(i, end);
      i = end;
    } else {
      word += character;
      i++;
    }
  }
  if (word) result.push(word);
  return result;
}

function wrap(text: string, width: number, first = "", continuation = "") {
  const tokens = words(text);
  if (!tokens) return undefined;
  const result: string[] = [];
  let line = first;
  let hasWord = false;
  for (const token of tokens) {
    const space = hasWord ? " " : "";
    // A wrap must not create a new JSDoc tag, list item, or Markdown heading.
    const structural = /^(?:@|[-+*>]$|#{1,6}$|\d+[.)]$|`{3}|~{3})/.test(token);
    if (hasWord && !structural && columns(line + space + token) > width) {
      result.push(line);
      line = continuation + token;
    } else {
      line += space + token;
    }
    hasWord = true;
  }
  result.push(line.trimEnd());
  return result;
}

function tagParts(
  line: string,
): { prefix: string; description: string } | undefined {
  const match =
    /^@(param|arg|argument|property|prop|returns?|throws?|exception|description|desc|summary|remarks|deprecated)\b\s*/.exec(
      line,
    );
  if (!match) return undefined;
  let end = match[0].length;
  if (line[end] === "{") {
    const typeEnd = balancedEnd(line, end, "{", "}", true);
    if (!typeEnd) return undefined;
    end = typeEnd;
    while (line[end] === " " || line[end] === "\t") end++;
  }
  if (/^(param|arg|argument|property|prop)$/.test(match[1]!)) {
    if (line[end] === "[") {
      const nameEnd = balancedEnd(line, end, "[", "]", true);
      if (!nameEnd) return undefined;
      end = nameEnd;
    } else {
      const name = /^[\w.$]+/.exec(line.slice(end));
      if (!name) return undefined;
      end += name[0].length;
    }
    while (line[end] === " " || line[end] === "\t") end++;
  }
  if (line.slice(end, end + 2) === "- ") end += 2;
  const prefix = line.slice(0, end);
  return {
    prefix: /\s$/.test(prefix) ? prefix : prefix + " ",
    description: line.slice(end),
  };
}

function isStructure(line: string) {
  return (
    /^\s*https?:\/\/\S+\s*$/i.test(line) ||
    /^(?:\s{4}|\t|\s*[*+-]\s|\s*\d+[.)]\s|\s*[#>|]|\s*\[[^\]]+\]:|\s*(?:---+|===+)\s*$|\s*<|\s*`{3}|\s*~{3}|\s*@)/.test(
      line,
    ) ||
    /(?: {2}|\\)$/.test(line) ||
    /^\s*(?:const |let |var |function |class |import |export |return |if\s*\(|\/\/|\{|\})/.test(
      line,
    ) ||
    /^[^{}[\]`]*\s\|\s|;$|^[\w.$]+\(.*\)[;]?$|^[\w.$]+\s*=\s*\S/.test(line)
  );
}

/** Reflow comment contents, with markers already removed by the caller. */
export function reflowText(
  lines: readonly string[],
  width: number,
  jsdoc = false,
): string[] {
  const output: string[] = [];
  let fence: { marker: string; length: number } | undefined;
  let opaqueTag = false;
  for (let i = 0; i < lines.length;) {
    const line = lines[i]!;
    const fenceMatch = /^\s*(?:(?:[-+*]|\d+[.)])\s+)?(`{3,}|~{3,})/.exec(line);
    if (fence) {
      output.push(line);
      if (
        fenceMatch &&
        fenceMatch[1]![0] === fence.marker &&
        fenceMatch[1]!.length >= fence.length &&
        line.trim() === fenceMatch[1]
      )
        fence = undefined;
      i++;
      continue;
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1]![0]!, length: fenceMatch[1]!.length };
      output.push(line);
      i++;
      continue;
    }
    if (jsdoc && /^@\S/.test(line)) {
      const parts = tagParts(line);
      opaqueTag = !parts;
      if (parts) {
        let end = i + 1;
        while (
          end < lines.length &&
          lines[end]!.trim() &&
          !lines[end]!.startsWith("@") &&
          !isStructure(lines[end]!)
        )
          end++;
        const text = [
          parts.description,
          ...lines.slice(i + 1, end).map((value) => value.trim()),
        ].join(" ");
        const completeMarkup = [
          parts.description,
          ...lines.slice(i + 1, end),
        ].every((value) => words(value) !== undefined);
        output.push(
          ...((completeMarkup
            ? wrap(text, width, parts.prefix, "  ")
            : undefined) ?? lines.slice(i, end)),
        );
        i = end;
        continue;
      }
    }
    if (opaqueTag || !line.trim()) {
      output.push(line);
      i++;
      continue;
    }
    const list = /^( {0,3}(?:[-+*]|\d+[.)])\s+)(.*)/.exec(line);
    if (list && !/(?: {2}|\\)$/.test(line)) {
      const prefix = list[1]!;
      const continuation = " ".repeat(prefix.length);
      let end = i + 1;
      while (
        end < lines.length &&
        lines[end]!.startsWith(continuation) &&
        lines[end]!.trim() &&
        !isStructure(lines[end]!.slice(continuation.length))
      )
        end++;
      const text = [
        list[2]!,
        ...lines.slice(i + 1, end).map((value) => value.trim()),
      ].join(" ");
      const completeMarkup = [list[2]!, ...lines.slice(i + 1, end)].every(
        (value) => words(value) !== undefined,
      );
      output.push(
        ...((completeMarkup
          ? wrap(text, width, prefix, continuation)
          : undefined) ?? lines.slice(i, end)),
      );
      i = end;
      continue;
    }
    if (isStructure(line)) {
      output.push(line);
      i++;
      continue;
    }
    const indent = /^ */.exec(line)![0];
    let end = i + 1;
    while (
      end < lines.length &&
      lines[end]!.trim() &&
      !isStructure(lines[end]!) &&
      /^ */.exec(lines[end]!)![0] === indent
    )
      end++;
    const text = lines
      .slice(i, end)
      .map((value) => value.trim())
      .join(" ");
    const completeInlineMarkup = lines
      .slice(i, end)
      .every((value) => words(value) !== undefined);
    output.push(
      ...((completeInlineMarkup
        ? wrap(text, width, indent, indent)
        : undefined) ?? lines.slice(i, end)),
    );
    i = end;
  }
  return output;
}

/** Format a group of standalone line comments. The first indent is external. */
export function reflowLineComments(
  values: readonly string[],
  indent: string,
  printWidth: number,
  eol: string,
): string {
  const lines = values.map((value) =>
    value.startsWith(" ") ? value.slice(1) : value,
  );
  return reflowText(lines, printWidth - columns(indent + "// "))
    .map((line) => (line ? `// ${line}` : "//"))
    .join(eol + indent);
}

/** Format an entire block token; preserve code and nonstandard block layouts. */
export function reflowBlockComment(
  raw: string,
  indent: string,
  printWidth: number,
  eol: string,
): string {
  if (isProtected(raw) || raw.startsWith("/*!")) return raw;
  const jsdoc = raw.startsWith("/**");
  const opening = jsdoc ? "/**" : "/*";
  const body = raw.slice(opening.length, -2);
  const original = body.split(/\r\n|\n/);
  let lines: string[];
  let plainPrefix: string | undefined;
  if (original.length === 1) {
    // Expanding single-line metadata or examples can change parser semantics.
    if (body.includes("@") || /`{3}|~{3}/.test(body)) return raw;
    if (columns(indent + raw) <= printWidth) return raw;
    lines = [body.trim()];
  } else {
    if (original[0]!.trim() || original.at(-1)!.trim()) return raw;
    const middle = original.slice(1, -1);
    if (middle.every((line) => /^\s*\*(?: |$)/.test(line))) {
      lines = middle.map((line) => line.replace(/^\s*\* ?/, ""));
    } else {
      if (jsdoc || middle.some((line) => /^\s*\*/.test(line))) return raw;
      const indents = middle
        .filter((line) => line.trim())
        .map((line) => /^[\t ]*/.exec(line)![0]);
      plainPrefix = indents.sort((a, b) => a.length - b.length)[0] ?? indent;
      if (
        !middle.every((line) => !line.trim() || line.startsWith(plainPrefix!))
      )
        return raw;
      lines = middle.map((line) => line.slice(plainPrefix!.length));
    }
  }
  const formatted = reflowText(
    lines,
    printWidth - columns(plainPrefix ?? indent + " * "),
    jsdoc,
  );
  if (
    original.length > 1 &&
    lines.every((line, index) => line === formatted[index]) &&
    lines.length === formatted.length
  )
    return raw;
  if (plainPrefix !== undefined)
    return [
      opening,
      ...formatted.map((line) => (line ? plainPrefix + line : "")),
      indent + " */",
    ].join(eol);
  return [
    opening,
    ...formatted.map((line) => indent + (line ? ` * ${line}` : " *")),
    indent + " */",
  ].join(eol);
}
