/**
 * Editor UI for the compare block.
 *
 * Three settings are `undefined` until an editor deliberately changes them:
 * start position, slide on hover, and drag anywhere. Undefined means
 * "follow the site default", which PHP resolves from the
 * `mai_image_compare_defaults` filter on every render. That is why those three
 * attributes declare no default in block.json: a declared default would be
 * written into the post and become indistinguishable from a real choice.
 *
 * The site's current defaults arrive as window.maiImageCompareDefaults so each
 * inherited control can label itself with the value it is actually inheriting.
 */

import { registerBlockType } from '@wordpress/blocks';
import {
	useBlockProps,
	InspectorControls,
	MediaUpload,
	MediaUploadCheck,
	MediaPlaceholder,
} from '@wordpress/block-editor';
import {
	PanelBody,
	Button,
	SelectControl,
	RangeControl,
	CheckboxControl,
	TextControl,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { useRef, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import 'img-comparison-slider';
import 'img-comparison-slider/dist/styles.css';
import '../css/front.css';
import '../css/editor.css';

import metadata from '../../blocks/compare/block.json';

const SITE_DEFAULTS = window.maiImageCompareDefaults || {
	value: 50,
	hover: false,
	dragAnywhere: true,
};

/**
 * One image field, shaped like the post's featured image control: a thumbnail
 * that opens the Media Library, with Replace and Remove underneath.
 *
 * Core's PostFeaturedImage is not reusable here. It reads the post's own
 * featured_media from the editor store, so this rebuilds the same shape from
 * the media components it is itself built from.
 *
 * @param {Object}   props
 * @param {string}   props.label    Field label.
 * @param {number}   props.id       Current attachment ID, or undefined.
 * @param {Function} props.onSelect Called with the chosen attachment ID.
 * @param {Function} props.onRemove Called to clear the field.
 * @return {Element} The field.
 */
function ImageField( { label, id, onSelect, onRemove } ) {
	const media = useSelect(
		( select ) => ( id ? select( coreStore ).getMedia( id ) : null ),
		[ id ]
	);

	const url =
		media?.media_details?.sizes?.medium?.source_url || media?.source_url;

	return (
		<div className="mai-image-compare-field">
			<span className="mai-image-compare-field__label">{ label }</span>
			<MediaUploadCheck
				fallback={
					<p className="mai-image-compare-field__notice">
						{ __(
							'You do not have permission to upload media.',
							'mai-image-compare'
						) }
					</p>
				}
			>
				<MediaUpload
					title={ label }
					allowedTypes={ [ 'image' ] }
					value={ id }
					onSelect={ ( image ) => onSelect( image.id ) }
					render={ ( { open } ) => (
						<>
							<Button
								className={
									url
										? 'mai-image-compare-field__preview'
										: 'mai-image-compare-field__toggle'
								}
								onClick={ open }
								label={
									url
										? __(
												'Replace image',
												'mai-image-compare'
											)
										: __( 'Set image', 'mai-image-compare' )
								}
								showTooltip={ !! url }
							>
								{ url ? (
									<img src={ url } alt="" />
								) : (
									__( 'Set image', 'mai-image-compare' )
								) }
							</Button>
							{ !! id && (
								<div className="mai-image-compare-field__actions">
									<Button
										size="compact"
										variant="secondary"
										onClick={ open }
									>
										{ __( 'Replace', 'mai-image-compare' ) }
									</Button>
									<Button
										size="compact"
										variant="tertiary"
										isDestructive
										onClick={ onRemove }
									>
										{ __( 'Remove', 'mai-image-compare' ) }
									</Button>
								</div>
							) }
						</>
					) }
				/>
			</MediaUploadCheck>
		</div>
	);
}

/**
 * A three-state on/off control. The empty option carries the inherited value in
 * its own label, so "Default (On)" changes the moment the filter does.
 *
 * @param {Object}   props
 * @param {string}   props.label       Control label.
 * @param {string}   props.help        Help text under the control.
 * @param {boolean}  props.value       The block's value, or undefined to inherit.
 * @param {boolean}  props.siteDefault What the filter currently resolves to.
 * @param {boolean}  props.disabled    Greys the control out when it has no effect.
 * @param {Function} props.onChange    Called with true, false or undefined.
 * @return {Element} The control.
 */
function InheritToggle( {
	label,
	help,
	value,
	siteDefault,
	disabled = false,
	onChange,
} ) {
	const on = __( 'On', 'mai-image-compare' );
	const off = __( 'Off', 'mai-image-compare' );

	// Undefined is the inherit state and has to stay distinct from false, so
	// this cannot collapse into a truthiness check.
	let selected = '';

	if ( undefined !== value ) {
		selected = value ? 'on' : 'off';
	}

	const inheritLabel = sprintf(
		/* translators: %s: the site-wide default for this setting, already translated. */
		__( 'Default (%s)', 'mai-image-compare' ),
		siteDefault ? on : off
	);

	return (
		<SelectControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ label }
			help={ help }
			disabled={ disabled }
			value={ selected }
			options={ [
				{ value: '', label: inheritLabel },
				{ value: 'on', label: on },
				{ value: 'off', label: off },
			] }
			onChange={ ( next ) =>
				onChange( '' === next ? undefined : 'on' === next )
			}
		/>
	);
}

function Edit( { attributes, setAttributes } ) {
	const {
		beforeId,
		afterId,
		beforeAlt,
		afterAlt,
		beforeLabel,
		afterLabel,
		direction,
		value,
		hover,
		dragAnywhere,
	} = attributes;

	const beforeMedia = useSelect(
		( select ) =>
			beforeId ? select( coreStore ).getMedia( beforeId ) : null,
		[ beforeId ]
	);
	const afterMedia = useSelect(
		( select ) =>
			afterId ? select( coreStore ).getMedia( afterId ) : null,
		[ afterId ]
	);

	// What the front end will actually use, so the preview matches the page.
	const resolved = {
		value: undefined === value ? SITE_DEFAULTS.value : value,
		hover: undefined === hover ? SITE_DEFAULTS.hover : hover,
		dragAnywhere:
			undefined === dragAnywhere
				? SITE_DEFAULTS.dragAnywhere
				: dragAnywhere,
	};

	// The images live inside the component's shadow DOM, where they cannot see
	// the `aspect-ratio` WordPress writes on the wrapper. So the block's chosen
	// ratio is copied into a custom property, which does reach them. Same
	// precedence as the front end: an explicit choice first, the first image's
	// own shape otherwise.
	const chosen = attributes.style?.dimensions?.aspectRatio;
	const width = beforeMedia?.media_details?.width;
	const height = beforeMedia?.media_details?.height;

	let ratio;

	if ( chosen && 'auto' !== chosen ) {
		ratio = chosen;
	} else if ( width && height ) {
		ratio = `${ width }/${ height }`;
	}

	const blockProps = useBlockProps( {
		style: ratio ? { '--mai-image-compare-ratio': ratio } : undefined,
	} );

	const slider = useRef( null );

	// `hover` and `direction` are observed attributes, so React setting them is
	// enough. `value` and `handle` are read once when the element connects and
	// never again, so those two are pushed as properties, which do have
	// setters. The component's `handle` is the inverse of our `dragAnywhere`.
	// The element lives in the canvas iframe, so `whenDefined` is read from
	// that document's own window rather than the admin one.
	useEffect( () => {
		const el = slider.current;

		if ( ! el ) {
			return;
		}

		const view = el.ownerDocument?.defaultView;

		if ( ! view?.customElements ) {
			return;
		}

		view.customElements.whenDefined( 'img-comparison-slider' ).then( () => {
			el.value = resolved.value;
			el.handle = ! resolved.dragAnywhere;
		} );
	}, [ resolved.value, resolved.dragAnywhere, beforeId, afterId ] );

	const controls = (
		<InspectorControls>
			<PanelBody title={ __( 'Images', 'mai-image-compare' ) }>
				<ImageField
					label={ __( 'Before', 'mai-image-compare' ) }
					id={ beforeId }
					onSelect={ ( id ) => setAttributes( { beforeId: id } ) }
					onRemove={ () => setAttributes( { beforeId: undefined } ) }
				/>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Before label', 'mai-image-compare' ) }
					help={ __(
						'Optional badge shown over this image. It only shows while this image is showing.',
						'mai-image-compare'
					) }
					value={ beforeLabel }
					onChange={ ( next ) =>
						setAttributes( { beforeLabel: next } )
					}
				/>
				<hr />
				<ImageField
					label={ __( 'After', 'mai-image-compare' ) }
					id={ afterId }
					onSelect={ ( id ) => setAttributes( { afterId: id } ) }
					onRemove={ () => setAttributes( { afterId: undefined } ) }
				/>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'After label', 'mai-image-compare' ) }
					help={ __(
						'Optional badge shown over this image. It only shows while this image is showing.',
						'mai-image-compare'
					) }
					value={ afterLabel }
					onChange={ ( next ) =>
						setAttributes( { afterLabel: next } )
					}
				/>
			</PanelBody>

			<PanelBody title={ __( 'Settings', 'mai-image-compare' ) }>
				<SelectControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Direction', 'mai-image-compare' ) }
					value={ direction }
					options={ [
						{
							value: 'horizontal',
							label: __( 'Horizontal', 'mai-image-compare' ),
						},
						{
							value: 'vertical',
							label: __( 'Vertical', 'mai-image-compare' ),
						},
					] }
					onChange={ ( next ) =>
						setAttributes( { direction: next } )
					}
				/>

				<CheckboxControl
					__nextHasNoMarginBottom
					label={ sprintf(
						/* translators: %d: the site-wide default start position, 0-100. */
						__(
							'Use site default start position (%d%%)',
							'mai-image-compare'
						),
						SITE_DEFAULTS.value
					) }
					checked={ undefined === value }
					onChange={ ( checked ) =>
						setAttributes( {
							value: checked ? undefined : SITE_DEFAULTS.value,
						} )
					}
				/>

				{ undefined !== value && (
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Start position', 'mai-image-compare' ) }
						value={ value }
						min={ 0 }
						max={ 100 }
						onChange={ ( next ) =>
							setAttributes( { value: next } )
						}
					/>
				) }

				<InheritToggle
					label={ __( 'Slide on hover', 'mai-image-compare' ) }
					help={ __(
						'The divider follows the pointer with no clicking.',
						'mai-image-compare'
					) }
					value={ hover }
					siteDefault={ SITE_DEFAULTS.hover }
					onChange={ ( next ) => setAttributes( { hover: next } ) }
				/>

				<InheritToggle
					label={ __( 'Drag anywhere', 'mai-image-compare' ) }
					help={
						resolved.hover
							? __(
									'Slide on hover is on, so the divider already follows the pointer and there is nothing left to restrict.',
									'mai-image-compare'
								)
							: __(
									'Off means only the handle moves the divider.',
									'mai-image-compare'
								)
					}
					value={ dragAnywhere }
					siteDefault={ SITE_DEFAULTS.dragAnywhere }
					disabled={ resolved.hover }
					onChange={ ( next ) =>
						setAttributes( { dragAnywhere: next } )
					}
				/>
			</PanelBody>

			<PanelBody
				title={ __( 'Image alt text', 'mai-image-compare' ) }
				initialOpen={ false }
			>
				<p className="mai-image-compare-panel__intro">
					{ __(
						'Each image already uses the alt text from the Media Library. Override it here when this page needs to describe the image differently.',
						'mai-image-compare'
					) }
				</p>
				{ !! beforeId && (
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Before image', 'mai-image-compare' ) }
						value={ beforeAlt }
						onChange={ ( next ) =>
							setAttributes( { beforeAlt: next } )
						}
					/>
				) }
				{ !! afterId && (
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'After image', 'mai-image-compare' ) }
						value={ afterAlt }
						onChange={ ( next ) =>
							setAttributes( { afterAlt: next } )
						}
					/>
				) }
			</PanelBody>
		</InspectorControls>
	);

	if ( ! beforeId || ! afterId ) {
		return (
			<>
				{ controls }
				<div { ...blockProps }>
					<MediaPlaceholder
						icon="image-flip-horizontal"
						labels={ {
							title: __(
								'Mai Image Compare',
								'mai-image-compare'
							),
							instructions: beforeId
								? __(
										'Choose the second image to compare against.',
										'mai-image-compare'
									)
								: __(
										'Choose two images to compare. Pick the before image first.',
										'mai-image-compare'
									),
						} }
						allowedTypes={ [ 'image' ] }
						multiple={ false }
						onSelect={ ( image ) =>
							setAttributes(
								beforeId
									? { afterId: image.id }
									: { beforeId: image.id }
							)
						}
					/>
				</div>
			</>
		);
	}

	const beforeSrc = beforeMedia?.source_url;
	const afterSrc = afterMedia?.source_url;

	// The block's own props go on a wrapping div, not on the slider. React
	// writes an unrecognised `className` onto a custom element as the literal
	// attribute `classname`, so putting them on the slider would drop every
	// class the editor and this plugin rely on.
	return (
		<>
			{ controls }
			<div { ...blockProps }>
				<img-comparison-slider
					ref={ slider }
					direction={ direction }
					hover={ resolved.hover ? 'true' : 'false' }
				>
					<div
						slot="first"
						className="mai-image-compare__side mai-image-compare__side--before"
					>
						<img
							className="mai-image-compare__image"
							src={ beforeSrc }
							alt=""
						/>
						{ !! beforeLabel && (
							<span className="mai-image-compare__label">
								{ beforeLabel }
							</span>
						) }
					</div>
					<div
						slot="second"
						className="mai-image-compare__side mai-image-compare__side--after"
					>
						<img
							className="mai-image-compare__image"
							src={ afterSrc }
							alt=""
						/>
						{ !! afterLabel && (
							<span className="mai-image-compare__label">
								{ afterLabel }
							</span>
						) }
					</div>
				</img-comparison-slider>
			</div>
		</>
	);
}

registerBlockType( metadata.name, { edit: Edit } );
