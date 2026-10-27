import test from 'node:test';
import assert from 'node:assert/strict';
import {createDecipheriv,randomBytes} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {encryptState} from '../scripts/encrypted-db-backup.mjs';
test('encrypted DB snapshot roundtrip and no plaintext customer info',()=>{
 const state={schema:2,revision:3,categories:[{id:'cat1'}],templates:[],months:{'2026-10':[{number:'0012345',name:'Private Test',amount:3179571}]}};
 const key=randomBytes(32).toString('hex');
 const {seed}=encryptState(state,key);
 assert.equal(seed.subarray(0,7).toString(),'TBSEED1');
 assert.equal(seed.includes(Buffer.from('Private Test')),false);
 const d=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),seed.subarray(7,19));
 d.setAuthTag(seed.subarray(19,35));
 const result=JSON.parse(gunzipSync(Buffer.concat([d.update(seed.subarray(35)),d.final()])));
 assert.deepEqual(result,state);
});