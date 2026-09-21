/**
 * Front-end behaviour for the compare block.
 *
 * img-comparison-slider ships no ARIA at all (the only attribute it sets is
 * tabindex) and its whole key map is ArrowLeft and ArrowRight. So a screen
 * reader announces nothing useful, Home and End do nothing, and a vertical
 * slider is still driven by the horizontal arrows.
 *
 * This file closes both gaps without forking the component: it adds the slider
 * role and its values, keeps aria-valuenow in step with the component's own
 * `slide` event, and handles the keys the component left out.
 */

import 'img-comparison-slider';
import 'img-comparison-slider/dist/styles.css';
import '../css/front.css';

const SELECTOR = 'img-comparison-slider.wp-block-mai-image-compare-compare';

// How far Home/End/Up/Down move the divider, in percent.
const STEP = 2;

/**
 * Rounds to a whole percent and keeps it in range, so aria-valuenow never
 * reports 49.833333 or a value outside its own min and max.
 *
 * @param {number} value Raw position from the component.
 * @return {number} A whole percent between 0 and 100.
 */
const clamp = ( value ) => Math.max( 0, Math.min( 100, Math.round( value ) ) );

const setValue = ( slider, value ) => {
	slider.value = clamp( value );
	announce( slider );
};

const announce = ( slider ) => {
	slider.setAttribute( 'aria-valuenow', String( clamp( slider.value ) ) );
};

const onKeyDown = ( event ) => {
	const slider = event.currentTarget;
	const vertical = 'vertical' === slider.direction;

	let next;

	switch ( event.key ) {
		case 'Home':
			next = 0;
			break;
		case 'End':
			next = 100;
			break;
		case 'ArrowUp':
			// Only ours in vertical mode. In horizontal mode up and down should
			// scroll the page as usual.
			if ( ! vertical ) {
				return;
			}
			next = slider.value - STEP;
			break;
		case 'ArrowDown':
			if ( ! vertical ) {
				return;
			}
			next = slider.value + STEP;
			break;
		default:
			// ArrowLeft and ArrowRight are the component's own; leave them alone.
			return;
	}

	event.preventDefault();
	setValue( slider, next );
};

const enhance = ( slider ) => {
	if ( slider.dataset.maiImageCompareReady ) {
		return;
	}

	slider.dataset.maiImageCompareReady = 'true';

	slider.setAttribute( 'role', 'slider' );
	slider.setAttribute( 'aria-valuemin', '0' );
	slider.setAttribute( 'aria-valuemax', '100' );
	slider.setAttribute(
		'aria-orientation',
		'vertical' === slider.direction ? 'vertical' : 'horizontal'
	);

	if ( ! slider.hasAttribute( 'aria-label' ) ) {
		slider.setAttribute(
			'aria-label',
			slider.dataset.maiLabel || 'Image comparison slider'
		);
	}

	announce( slider );

	// The component fires `slide` for every change it makes, including its own
	// arrow keys and pointer drags, so one listener keeps the announced value
	// honest no matter what moved it.
	slider.addEventListener( 'slide', () => announce( slider ) );
	slider.addEventListener( 'keydown', onKeyDown );
};

const init = () => {
	document.querySelectorAll( SELECTOR ).forEach( enhance );
};

// Wait for the element definition so `slider.value` hits the component's
// accessor rather than shadowing it on an un-upgraded element.
window.customElements.whenDefined( 'img-comparison-slider' ).then( () => {
	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} );
