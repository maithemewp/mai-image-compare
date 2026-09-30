# State
Updated: 2026-09-30 by Claude

## Now
0.2.0 released: new slotted handle (see-through circle, 2px ring and arrows, 2px divider), themeable through `--mai-image-compare-handle-*` and `--mai-image-compare-divider-*`, plus the `mai_image_compare_handle` filter.

## Next
Muse (client site, not on our hosting) updates through the plugin updater, which reads the version from `main`. Waiting on client feedback about whether people now notice they can drag.

## Blocked / waiting on
Client feedback on the new handle.

## Verify
`node tests/e2e/frontend.mjs` and `node tests/e2e/editor.mjs` against https://sportsdataio.test (see tests/e2e/README.md). Visual check: https://sportsdataio.test/mic-default/

## Gotchas
- The component's divider is one unbroken line inside its shadow DOM. Making it stop at the circle would mean hiding it and drawing our own, relying on internal overflow clipping. Rejected as fragile.
- The handle filter output is not escaped (escaping strips SVG). It is code-only input.
