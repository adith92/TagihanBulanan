import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const txt=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Express 5 route uses supported named wildcard',async()=>{
 const source=await txt('server.mjs');
 assert.match(source,/app\.get\('\/\{\*splat\}'/);
 assert.doesNotMatch(source,/app\.get\('\*'/);
});
test('PWA service worker never intercepts /api/',async()=>{
 const sw=await txt('public/sw.js');
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/tagihanbulanan-shell-v5\.1\.0/);
});
test('PWA manifest and recovery seed included',async()=>{
 for(const p of ['public/site.webmanifest','public/icons/icon-192.png','public/icons/icon-512.png','seed/initial.enc'])await access(new URL('../'+p,import.meta.url));
});
test('Production dependencies target verified current stable and LTS',async()=>{
 const pkg=JSON.parse(await txt('package.json'));
 assert.equal(pkg.engines.node,'24.x');
 assert.equal(pkg.dependencies.express,'^5.3.0');
 assert.equal(pkg.dependencies.pg,'^8.23.1');
});
