import type { Comment, CreateRule, ESTree, SourceCode } from "@oxlint/plugins";
import {
  columns,
  defaultOptions,
  isProtected,
  reflowBlockComment,
  reflowLineComments,
  type ReflowOptions,
} from "./core.js";

const containers = new Set([
  "Program",
  "BlockStatement",
  "StaticBlock",
  "SwitchCase",
  "TSModuleBlock",
  "ClassBody",
  "TSInterfaceBody",
  "TSTypeLiteral",
  "ObjectExpression",
  "TSEnumBody",
  "JSXOpeningElement",
  "JSXEmptyExpression",
]);
const statements = new Set([
  "VariableDeclaration",
  "ExpressionStatement",
  "ReturnStatement",
  "ThrowStatement",
  "BreakStatement",
  "ContinueStatement",
  "DebuggerStatement",
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "ExportAllDeclaration",
  "TSTypeAliasDeclaration",
  "TSImportEqualsDeclaration",
  "TSExportAssignment",
]);
const members = new Set([
  "Property",
  "PropertyDefinition",
  "AccessorProperty",
  "TSAbstractPropertyDefinition",
  "TSPropertySignature",
  "TSMethodSignature",
  "TSIndexSignature",
  "TSEnumMember",
]);

function lineStart(text: string, offset: number) {
  return text.lastIndexOf("\n", offset - 1) + 1;
}

function lineEnd(text: string, offset: number) {
  const end = text.indexOf("\n", offset);
  return end === -1 ? text.length : end;
}

function eligibleNode(node: ESTree.Node) {
  const parent = node.parent;
  if (!parent || node.loc.start.line !== node.loc.end.line) return false;
  if (statements.has(node.type)) {
    return [
      "Program",
      "BlockStatement",
      "StaticBlock",
      "SwitchCase",
      "TSModuleBlock",
    ].includes(parent.type);
  }
  return members.has(node.type) && containers.has(parent.type);
}

function standalone(source: SourceCode, comment: Comment) {
  const prefix = source.text.slice(
    lineStart(source.text, comment.range[0]),
    comment.range[0],
  );
  const suffix = source.text.slice(
    comment.range[1],
    lineEnd(source.text, comment.range[1]),
  );
  if (!/^[\t ]*$/.test(prefix) || !/^[\t \r]*$/.test(suffix)) return false;
  const container = source.getNodeByRangeIndex(comment.range[0]);
  return !container || containers.has(container.type);
}

function protectedComment(source: SourceCode, comment: Comment) {
  const raw = source.text.slice(...comment.range);
  return (
    isProtected(comment.value) ||
    raw.startsWith("/*!") ||
    raw.startsWith("///") ||
    (comment.type === "Line" && /^\s*@/.test(comment.value))
  );
}

