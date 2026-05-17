const HTML_ESCAPE_TABLE: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_TABLE[ch]!);
}

/**
 * Convert a prompt string into HTML safe for `innerHTML`, expanding two
 * superscript / subscript escape patterns that Unicode glyphs don't cover:
 *
 *   `^{N}` → `<sup>N</sup>`
 *   `_{N}` → `<sub>N</sub>`
 *
 * Where `N` is one or more characters that aren't `}`. Permissive enough
 * for `x^{11}`, `x_{n+1}`, `e^{-x}`, summation bounds like `Σ_{i=0}^{n}`,
 * and indexed entries like `a_{i,j}`.
 *
 * The escape pass runs first so `<`, `>`, `&`, and quote characters in the
 * input render literally instead of as HTML. Any HTML special characters
 * that end up inside `^{...}` / `_{...}` after escaping (e.g. an attempted
 * `^{<script>}` payload becomes `^{&lt;script&gt;}` first) are wrapped
 * verbatim as escaped entities inside the `<sup>` / `<sub>` element — safe
 * to insert via `innerHTML`. Plain prompts with only Unicode glyphs (², ³,
 * π, √, ½, °) pass through unchanged.
 *
 * Forward-looking — the current B / M / A pool uses Unicode glyphs only.
 * Lives here so prompts that need rich super/subscript can adopt the
 * helper without touching the modal renderer again.
 */
export function mathText(input: string): string {
  const escaped = escapeHtml(input);
  return escaped
    .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
    .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
}
