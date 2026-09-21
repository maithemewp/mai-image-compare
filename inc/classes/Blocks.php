<?php

declare( strict_types=1 );

namespace Mai\ImageCompare;

defined( 'ABSPATH' ) || exit;

/**
 * The `mai-image-compare/compare` block.
 *
 * Server-rendered on purpose. A static block writes its attributes into post
 * content at save time, so changing the `mai_image_compare_defaults` filter
 * later would leave every already-saved post on the old values. Resolving on
 * each render is what makes a code change reach existing blocks.
 */
class Blocks {

	public const NAME = 'mai-image-compare/compare';

	public static function register(): void {
		add_action( 'init', [ __CLASS__, 'register_blocks' ] );
	}

	public static function register_blocks(): void {
		if ( ! function_exists( 'register_block_type_from_metadata' ) ) {
			return;
		}

		// Idempotent: skip if already registered (e.g. re-entrant calls in tests).
		if ( \WP_Block_Type_Registry::get_instance()->is_registered( self::NAME ) ) {
			return;
		}

		$registered = register_block_type_from_metadata( MAI_IMAGE_COMPARE_PLUGIN_DIR . 'blocks/compare', [
			'render_callback' => [ __CLASS__, 'render' ],
		] );

		// Say so when it fails. A missing or unparseable block.json (a truncated
		// raw-tree deploy) makes every page carrying the block render nothing,
		// which reads as "the block is empty" and sends the search in the wrong
		// direction.
		if ( false === $registered ) {
			_doing_it_wrong( __METHOD__, self::NAME . ' failed to register. Check blocks/compare/block.json exists and is valid JSON.', '0.1.0' );
		}

		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'localize_defaults' ] );
		add_action( 'enqueue_block_assets', [ __CLASS__, 'enqueue_editor_canvas_script' ] );
	}

	/**
	 * Hands the editor the same defaults the front end resolves, so a control
	 * left alone can label itself "Default (On)" with the site's actual value.
	 * Without this the editor would show a hardcoded guess and drift from what
	 * the page renders.
	 */
	public static function localize_defaults(): void {
		wp_add_inline_script(
			generate_block_asset_handle( self::NAME, 'editorScript' ),
			'window.maiImageCompareDefaults = ' . wp_json_encode( Defaults::get() ) . ';',
			'before'
		);
	}

	/**
	 * Loads the view script into the block editor's canvas iframe.
	 *
	 * The canvas is a real iframe with its own window, so its own custom
	 * element registry. Our editor script runs in the admin window, which means
	 * `<img-comparison-slider>` is defined there and nowhere else, and the
	 * preview renders two stacked images that never become a slider.
	 *
	 * Core builds the iframe's asset list by firing `enqueue_block_assets` with
	 * editor scripts switched off, so this is the hook that reaches inside it.
	 * The admin guard matters: this hook also fires on the front end, where
	 * enqueueing unconditionally would put the script on every page and undo
	 * the block's load-only-where-used behaviour.
	 */
	public static function enqueue_editor_canvas_script(): void {
		if ( ! is_admin() ) {
			return;
		}

		wp_enqueue_script( generate_block_asset_handle( self::NAME, 'viewScript' ) );
	}

	/**
	 * @param array<string,mixed> $attributes
	 */
	public static function render( array $attributes ): string {
		$before_id = (int) ( $attributes['beforeId'] ?? 0 );
		$after_id  = (int) ( $attributes['afterId'] ?? 0 );

		// Half a comparison is not a comparison. Render nothing rather than an
		// empty padded box.
		if ( ! $before_id || ! $after_id ) {
			return '';
		}

		$defaults = Defaults::get();

		// null means "inherit". Only a value the editor actually set overrides
		// the filter, which is why these attributes declare no default in
		// block.json. A declared default is indistinguishable from a choice.
		$value  = isset( $attributes['value'] ) ? Defaults::clamp( $attributes['value'] ) : $defaults['value'];
		$hover  = isset( $attributes['hover'] ) ? (bool) $attributes['hover'] : $defaults['hover'];
		$handle = isset( $attributes['handle'] ) ? (bool) $attributes['handle'] : $defaults['handle'];

		$direction = 'vertical' === ( $attributes['direction'] ?? '' ) ? 'vertical' : 'horizontal';

		$before = self::image( $before_id, (string) ( $attributes['beforeAlt'] ?? '' ) );
		$after  = self::image( $after_id, (string) ( $attributes['afterAlt'] ?? '' ) );

		if ( '' === $before || '' === $after ) {
			return '';
		}

		$wrapper = get_block_wrapper_attributes( [
			'style'     => self::ratio_style( $before_id, $attributes ),
			'direction' => $direction,
			'value'     => (string) $value,
			// Always explicit. The component treats any attribute value other
			// than the literal string "false" as true, so an empty attribute
			// would silently mean "on".
			'hover'     => $hover ? 'true' : 'false',
			'handle'    => $handle ? 'true' : 'false',
			// The accessible name for the slider role the view script adds.
			// Built here so it goes through the plugin's text domain rather
			// than needing script translations wired up.
			'data-mai-label' => __( 'Image comparison slider', 'mai-image-compare' ),
		] );

		return sprintf(
			'<img-comparison-slider %s>%s%s</img-comparison-slider>',
			$wrapper,
			self::side( 'first', $before, (string) ( $attributes['beforeLabel'] ?? '' ) ),
			self::side( 'second', $after, (string) ( $attributes['afterLabel'] ?? '' ) )
		);
	}

	/**
	 * One half of the comparison: the image, plus its label when there is one.
	 *
	 * The label sits inside the slot rather than over the whole block so the
	 * component's clip-path carries it, which is what makes each label appear
	 * only while its own side is showing.
	 */
	private static function side( string $slot, string $image, string $label ): string {
		$html = sprintf(
			'<div slot="%s" class="mai-image-compare__side mai-image-compare__side--%s">%s',
			esc_attr( $slot ),
			'first' === $slot ? 'before' : 'after',
			$image
		);

		if ( '' !== $label ) {
			$html .= sprintf( '<span class="mai-image-compare__label">%s</span>', esc_html( $label ) );
		}

		return $html . '</div>';
	}

	/**
	 * Falls the block back to the first image's own shape when no aspect ratio
	 * is set on the block.
	 *
	 * Emitted as a custom property because the slotted images need the ratio
	 * too, and a custom property is the only thing that reaches them through
	 * the component's shadow DOM.
	 *
	 * Reading it from attachment metadata means the box is the right shape
	 * before a single image byte downloads, so the page never shifts.
	 */
	private static function ratio_style( int $attachment_id, array $attributes ): string {
		// An aspect ratio chosen in the editor wins, and gets copied into the
		// property as well. WordPress writes its value as `aspect-ratio` on the
		// wrapper only, which the images inside the shadow DOM never see, so
		// without this copy they would keep sizing to the first image.
		$chosen = (string) ( $attributes['style']['dimensions']['aspectRatio'] ?? '' );

		if ( '' !== $chosen && 'auto' !== $chosen ) {
			return sprintf( '--mai-image-compare-ratio:%s;', esc_attr( $chosen ) );
		}

		$meta = wp_get_attachment_metadata( $attachment_id );

		$width  = (int) ( $meta['width'] ?? 0 );
		$height = (int) ( $meta['height'] ?? 0 );

		if ( ! $width || ! $height ) {
			return '';
		}

		return sprintf( '--mai-image-compare-ratio:%d/%d;', $width, $height );
	}

	/**
	 * Alt text: the block's override when set, the Media Library's own when not.
	 * An override of '' is the same as "not set", so an editor clearing the
	 * field gets the library value back rather than an empty alt.
	 */
	private static function image( int $attachment_id, string $alt ): string {
		$args = [ 'class' => 'mai-image-compare__image' ];

		if ( '' !== $alt ) {
			$args['alt'] = $alt;
		}

		return (string) wp_get_attachment_image( $attachment_id, 'large', false, $args );
	}
}
