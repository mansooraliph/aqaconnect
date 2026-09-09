/** Shared inline styling for the public legal/account pages — kept self-contained (no external CSS) since these must render standalone for app-store review. */
export const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
    line-height: 1.6;
    color: #1a1a1a;
    background: #fff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e6e6e6; background: #121212; }
    a { color: #7ab8ff; }
    input { background: #1e1e1e; color: #e6e6e6; border-color: #444 !important; }
  }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; }
  .meta { color: #767676; font-size: 0.875rem; margin-bottom: 2rem; }
  ul { padding-left: 1.25rem; }
  a { color: #0a58ca; }
`;

export function pageShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — AqaConnect</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
