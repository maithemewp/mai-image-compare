import { chromium } from 'playwright';
import fs from 'fs';

// Screenshots and the results log land here, outside version control.
const OUT = new URL( './output/', import.meta.url ).pathname;
fs.mkdirSync( OUT, { recursive: true } );
import { PNG } from 'pngjs';

const BASE = 'https://sportsdataio.test';
const SEL = 'img-comparison-slider.wp-block-mai-image-compare-compare';
const out = [];
let failed = 0;

const check = (name, pass, detail = '') => {
  out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`);
  if (!pass) failed++;
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });

const errors = [];
const external = [];
ctx.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
ctx.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
ctx.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== 'sportsdataio.test' && u.protocol !== 'data:') external.push(r.url()); });

const page = await ctx.newPage();
const go = async (slug) => {
  await page.goto(`${BASE}/${slug}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!customElements.get('img-comparison-slider')).catch(() => {});
};
const val = () => page.$eval(SEL, (el) => el.value);
const aria = (a) => page.$eval(SEL, (el, n) => el.getAttribute(n), a);

// --- 1. Default page renders and upgrades
await go('mic-default');
check('component upgrades (gets .rendered class)', await page.$eval(SEL, (el) => el.classList.contains('rendered')));
check('start position is the 50 default', Math.round(await val()) === 50, `value=${await val()}`);

// --- 2. ARIA added by our view script
check('role=slider', (await aria('role')) === 'slider');
check('aria-valuemin/max', (await aria('aria-valuemin')) === '0' && (await aria('aria-valuemax')) === '100');
check('aria-valuenow matches value', (await aria('aria-valuenow')) === '50', `now=${await aria('aria-valuenow')}`);
check('aria-orientation horizontal', (await aria('aria-orientation')) === 'horizontal');
check('aria-label present', !!(await aria('aria-label')));

// --- 3. Keyboard: arrows (component), Home/End (ours)
await page.focus(SEL);
await page.keyboard.press('Home');
check('Home jumps to 0', Math.round(await val()) === 0, `value=${await val()}`);
check('aria-valuenow follows Home', (await aria('aria-valuenow')) === '0');
await page.keyboard.press('End');
check('End jumps to 100', Math.round(await val()) === 100, `value=${await val()}`);
const beforeArrow = await val();
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(300);
await page.keyboard.up('ArrowLeft');
check('ArrowLeft moves the divider', (await val()) < beforeArrow, `${beforeArrow} -> ${await val()}`);
// ArrowUp must NOT be captured in horizontal mode (page should still scroll).
await page.keyboard.press('Home');
const preUp = await val();
await page.keyboard.press('ArrowUp');
check('ArrowUp ignored in horizontal mode', Math.round(await val()) === Math.round(preUp));

