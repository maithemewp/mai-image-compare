# Mai Image Compare

A before/after image comparison block. Two images, one draggable divider.

One block, no admin menu, no settings page, no database options. Site-wide defaults are set in code through a filter, so they travel with your deploy and show up in a diff.

## Requirements

- WordPress 7.0 or newer
- PHP 8.2 or newer

## Install

Download the plugin and activate it. Updates come from GitHub through the built-in update checker.

Building from a clone:

1. Install the PHP dependencies.
   ```
   composer install
   ```
2. Install the JavaScript dependencies.
   ```
   npm install
   ```
3. Build the assets.
   ```
   npm run build
   ```

## Using the block

Insert **Mai Image Compare**, then pick two images. The block sidebar has a Before field and an After field, each shaped like the post's featured image control: click to open the Media Library, then Replace or Remove.

Before is the image on the left, or on top in vertical mode. After is the other one.

## Block attributes

| Attribute | Type | Default | What it does |
| --- | --- | --- | --- |
| `beforeId` | number | none | Attachment ID for the before image. |
| `afterId` | number | none | Attachment ID for the after image. |
| `beforeAlt` | string | `""` | Alt text for the before image. Empty means use the Media Library's own alt text. |
| `afterAlt` | string | `""` | Alt text for the after image. Empty means use the Media Library's own alt text. |
| `beforeLabel` | string | `""` | Optional caption shown over the before image. Empty means no label. |
| `afterLabel` | string | `""` | Optional caption shown over the after image. Empty means no label. |
| `direction` | string | `horizontal` | `horizontal` or `vertical`. |
| `value` | number | *unset* | Start position, 0 to 100. Unset means follow the site default. |
| `hover` | boolean | *unset* | Slide on mouse over, with no clicking. Unset means follow the site default. |
| `dragAnywhere` | boolean | *unset* | Drag from anywhere in the image, not just the handle. Unset means follow the site default. |

The block also supports wide and full alignment, a custom class name, margin and padding, and WordPress's own aspect ratio control.

### Why three attributes have no default

`value`, `hover` and `dragAnywhere` start out with no value at all, and an untouched control writes nothing into the post. That is what lets a later change to the filter reach blocks that were saved months ago.

Saving a page never pins one of these to a value. Clearing one in the editor, through the Reset or "use site default" affordance, removes it again.

The block is server-rendered for the same reason. A static block bakes its attributes into the post content at save time, so a filter change would never reach anything already published.

## Site-wide defaults

Three settings are set once per site, in code:

```php
add_filter( 'mai_image_compare_defaults', function( array $defaults ): array {
	$defaults['value']        = 25;    // Divider starts at 25%.
	$defaults['hover']        = true;  // Slide on mouse over.
	$defaults['dragAnywhere'] = false; // Only the handle moves the divider.

	return $defaults;
} );
```

| Key | Type | Built-in | What it does |
| --- | --- | --- | --- |
| `value` | int | `50` | Where the divider starts, 0 to 100. Values outside that range are clamped. |
| `hover` | bool | `false` | Slide as the mouse moves over the block, with no click. |
| `dragAnywhere` | bool | `true` | Drag from anywhere in the image. Turn it off and only a drag that starts on the handle moves the divider. |

A block can still deviate. The filter sets what a block inherits, and a block that sets one of the three uses its own value instead. An explicit "off" on a block is a real choice, so a filter turning that setting on will not reach it.

Change the filter and every block that left the control alone follows on the next page view. Nothing needs re-saving.

### How the two drag settings relate

They answer different questions. Slide on hover asks whether you have to press the mouse button at all. Drag anywhere asks where you have to grab.

| Slide on hover | Drag anywhere | What it feels like |
| --- | --- | --- |
| off | on | Press and hold anywhere, then drag. This is the default. |
| off | off | Press and hold the handle. Dragging the image does nothing. |
| on | on or off | The divider follows the pointer. No clicking. |

Turning slide on hover on makes drag anywhere irrelevant, because there is no grabbing left to restrict.

One note for anyone reading the markup: the underlying component asks the opposite question through a `handle` attribute, so `dragAnywhere` on renders as `handle="false"`. The inversion happens in one place, where the block renders.

There is deliberately no setting for keyboard control. It is always on.

## CSS custom properties

Set these on `:root`, on `.wp-block-mai-image-compare-compare`, or on your own class.

### From the component

| Property | Default | What it does |
| --- | --- | --- |
| `--divider-width` | `1px` | Width of the line between the two images. |
| `--divider-color` | `#fff` | Colour of that line. |
| `--divider-shadow` | `none` | Shadow cast by that line. |
| `--handle-position-start` | `50%` | Where the handle sits along the divider. |
| `--default-handle-width` | `50px` | Width of the built-in handle. |
| `--default-handle-color` | `#fff` | Colour of the built-in handle. |
| `--default-handle-opacity` | `1` | Opacity of the built-in handle. |
| `--default-handle-shadow` | `none` | Shadow cast by the built-in handle. |

### From this plugin

| Property | Default | What it does |
| --- | --- | --- |
| `--mai-image-compare-ratio` | the before image's shape | The block's aspect ratio. Set by the block; override it only if you want every comparison on the site locked to one shape. |
| `--mai-image-compare-label-offset` | `1rem` | Distance from the label to the nearest two edges. |
| `--mai-image-compare-label-padding` | `0.25em 0.75em` | Padding inside the label. |
| `--mai-image-compare-label-radius` | `3px` | Corner radius of the label. |
| `--mai-image-compare-label-background` | `rgb( 0 0 0 / 70% )` | Label background. |
| `--mai-image-compare-label-color` | `#fff` | Label text colour. |
| `--mai-image-compare-label-font-size` | `0.8rem` | Label text size. |

Example:

```css
:root {
	--divider-color: #ffd400;
	--divider-width: 3px;
	--default-handle-color: #ffd400;
	--mai-image-compare-label-background: rgb( 255 212 0 / 90% );
	--mai-image-compare-label-color: #111;
}
```

## Images of different sizes

The block picks one shape and both images fill it, cropped from the centre rather than letterboxed. Bars around a comparison read as a bug to a reader, where a crop reads as a decision.

The shape is the before image's own, unless you set one with the block's aspect ratio control, which wins.

The shape is worked out on the server from the attachment's stored dimensions, so the space is the right size before a single image byte downloads. The page does not shift as the images arrive.

## Accessibility

The slider takes keyboard focus and announces itself as a slider, with its current position read out as it moves.

| Key | What it does |
| --- | --- |
| Left and right arrows | Move the divider. |
| Up and down arrows | Move the divider, in vertical mode only. In horizontal mode they scroll the page as usual. |
| Home | Jump to one end. |
| End | Jump to the other end. |

The underlying component ships neither the ARIA nor the Home, End and up/down keys, so this plugin adds them. Keyboard control cannot be switched off, by a block control or by a filter.

## What it loads

The script and styles load only on pages that actually contain the block. A page without one gets nothing.

Everything is bundled and served from your own site. There are no CDN requests, no Google Fonts, and no external requests of any kind at runtime.

The slider is [img-comparison-slider](https://github.com/sneas/img-comparison-slider), MIT licensed, about 12kB, with no runtime dependencies of its own. There is no jQuery on the front end.

## Uninstalling

The plugin stores nothing. There are no options, no tables, and no post meta, so removing it leaves nothing behind. Blocks already in your content stop rendering, and their markup stays in the post until you delete it.
