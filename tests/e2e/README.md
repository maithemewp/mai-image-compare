# End-to-end checks

Headless Playwright, run against a local WordPress with the plugin active.

These are not a CI suite. They are the verification that the block behaves on a
real site: drag, touch, keyboard, both directions, the defaults filter and how a
block's own values interact with it, mismatched image sizes, conditional asset
loading, layout shift, and the editor from insertion through to saved content.

## Before running

The runs expect a local site at `https://sportsdataio.test` with:

- This plugin active.
- Three images in the Media Library titled `MIC before` (1200x800),
  `MIC after` (1200x800) and `MIC tall` (800x1200).
- Published pages at `mic-default`, `mic-loaded`, `mic-mismatch`, `mic-ratio`,
  `mic-handleonly`, and `mic-none` (a page with no block on it).
- An administrator called `mictest`.

Both runs write and remove their own mu-plugin to exercise the defaults filter,
so the site is left as it was found.

## Run

1. Install Playwright.
   ```
   npm install -D playwright && npx playwright install chromium
   ```
2. Run the front-end checks.
   ```
   node tests/e2e/frontend.mjs
   ```
3. Run the editor checks.
   ```
   node tests/e2e/editor.mjs
   ```

Headless only. Never switch these to a headed browser.