// --- 4. Mouse drag
await page.keyboard.press('Home');
const box = await page.$eval(SEL, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
await page.mouse.move(box.x + box.w * 0.2, box.y + box.h / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.w * 0.75, box.y + box.h / 2, { steps: 12 });
await page.mouse.up();
const dragged = await val();
check('mouse drag moves the divider', dragged > 60 && dragged < 90, `value=${Math.round(dragged)}`);

// --- 5. Touch drag
const tctx = await browser.newContext({ ignoreHTTPSErrors: true, hasTouch: true, isMobile: true, viewport: { width: 420, height: 800 } });
const tpage = await tctx.newPage();
await tpage.goto(`${BASE}/mic-default/`, { waitUntil: 'networkidle' });
const tbox = await tpage.$eval(SEL, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
await tpage.touchscreen.tap(tbox.x + tbox.w * 0.25, tbox.y + tbox.h / 2);
const touched = await tpage.$eval(SEL, (el) => el.value);
check('touch moves the divider', touched < 40, `value=${Math.round(touched)}`);
await tctx.close();

// --- 6. Loaded page: vertical, labels, value 25, hover, handle
await go('mic-loaded');
check('start position honours per-block value 25', Math.round(await val()) === 25, `value=${await val()}`);
check('direction is vertical', (await page.$eval(SEL, (el) => el.direction)) === 'vertical');
check('aria-orientation vertical', (await aria('aria-orientation')) === 'vertical');
check('hover on', (await page.$eval(SEL, (el) => el.hover)) === true);
check('drag anywhere off maps to the component handle attribute', (await page.$eval(SEL, (el) => el.handle)) === true);
check('labels render', (await page.$$eval('.mai-image-compare__label', (n) => n.map((x) => x.textContent))).join(',') === 'Before,After');
check('alt override applied', (await page.$eval('.mai-image-compare__side--before img', (el) => el.alt)) === 'Overridden before alt');
check('library alt used when no override', (await page.$eval('.mai-image-compare__side--after img', (el) => el.alt)) === 'Library alt for after');

// Vertical: our ArrowUp/ArrowDown
await page.focus(SEL);
await page.keyboard.press('Home');
await page.keyboard.press('ArrowDown');
check('ArrowDown works in vertical mode', Math.round(await val()) === 2, `value=${await val()}`);
await page.keyboard.press('End');
await page.keyboard.press('ArrowUp');
check('ArrowUp works in vertical mode', Math.round(await val()) === 98, `value=${await val()}`);

// hover: moving the mouse alone should move it (hover="true" on this page)
const vbox = await page.$eval(SEL, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
await go('mic-loaded');
await page.mouse.move(vbox.x + vbox.w / 2, vbox.y + vbox.h * 0.7, { steps: 5 });
await page.waitForTimeout(120);
check('hover slides without a click', Math.round(await val()) !== 25, `value=${await val()}`);

// handle-only, on a page where hover is off. With hover on, a mouse move
// slides whatever `handle` says, so the two must be tested apart.
await go('mic-handleonly');
const hbox = await page.$eval(SEL, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
await page.mouse.move(hbox.x + hbox.w * 0.15, hbox.y + hbox.h / 2);
await page.mouse.down();
await page.mouse.move(hbox.x + hbox.w * 0.85, hbox.y + hbox.h / 2, { steps: 10 });
await page.mouse.up();
check('handle-only ignores a drag off the handle', Math.round(await val()) === 50, `value=${await val()}`);
// ...but dragging the handle itself still works.
await page.mouse.move(hbox.x + hbox.w * 0.5, hbox.y + hbox.h / 2);
await page.mouse.down();
await page.mouse.move(hbox.x + hbox.w * 0.8, hbox.y + hbox.h / 2, { steps: 10 });
await page.mouse.up();
check('handle-only still drags from the handle', Math.round(await val()) > 70, `value=${await val()}`);

// hover off on the default page: mouse move alone must NOT move it
await go('mic-default');
const dbox = await page.$eval(SEL, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
await page.mouse.move(dbox.x + dbox.w * 0.8, dbox.y + dbox.h / 2, { steps: 5 });
await page.waitForTimeout(120);
check('hover off ignores a plain mouse move', Math.round(await val()) === 50, `value=${await val()}`);

// --- 7. Aspect ratio
await go('mic-ratio');
const ratio = await page.$eval(SEL, (el) => { const b = el.getBoundingClientRect(); return b.width / b.height; });
check('explicit 16/9 wins over the image ratio', Math.abs(ratio - 16 / 9) < 0.02, `ratio=${ratio.toFixed(3)}`);
await go('mic-default');
const natural = await page.$eval(SEL, (el) => { const b = el.getBoundingClientRect(); return b.width / b.height; });
check('unset falls back to image 1 (1200/800 = 1.5)', Math.abs(natural - 1.5) < 0.02, `ratio=${natural.toFixed(3)}`);

// --- 8. Mismatched images: both fill the same box, no letterbox
await go('mic-mismatch');
const sizes = await page.$$eval(`${SEL} img`, (imgs) => imgs.map((i) => { const b = i.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }));
check('mismatched images render at identical size', JSON.stringify(sizes[0]) === JSON.stringify(sizes[1]), JSON.stringify(sizes));
check('mismatched pair uses object-fit cover', (await page.$eval(`${SEL} img`, (i) => getComputedStyle(i).objectFit)) === 'cover');

// --- 9. No layout shift
await page.goto(`${BASE}/mic-default/`, { waitUntil: 'commit' });
const cls = await page.evaluate(() => new Promise((res) => {
  let total = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) total += e.value; }).observe({ type: 'layout-shift', buffered: true });
  setTimeout(() => res(total), 2500);
}));
check('no cumulative layout shift', cls < 0.01, `CLS=${cls.toFixed(4)}`);

// --- 10. Assets only where the block is
await go('mic-none');
const baselineHosts = new Set(external.map((u) => new URL(u).hostname));
const noneAssets = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.includes('mai-image-compare')).length);
check('no plugin assets on a page without the block', noneAssets === 0, `${noneAssets} found`);
const noneInline = await page.evaluate(() => !!document.getElementById('mai-image-compare-compare-style-inline-css'));
check('no plugin styles on a page without the block', !noneInline);
const externalMark = external.length;
await go('mic-default');
const someAssets = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.includes('mai-image-compare')).map((r) => r.name.split('/').pop().split('?')[0]));
const blockPageRequests = new Set(external.slice(externalMark));
check('view script loads where the block is', someAssets.length === 1 && someAssets[0] === 'mai-image-compare.js', someAssets.join(', '));
// WordPress inlines block stylesheets under its size limit, so the CSS is not
// a separate request. Check it arrived rather than assuming a second file.
const hasInline = await page.evaluate(() => (document.getElementById('mai-image-compare-compare-style-inline-css')?.textContent || ''));
check('block styles inlined, including the component base', hasInline.includes('img-comparison-slider{visibility:hidden}') && hasInline.includes('object-fit:cover'));

