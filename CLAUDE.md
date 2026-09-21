# mai-image-compare project rules

## Status
Pre-release. Ship the final form: no back-compat shims, no migration code, no
legacy-value handling. Delete dead/compat code when you find it.

## Shape
One block, `mai-image-compare/compare`. No admin menu, no settings page, no CPT,
no options, no admin notices, no telemetry, no runtime HTTP. If a change adds any
of those, it is the wrong change.

## The inherit invariant (load-bearing)
`value`, `hover` and `dragAnywhere` have NO `default` in block.json, on purpose.

- Undefined means "follow the site default", resolved at render from
  `mai_image_compare_defaults`.
- Declaring a default would make "untouched" indistinguishable from "set to the
  same value as the default", and a later filter change would stop reaching
  saved blocks.
- `hover: false` on a block is a real choice and must beat a filter setting it
  true. Never coerce an unset attribute to `false` anywhere in the chain.
- `dragAnywhere` is the INVERSE of the component's `handle` attribute, and
  defaults to true. The flip happens once, in Blocks::render() and in the
  editor's property effect. Do not let the component's vocabulary leak any
  further in than that.
- The block is server-rendered for the same reason. Never give it a `save()`.

Any change here needs the Playwright filter phase re-run (it writes an mu-plugin,
checks the three interactions, removes it again).

## Component gotchas (verified against img-comparison-slider 8.0.7 dist)
- `observedAttributes` is only `["hover", "direction"]`. `value` and `handle` are
  read once in the constructor/connectedCallback, so the editor pushes those two
  as properties, not attributes.
- Every boolean setter is `"false" !== String(v)`. An empty attribute means TRUE.
  Always emit `hover="true|false"` and `handle="true|false"` explicitly.
- Key map is ArrowLeft and ArrowRight only. No Home, no End, no up/down. Our
  view script adds them.
- It renders NO ARIA at all, only `tabindex`. Our view script adds the slider
  role and values.
- Its `styles.css` carries `[slot='second'] { display: unset }`, which resets a
  div to `inline`. Our CSS needs a matching-specificity selector to win, hence
  the type and attribute selectors in front.css. They are not decoration.
- `keyboard` stays enabled. Never expose a way to turn it off.

## Editor gotchas
- The post canvas is an iframe with its own custom element registry. The
  component must be enqueued INTO it (`enqueue_block_assets`, guarded by
  `is_admin()`), or the preview renders two stacked images that never upgrade.
- React writes `className` onto a custom element as the literal attribute
  `classname`. The block's props go on a wrapping div in the editor, never on
  `<img-comparison-slider>`.
- CSS is written so the block box can be either element: the box by class,
  everything inside it by the `img-comparison-slider` type selector.

## Shadow DOM and the aspect ratio
The images are slotted into shadow DOM and cannot see the `aspect-ratio`
WordPress writes on the wrapper. `aspect-ratio: inherit` does not help either,
because a slotted element inherits through the flattened tree and would read the
component's own wrapper. The ratio therefore travels as
`--mai-image-compare-ratio`, which PHP sets from the chosen ratio when there is
one and from the first image's metadata otherwise.

## Testing
No PHPUnit suite yet. Verification is a headless Playwright run against
~/Herd/sportsdataio covering the front end (drag, touch, keyboard, both
directions, the filter interactions, mismatched sizes, conditional assets, CLS)
and the editor (insert, media modal, preview upgrade, inspector, saved content).

Never run a headed browser. Headless only, no `bringToFront`, no focus stealing.
