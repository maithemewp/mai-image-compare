<?php

declare( strict_types=1 );

namespace Mai\ImageCompare;

use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

defined( 'ABSPATH' ) || exit;

class Plugin {

	/**
	 * Boots the plugin. Called on plugins_loaded.
	 */
	public static function init(): void {
		Blocks::register();

		self::setup_updater();
	}

	private static function setup_updater(): void {
		// Skip updater when loaded as a Composer dependency inside another plugin.
		if ( str_contains( MAI_IMAGE_COMPARE_PLUGIN_DIR, '/vendor/' ) ) {
			return;
		}

		if ( ! class_exists( PucFactory::class ) ) {
			return;
		}

		$updater = PucFactory::buildUpdateChecker(
			'https://github.com/maithemewp/mai-image-compare/',
			MAI_IMAGE_COMPARE_FILE,
			'mai-image-compare'
		);

		$updater->setBranch( 'main' );

		// Private repos and rate-limited runners need a token; public ones don't.
		if ( defined( 'MAI_GITHUB_API_TOKEN' ) && MAI_GITHUB_API_TOKEN ) {
			$updater->setAuthentication( MAI_GITHUB_API_TOKEN );
		}
	}
}
