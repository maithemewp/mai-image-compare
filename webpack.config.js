const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

const r = ( p ) => path.resolve( __dirname, p );

// Two entries, each emitting its own JS and CSS. Both import the component's
// own stylesheet, which hides the element until it upgrades. Without it the
// page flashes both images stacked before the slider boots.
module.exports = {
	...defaultConfig,
	entry: {
		'mai-image-compare':        r( 'src/js/view.js' ),
		'mai-image-compare-editor': r( 'src/js/editor.js' ),
	},
};
