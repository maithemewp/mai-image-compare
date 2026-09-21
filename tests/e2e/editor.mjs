import { chromium } from 'playwright';
import fs from 'fs';

// The inherited labels are only meaningful against a filter that changes them,
// so this run installs one and takes it away again.
const MU = `${process.env.HOME}/Herd/sportsdataio/wp-content/mu-plugins/mic-defaults-test.php`;
fs.writeFileSync(MU, `<?php
add_filter( 'mai_image_compare_defaults', function( array $defaults ): array {
	$defaults['value'] = 30; $defaults['hover'] = true; $defaults['dragAnywhere'] = false;
	return $defaults;
} );
`);
process.on('exit', () => { try { fs.unlinkSync(MU); } catch (e) {} });
const BASE='https://sportsdataio.test';
const out=[]; let failed=0;
const check=(n,p,d='')=>{out.push(`${p?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`); if(!p)failed++;};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors:true, viewport:{width:1500,height:1000} });
const errors=[];
ctx.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
ctx.on('pageerror',e=>errors.push('pageerror: '+e.message));
const page = await ctx.newPage();

// Log in
await page.goto(`${BASE}/wp-login.php`,{waitUntil:'domcontentloaded'});
await page.fill('#user_login','mictest');
await page.fill('#user_pass','mictestpass123');
await page.click('#wp-submit');
await page.waitForURL(/wp-admin/, { timeout: 90000, waitUntil: 'commit' });
check('logged in to wp-admin', page.url().includes('wp-admin'));

// New page, dismiss the welcome modal
await page.goto(`${BASE}/wp-admin/post-new.php?post_type=page`,{waitUntil:'domcontentloaded', timeout: 90000});
const modalClose = page.locator('.components-modal__header button[aria-label="Close"]');
await modalClose.click({ timeout: 8000 }).catch(()=>{});
// The post canvas is an iframe in WordPress 7.x, so every block query runs
// against that frame rather than the admin document.
await page.waitForSelector('iframe[name="editor-canvas"]', { timeout: 60000 });
const canvas = page.frame({ name: 'editor-canvas' });
await canvas.waitForSelector('.wp-block-post-title, .editor-post-title__input', { timeout: 60000 });

await canvas.click('.wp-block-post-title, .editor-post-title__input');
await page.keyboard.type('MIC Editor Test');

// Insert through the block inserter, the way an editor would.
await page.click('button.editor-document-tools__inserter-toggle, button[aria-label*="Block Inserter"]');
await page.fill('.block-editor-inserter__search input, input.components-search-control__input', 'Mai Image Compare');
await page.waitForTimeout(1200);
await page.click('.block-editor-block-types-list__item:has-text("Mai Image Compare")');
await page.keyboard.press('Escape');

const blockSel = '[data-type="mai-image-compare/compare"]';
await canvas.waitForSelector(blockSel, { timeout: 30000 });
check('block inserts from the inserter', await canvas.locator(blockSel).count() === 1);
check('empty state shows a media placeholder', await canvas.locator(`${blockSel} .components-placeholder`).count() === 1);
await page.screenshot({ path:'editor-1-placeholder.png' });

// Pick both images through the real Media Library modal.
const pickFromLibrary = async (title) => {
  await page.click('.media-modal .media-menu-item:has-text("Media Library")').catch(()=>{});
  await page.waitForSelector('.media-modal .attachments-browser', { timeout: 20000 });
  await page.fill('.media-modal #media-search-input, .media-modal .search', title);
  await page.waitForTimeout(1500);
  await page.click(`.media-modal .attachment[aria-label="${title}"], .media-modal .attachments .attachment >> nth=0`);
  await page.waitForSelector('.media-modal .media-button-select:not([disabled])', { timeout: 20000 });
  await page.click('.media-modal .media-button-select');
  await page.waitForSelector('.media-modal', { state:'detached', timeout: 20000 });
};

await canvas.click(`${blockSel} .components-placeholder button:has-text("Media Library")`);
await pickFromLibrary('MIC before');
await page.waitForTimeout(1000);
await canvas.click(`${blockSel} .components-placeholder button:has-text("Media Library")`);
await pickFromLibrary('MIC after');

await canvas.waitForSelector(`${blockSel} img-comparison-slider`, { timeout: 30000 });