// --- 11. Label stacking, checked in pixels.
//
// Hit testing cannot answer this: the component's `.first` layer covers the
// whole block and stays hit-testable whatever the divider is doing, because
// only its inner container is clipped. So this reads the rendered colour where
// the after label sits. A label must disappear once the other image covers the
// block, which is why it carries no z-index.
await go('mic-labels');
const labelPixel = async ( value ) => {
	const where = await page.evaluate( ( v ) => {
		const host = document.querySelector( 'img-comparison-slider' );
		host.value = v;
		const label = host.querySelector(
			'.mai-image-compare__side--after .mai-image-compare__label'
		);
		const box  = label.getBoundingClientRect();
		const host_box = host.getBoundingClientRect();
		// Four pixels in from the left edge, vertically centred. That lands in
		// the badge's own padding, so it reads the background rather than a
		// white glyph.
		return {
			x: Math.round( box.x + 4 - host_box.x ),
			y: Math.round( box.y + box.height / 2 - host_box.y ),
		};
	}, value );

	await page.waitForTimeout( 350 );

	const shot = await ( await page.$( SEL ) ).screenshot();
	const png  = PNG.sync.read( shot );
	const i    = ( png.width * where.y + where.x ) << 2;

	return { r: png.data[ i ], g: png.data[ i + 1 ], b: png.data[ i + 2 ] };
};

const dark = ( p ) => p.r < 90 && p.g < 90 && p.b < 90;

const atZero = await labelPixel( 0 );
check( 'after label is visible while its own image is showing', dark( atZero ), JSON.stringify( atZero ) );

const atFull = await labelPixel( 100 );
check( 'after label is hidden once the before image covers the block', ! dark( atFull ), JSON.stringify( atFull ) );

const labelZ = await page.$eval(
	`${ SEL } .mai-image-compare__side--after .mai-image-compare__label`,
	( el ) => getComputedStyle( el ).zIndex
);
check( 'label carries no z-index', labelZ === 'auto', labelZ );

// --- 12. The defaults filter, applied and removed for real
const MU = `${process.env.HOME}/Herd/sportsdataio/wp-content/mu-plugins/mic-defaults-test.php`;
fs.writeFileSync(MU, `<?php
add_filter( 'mai_image_compare_defaults', function( array $defaults ): array {
	defaults_placeholder
	return $defaults;
} );
`.replace('defaults_placeholder', "$defaults['value'] = 30; $defaults['hover'] = true; $defaults['dragAnywhere'] = false;"));

