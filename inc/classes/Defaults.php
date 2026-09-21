<?php

declare( strict_types=1 );

namespace Mai\ImageCompare;

defined( 'ABSPATH' ) || exit;

/**
 * Site-wide defaults for the three settings a block can inherit.
 *
 * There is no settings page and no option row on purpose: these plugins go on
 * many client sites managed in code, so a default that lives in a filter
 * travels with the deploy and shows up in a diff.
 *
 * Read at render time, never baked into saved post content. Change the filter
 * and every block that left the control alone follows on the next page view.
 */
class Defaults {

	/**
	 * Built-in values, used when no filter changes them. These mirror
	 * img-comparison-slider's own defaults.
	 *
	 * @var array{value:int,hover:bool,handle:bool}
	 */
	private const BUILT_IN = [
		'value'  => 50,
		'hover'  => false,
		'handle' => false,
	];

	/**
	 * The resolved site defaults.
	 *
	 * Cast at the boundary: a filter is third-party input, and a string '25'
	 * from a callback would otherwise reach the markup untyped.
	 *
	 * @return array{value:int,hover:bool,handle:bool}
	 */
	public static function get(): array {
		$defaults = (array) apply_filters( 'mai_image_compare_defaults', self::BUILT_IN );

		return [
			'value'  => self::clamp( $defaults['value'] ?? self::BUILT_IN['value'] ),
			'hover'  => (bool) ( $defaults['hover'] ?? self::BUILT_IN['hover'] ),
			'handle' => (bool) ( $defaults['handle'] ?? self::BUILT_IN['handle'] ),
		];
	}

	/**
	 * Keeps the start position inside the 0-100 range the component expects.
	 */
	public static function clamp( mixed $value ): int {
		return max( 0, min( 100, (int) $value ) );
	}
}
