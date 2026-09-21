# Changelog

## 0.1.0

Initial release.

- One block, `mai-image-compare/compare`: two images and a draggable divider.
- Horizontal and vertical, optional labels, per-image alt text overrides.
- Site-wide defaults for start position, slide on hover and drag by handle only, set in code through `mai_image_compare_defaults`. A block can deviate; one that does not follows the filter on the next page view.
- WordPress's own aspect ratio control, falling back to the first image's shape. Mismatched images crop to fill rather than letterbox.
- Keyboard control with arrows, Home and End, plus the slider role and value announcements the underlying component does not ship.
- Assets load only on pages containing the block. No CDN, no external requests, no jQuery.