await go('mic-default');
const filtered = await page.$eval(SEL, (el) => ({ v: Math.round(el.value), h: el.hover, d: el.handle }));
// `d` is the component's `handle`, the inverse of our `dragAnywhere`. The
// filter turns dragAnywhere off, so handle must come back true.
check('filter moves a block that overrode nothing', filtered.v === 30 && filtered.h === true && filtered.d === true, JSON.stringify(filtered));

await go('mic-loaded');
const overridden = await page.$eval(SEL, (el) => Math.round(el.value));
check('per-block start position still beats the filter', overridden === 25, `value=${overridden}`);

// hover:false was set deliberately on this block, so a filter turning hover on
// must not reach it. This is the case that breaks if "unset" and "false" are
// ever allowed to look the same in the saved attributes.
await go('mic-handleonly');
const explicitOff = await page.$eval(SEL, (el) => el.hover);
check('an explicit off is not overwritten by a filter turning it on', explicitOff === false);

fs.unlinkSync(MU);
await go('mic-default');
const restored = await page.$eval(SEL, (el) => ({ v: Math.round(el.value), h: el.hover, d: el.handle }));
// Built-in dragAnywhere is true, so the component's handle is false.
check('removing the filter restores the built-in defaults', restored.v === 50 && restored.h === false && restored.d === false, JSON.stringify(restored));

// --- 13. Clean console, no external requests
// The site runs its own ad and analytics stack on every page, so a raw count
// is never zero and says nothing about this plugin. Measure what the block
// itself adds: anything naming our assets or the component, and any external
// host that appears on the block page but not on the identical page without it.
const ours = errors.filter((e) => /mai-image-compare|img-comparison|comparison-slider/i.test(e));
check('zero console errors from the block', ours.length === 0, ours.slice(0, 3).join(' | '));

// The site runs its own ad and analytics stack, and which third-party hosts it
// reaches varies per page view, so diffing hosts between two pages is a coin
// toss. This asks the real question instead: cut the block off from every
// other origin and see whether it still works.
const walled = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const blocked = [];
await walled.route('**', (route) => {
	const url = new URL(route.request().url());

	if ('sportsdataio.test' === url.hostname || 'data:' === url.protocol) {
		return route.continue();
	}

	blocked.push(url.href);
	return route.abort();
});

const wpage = await walled.newPage();
await wpage.goto(`${BASE}/mic-default/`, { waitUntil: 'domcontentloaded' });
await wpage.waitForFunction(() => !!customElements.get('img-comparison-slider'), null, { timeout: 30000 });
check('block works with every other origin cut off', await wpage.$eval(SEL, (el) => el.classList.contains('rendered')));

await wpage.focus(SEL);
await wpage.keyboard.press('End');
check('keyboard still works with every other origin cut off', Math.round(await wpage.$eval(SEL, (el) => el.value)) === 100);
check('nothing the block needs was among the blocked requests', blocked.every((u) => !/mai-image-compare|img-comparison/i.test(u)), blocked.filter((u) => /mai-image-compare|img-comparison/i.test(u)).join(', '));
await walled.close();

check('no request to a CDN for the component', external.every((u) => !/jsdelivr|unpkg|cdnjs/i.test(u)), external.filter((u) => /jsdelivr|unpkg|cdnjs/i.test(u)).join(', '));

// Screenshots
for (const slug of ['mic-default', 'mic-loaded', 'mic-mismatch', 'mic-ratio']) {
  await go(slug);
  const el = await page.$(SEL);
  await el.screenshot({ path: `${ OUT }shot-${ slug }.png` });
}

await browser.close();
fs.writeFileSync(OUT + 'results.txt', out.join('\n'));
console.log(out.join('\n'));
console.log(`\n${out.length - failed}/${out.length} passed`);
process.exit(failed ? 1 : 0);
