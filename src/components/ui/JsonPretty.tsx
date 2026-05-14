"use client";

interface JsonPrettyProps {
  value: unknown;
  className?: string;
}

export function JsonPretty({ value, className }: JsonPrettyProps) {
  const text = JSON.stringify(value, null, 2);
  // very simple syntax tinting
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"(\s*:)/g, '<span class="k">"$1"</span>$2')
    .replace(/: "([^"\\]*(?:\\.[^"\\]*)*)"/g, ': <span class="s">"$1"</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="b">$1</span>')
    .replace(/(?<=[:\s,\[])(-?\d+(?:\.\d+)?)/g, '<span class="n">$1</span>');
  return <pre className={`json ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