check('preview renders the slider once both images are set', await canvas.locator(`${blockSel} img-comparison-slider`).count() === 1);
const imgCount = await canvas.locator(`${blockSel} img-comparison-slider img`).count();
check('preview shows both images', imgCount === 2, `${imgCount} images`);
check('component is defined inside the canvas iframe', await canvas.evaluate(() => !!window.customElements.get('img-comparison-slider')));
check('preview slider upgraded', await canvas.evaluate(() => !!document.querySelector('img-comparison-slider')?.classList.contains('rendered')));
check('preview keeps the block class on the wrapper', await canvas.locator(`${blockSel}.wp-block-mai-image-compare-compare`).count() === 1);
const pbox = await canvas.locator(`${blockSel} img-comparison-slider`).boundingBox();
check('preview keeps the image aspect ratio', Math.abs(pbox.width / pbox.height - 1.5) < 0.05, `ratio=${(pbox.width/pbox.height).toFixed(3)}`);
await page.screenshot({ path:'editor-2-preview.png' });

// Inspector: the two media fields and the inherited labels.
await canvas.locator(blockSel).click();
// Open the settings sidebar if it is closed, then make sure the Block tab is on.
const sidebar = page.locator('.interface-interface-skeleton__sidebar, .editor-sidebar');
if ( await sidebar.count() === 0 || ! await sidebar.first().isVisible().catch(()=>false) ) {
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.waitForTimeout(1500);
}
await page.locator('button[role="tab"]:has-text("Block"), .editor-sidebar__panel-tab:has-text("Block")').first().click().catch(()=>{});
await page.waitForSelector('.mai-image-compare-field', { timeout: 25000 }).catch(()=>{});
console.log('DBG sidebar visible', await sidebar.count(), await sidebar.first().isVisible().catch(()=>'?'), 'fields', await page.locator('.mai-image-compare-field').count());
console.log('DBG sidebar text', (await sidebar.first().innerText().catch(()=>'ERR')).slice(0,500).replace(/\n+/g,' | '));
console.log('DBG header buttons', JSON.stringify(await page.locator('.editor-header button, .edit-post-header button').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label')||n.textContent.trim()).filter(Boolean))));
await page.screenshot({path:'editor-sidebar-debug.png'});
const fields = await page.locator('.mai-image-compare-field').count();
check('two featured-image style media fields in the inspector', fields === 2, `${fields} fields`);
// getMedia() resolves per field, so the second thumbnail can land a beat late.
await page.waitForFunction(
  () => document.querySelectorAll('.mai-image-compare-field__preview img').length === 2,
  null,
  { timeout: 20000 }
).catch(()=>{});
const previews = await page.locator('.mai-image-compare-field__preview img').count();
check('both fields show a thumbnail', previews === 2, `${previews} thumbnails`);

// The filter is active in an mu-plugin setting hover/handle true and value 30,
// so the inherited labels must say so rather than showing a hardcoded guess.
const hoverDefault = await page.locator('.editor-sidebar select, .interface-interface-skeleton__sidebar select').filter({ hasText:'Default (' }).first().locator('option').first().textContent().catch(()=>'');
check('inherited option names the site default', /Default \(On\)/.test(hoverDefault || ''), hoverDefault || '');
const startBox = await page.locator('.components-checkbox-control__label:has-text("Use site default start position")').textContent().catch(()=>'');
check('start position checkbox names the site default', /30%/.test(startBox || ''), startBox || '');
await page.screenshot({ path:'editor-3-inspector.png', fullPage:false });

// Publish and confirm the saved post content carries no value/hover/handle keys.
await page.click('.editor-post-publish-panel__toggle, button.editor-post-publish-button__button');
await page.click('.editor-post-publish-button');
await page.waitForSelector('.components-snackbar, .post-publish-panel__postpublish', { timeout: 60000 });
check('published without error', true);

const postId = await page.evaluate(() => window.wp.data.select('core/editor').getCurrentPostId());
const content = await page.evaluate(() => window.wp.data.select('core/editor').getEditedPostContent());
check('saved block omits untouched settings', !/"value"|"hover"|"handle"/.test(content), content.trim().slice(0,200));
check('saved block stores both image ids', /"beforeId":\d+/.test(content) && /"afterId":\d+/.test(content));

const editorErrors = errors.filter(e=>/mai-image-compare|img-comparison|comparison-slider/i.test(e));
check('zero editor console errors from the block', editorErrors.length===0, editorErrors.slice(0,3).join(' | '));

console.log('POST_ID='+postId);
console.log(out.join('\n'));
console.log(`\n${out.length-failed}/${out.length} passed`);
await browser.close();
process.exit(failed?1:0);
