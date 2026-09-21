<?php

/**
 * Plugin Name:     Mai Image Compare
 * Plugin URI:      https://bizbudding.com/
 * Description:     A before/after image comparison block. Two images, one draggable divider. Site-wide defaults are set in code via a filter; there is no settings page.
 * Version:         0.1.0
 *
 * Author:          BizBudding
 * Author URI:      https://bizbudding.com
 *
 * Text Domain:     mai-image-compare
 * Requires PHP:    8.2
 * Requires at least: 7.0
 * License:         GPL-2.0-or-later
 * License URI:     https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package Mai\ImageCompare
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

// Prevent double-loading when installed standalone AND bundled via Composer.
if ( defined( 'MAI_IMAGE_COMPARE_VERSION' ) ) {
	return;
}

define( 'MAI_IMAGE_COMPARE_VERSION',    '0.1.0' );
define( 'MAI_IMAGE_COMPARE_FILE',       __FILE__ );
define( 'MAI_IMAGE_COMPARE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'MAI_IMAGE_COMPARE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once __DIR__ . '/vendor/autoload.php';

add_action( 'plugins_loaded', [ \Mai\ImageCompare\Plugin::class, 'init' ] );
