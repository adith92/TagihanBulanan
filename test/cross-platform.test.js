import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('search updates only the result list preserving the focused input on mobile',async()=>{
  const app=await load('public/app.js');
  assert.match(app,/billResults/);
  assert.match(app,/currentResults\.replaceWith\(results\)/);
  assert.doesNotMatch(app,/const start=e\.target\.selectionStart;render\(\)/);
});
test('offline recovery never overwrites unsaved drafts',async()=>{
  const app=await load('public/app.js');
  assert.match(app,/function reconcileWhenActive\(/);
  assert.match(app,/if\(!state\|\|refreshInFlight\|\|dirty\|\|busy\|\|syncConflict/);
  assert.match(app,/window\.addEventListener\('online',reconcileWhenActive\)/);
  assert.match(app,/document\.addEventListener\('visibilitychange'/);
});
test('billing default uses Asia Jakarta and no external font dependency',async()=>{
  const app=await load('public/app.js'),css=await load('public/style.css');
  assert.match(app,/timeZone:'Asia\/Jakarta'/);
  assert.match(css,/font-family:system-ui/);
  assert.doesNotMatch(css,/@import url\('https:\/\/fonts\.googleapis\.com/);
});
test('financial API responses cannot be placed into service worker cache',async()=>{
  const sw=await load('public/sw.js');
  assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw,/tagihanbulanan-shell-v5\.3\.0/);
});

test('customer/payment numbers are copyable on desktop, mobile and master lists',async()=>{
  const app=await load('public/app.js'),style=await load('public/style.css');
  assert.match(app,/function copyNumberControl\(/);
  assert.match(app,/data-action="copyNumber"/);
  assert.match(app,/copyNumberControl\(r\)/);
  assert.match(app,/copyNumberControl\(t,'template'\)/);
  assert.match(app,/navigator\.clipboard\.writeText\(number\)/);
  assert.match(app,/document\.execCommand\?\.\('copy'\)/);
  assert.match(app,/String\(record\?\.number\?\?''\)\.trim\(\)/);
  assert.match(style,/\.copy-number/);
});

test('per-row editor supports customer ID, monthly bill and recurring template',async()=>{
 const html=await load('public/index.html'),app=await load('public/app.js'),css=await load('public/style.css');
 assert.match(html,/id="editDialog"/);
 assert.match(html,/id="editForm"/);
 assert.match(html,/name="number" type="text"/);
 assert.match(html,/name="updateMaster"/);
 assert.match(app,/data-action="editRow"/);
 assert.match(app,/data-action="editTemplate"/);
 assert.match(app,/function openRecordEditor\(/);
 assert.match(app,/function applyRecordEditor\(/);
 assert.match(app,/Object\.assign\(tmpl,masterUpdates\)/);
 assert.match(app,/function isDuplicateNumber\(/);
 assert.match(app,/if\(isDuplicateNumber\(peers/);
 assert.match(app,/if\(!busy\)void save\(false\)/);
 assert.match(css,/\.edit-dialog/);
 assert.match(css,/\.mobile-row-actions/);
});
