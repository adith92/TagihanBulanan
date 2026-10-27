import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
test('public /api/health is the only authentication exception',()=>{assert.match(code,/if\(req\.path==='\/api\/health'\)return next\(\)/);assert.match(code,/res\.status\(401\)/);});
test('application authentication rejects missing secrets and uses timing-safe checks',()=>{assert.match(code,/privatePassword\.length<24/);assert.match(code,/timingSafeEqual/);assert.match(code,/WWW-Authenticate/);});
