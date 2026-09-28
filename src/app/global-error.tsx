'use client';

import { THEME_SCRIPT } from '@/components/local/theme';

/**
 * Last-resort error page: replaces the root layout, so it carries its own
 * document, tokens and system font stacks and never waits for web fonts.
 */
const CSS = `
:root{--paper:#fff;--ink:#000;--ink-2:#404040;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#000;--ink:#fff;--ink-2:#C7C7C7;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#000;--ink:#fff;--ink-2:#C7C7C7;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:600px;margin:0 auto;padding:64px 20px 96px}
@media (min-width:768px){main{padding-top:128px}}
.w{font:900 56px/1.04 "Bodoni 72",Didot,Georgia,serif;letter-spacing:-.02em;margin:0}
@media (min-width:768px){.w{font-size:96px}}
h1{font:900 40px/1.05 "Bodoni 72",Didot,Georgia,serif;letter-spacing:-.02em;margin:40px 0 0}
p.l{margin:12px 0 0;color:var(--ink-2)}
button{margin-top:32px;min-height:48px;padding:0 24px;border-radius:999px;border:1.5px solid var(--ink);background:var(--ink);color:var(--paper);font:700 17px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
button:focus-visible{outline:3px solid var(--ink);outline-offset:3px}
`;

export default function GlobalError({ reset, retry }: { error: Error & { digest?: string }; reset: () => void; retry?: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>This page didn’t load – Wiege</title>
        <meta name="robots" content="noindex" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main>
          <p className="w" aria-hidden="true">
            hiccup
          </p>
          <h1>This page didn’t load.</h1>
          <p className="l">Check your connection, then try again.</p>
          <button type="button" onClick={() => (retry ?? reset)()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