export const reflowRule: CreateRule = {
  meta: {
    type: "layout",
    docs: {
      description:
        "Wrap comment prose and move eligible trailing comments above their target.",
      url: "https://github.com/diegohaz/oxlint-plugin-comment-reflow#rule-options",
      recommended: true,
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          printWidth: { type: "integer", minimum: 1 },
          trailingComments: { enum: ["ignore", "always", "overflow"] },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [defaultOptions],
    messages: {
      reflow: "Reflow comment prose to a target width of {{width}} columns.",
      move: "Move this trailing comment above its target and reflow its prose.",
      missingBlockPrefix: "Comment line is missing its `*` prefix.",
    },
  },
  create(context) {
    const source = context.sourceCode;
    const text = source.text;
    const options = {
      ...defaultOptions,
      ...(context.options[0] as ReflowOptions),
    };
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const candidates = new Map<number, ESTree.Node[]>();

    return {
      "*"(node) {
        if (!eligibleNode(node)) return;
        const line = node.loc.end.line;
        const nodes = candidates.get(line) ?? [];
        nodes.push(node);
        candidates.set(line, nodes);
      },
      "Program:exit"() {
        const comments = source.getAllComments();
        const protectedComments = new Set(
          comments.filter((comment) => protectedComment(source, comment)),
        );
        for (let start = 0; start < comments.length; start++) {
          if (comments[start]!.type !== "Line") continue;
          let end = start + 1;
          while (
            end < comments.length &&
            comments[end]!.type === "Line" &&
            /^\r?\n[\t ]*$/.test(
              text.slice(comments[end - 1]!.range[1], comments[end]!.range[0]),
            )
          )
            end++;
          const group = comments.slice(start, end);
          if (group.some((comment) => protectedComments.has(comment))) {
            for (const comment of group) protectedComments.add(comment);
          }
          start = end - 1;
        }
        const edits: {
          comment: Comment;
          range: [number, number];
          replacement: string;
          messageId: string;
        }[] = [];
        for (let i = 0; i < comments.length; i++) {
          const comment = comments[i]!;
          if (protectedComments.has(comment)) continue;
          const start = lineStart(text, comment.range[0]);
          let range: [number, number] = [comment.range[0], comment.range[1]];
          let replacement: string;
          let messageId = "reflow";
          const container = source.getNodeByRangeIndex(comment.range[0]);
          const jsxBlock =
            comment.type === "Block" &&
            container?.type === "JSXEmptyExpression";
          // Inline JSX blocks share the braces' indentation. A preceding
          // block's closing marker must not add indentation on the next fix.
          const indentStart =
            jsxBlock && /[^\t ]/.test(text.slice(start, comment.range[0]))
              ? lineStart(text, container.parent.range[0])
              : start;
          const indent = /^[\t ]*/.exec(text.slice(indentStart))![0];
          if (standalone(source, comment) || jsxBlock) {
            if (comment.type === "Line") {
              const group = [comment];
              while (i + 1 < comments.length) {
                const next = comments[i + 1]!;
                const previous = group.at(-1)!;
                if (
                  next.type !== "Line" ||
                  protectedComment(source, next) ||
                  next.loc.start.line !== previous.loc.end.line + 1 ||
                  text.slice(previous.range[1], next.range[0]) !==
                    eol + indent ||
                  !standalone(source, next)
                )
                  break;
                group.push(next);
                i++;
              }
              // Do not reflow the prose portion of a multi-line legal header.
              if (group.some((item) => isProtected(item.value))) continue;
              range[1] = group.at(-1)!.range[1];
              replacement = reflowLineComments(
                group.map((item) => item.value),
                indent,
                options.printWidth,
                eol,
              );
            } else {
              const raw = text.slice(...range);
              const lines = raw.split(/\r\n|\n/);
              const firstPrefix = /^([\t ]*)\*(?: |$)/.exec(lines[1] ?? "");
              // An aligned first star distinguishes a broken starred block
              // from plain prose that contains Markdown bullets.
              if (
                /^\/\*\*?[\t ]*$/.test(lines[0]!) &&
                /^[\t ]*\*\/$/.test(lines.at(-1)!) &&
                firstPrefix &&
                columns(firstPrefix[1]!) === columns(indent) + 1
              ) {
                for (let line = 2; line < lines.length - 1; line++) {
                  const content = lines[line]!;
                  if (!content.trim() || /^\s*\*/.test(content)) continue;
                  context.report({
                    loc: {
                      start: { line: comment.loc.start.line + line, column: 0 },
                      end: {
                        line: comment.loc.start.line + line,
                        column: content.length,
                      },
                    },
                    messageId: "missingBlockPrefix",
                  });
                }
              }
              replacement = reflowBlockComment(
                raw,
                indent,
                options.printWidth,
                eol,
                jsxBlock
                  ? columns(
                      text
                        .slice(start, lineEnd(text, comment.range[1]))
                        .replace(/\r$/, ""),
                    )
                  : undefined,
              );
            }
          } else {
            if (options.trailingComments === "ignore") continue;
            if (comment.loc.start.line !== comment.loc.end.line) continue;
            if (
              comment.type === "Block" &&
              (text.slice(...range).startsWith("/**") ||
                comment.value.includes("@"))
            )
              continue;
            const end = lineEnd(text, comment.range[1]);
            if (!/^[\t \r]*$/.test(text.slice(comment.range[1], end))) continue;
            if (
              options.trailingComments === "overflow" &&
              columns(text.slice(start, end).replace(/\r$/, "")) <=
                options.printWidth
            )
              continue;
            const target = candidates
              .get(comment.loc.start.line)
              ?.find((node) => {
                if (node.range[1] > comment.range[0]) return false;
                return (
                  /^[\t ]*$/.test(text.slice(start, node.range[0])) &&
                  /^[\t ]*[,;]?[\t ]*$/.test(
                    text.slice(node.range[1], comment.range[0]),
                  )
                );
              });
            if (!target) continue;
            // Insertion before the target must not detach a next-line pragma.
            const preceding = comments[i - 1];
            if (
              preceding &&
              /^\s*$/.test(text.slice(preceding.range[1], target.range[0])) &&
              protectedComment(source, preceding)
            )
              continue;
            const codeEnd =
              comment.range[0] -
              /[\t ]*$/.exec(text.slice(start, comment.range[0]))![0].length;
            const formatted =
              comment.type === "Line"
                ? reflowLineComments(
                    [comment.value],
                    indent,
                    options.printWidth,
                    eol,
                  )
                : reflowBlockComment(
                    text.slice(...range),
                    indent,
                    options.printWidth,
                    eol,
                  );
            range = [start, comment.range[1]];
            const separator =
              preceding?.type === "Line" &&
              preceding.loc.end.line === target.loc.start.line - 1 &&
              standalone(source, preceding)
                ? indent + "//" + eol
                : "";
            replacement =
              separator + indent + formatted + eol + text.slice(start, codeEnd);
            messageId = "move";
          }
          const previousEdit = edits.at(-1);
          if (
            (previousEdit && range[0] < previousEdit.range[1]) ||
            replacement === text.slice(...range)
          )
            continue;
          // Oxlint treats touching fix ranges as conflicts. Combine them so
          // adjacent block comments are fixed in the same pass.
          if (previousEdit && range[0] === previousEdit.range[1]) {
            previousEdit.range[1] = range[1];
            previousEdit.replacement += replacement;
          } else {
            edits.push({ comment, range, replacement, messageId });
          }
        }
        for (const { comment, range, replacement, messageId } of edits) {
          context.report({
            loc: comment.loc,
            messageId,
            data: { width: String(options.printWidth) },
            fix: (fixer) => fixer.replaceTextRange(range, replacement),
          });
        }
      },
    };
  },
};
