"use client";

import { Highlight, themes } from "prism-react-renderer";

export default function DiffSnippet({ code, language }: { code: string; language?: string }) {
  const lang = language || inferLanguage(code);

  return (
    <Highlight theme={themes.nightOwl} code={code.trim()} language={lang}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className="rounded-md p-3 text-xs overflow-x-auto"
          style={{ ...style, margin: 0 }}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

function inferLanguage(code: string): string {
  if (code.includes("diff --git") || code.startsWith("@@") || code.startsWith("+") || code.startsWith("-")) {
    return "diff";
  }
  if (code.includes("import ") || code.includes("export ") || code.includes("const ") || code.includes("function ")) {
    return "typescript";
  }
  if (code.includes("class ") && code.includes("{")) {
    return "csharp";
  }
  return "typescript";
}
