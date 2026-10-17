import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
function rawText(source: string, file: string) {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const errors: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(ast);
      if (tag !== "Text")
        for (const child of node.children) {
          if (
            (ts.isJsxText(child) && child.text.trim()) ||
            (ts.isJsxExpression(child) &&
              child.expression &&
              (ts.isStringLiteral(child.expression) ||
                ts.isNumericLiteral(child.expression)))
          ) {
            errors.push(
              `${file}:${ast.getLineAndCharacterOfPosition(child.getStart(ast)).line + 1}: literal text inside <${tag}>`,
            );
          }
        }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return errors;
}
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : entry.name.endsWith(".tsx")
        ? [join(directory, entry.name)]
        : [],
  );
}
describe("native text rendering", () => {
  it("detects explicit whitespace outside Text, while allowing text spacing", () => {
    expect(
      rawText('<View><Text>Recipe</Text>{" "}</View>', "PostCard.tsx"),
    ).toHaveLength(1);
    expect(
      rawText('<View><Text>Recipe{" "}details</Text></View>', "PostCard.tsx"),
    ).toEqual([]);
  });
  it("keeps string and numeric JSX literals inside Text across app screens/components", () => {
    const failures = files(resolve("src")).flatMap((file) =>
      rawText(readFileSync(file, "utf8"), file),
    );
    expect(failures).toEqual([]);
  });
});
