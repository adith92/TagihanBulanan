import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, generatePeriod, summary, validateState } from '../public/model.js';

test('periode baru menyalin nominal dan mereset status', () => {
  const state=blankState();
  const master={id:'t1',name:'Listrik 1',number:'00001',categoryId:state.categories[0].id,active:true};
  state.templates=[master];
  state.months['2026-10']=[{id:'o',templateId:'t1',categoryId:master.categoryId,name:master.name,number:master.number,amount:123456,platform:'Shopee',paid:true,printed:true}];
  const next=generatePeriod(state,'2026-11');
  assert.equal(next[0].amount,123456);
  assert.equal(next[0].number,'00001');
  assert.equal(next[0].paid,false);
  assert.equal(next[0].printed,false);
  assert.equal(state.months['2026-10'][0].paid,true);
});

test('snapshot bulan tetap independen dan total akurat',()=>{
  const state=blankState();
  const master={id:'t2',name:'Air Sekolah',number:'000123',categoryId:state.categories[0].id,active:true};
  state.templates=[master];
  state.months['2026-01']=[{id:'a',templateId:'t2',categoryId:master.categoryId,name:master.name,number:master.number,amount:18000,paid:true,printed:false,hidden:false}];
  state.months['2026-02']=generatePeriod(state,'2026-02');
  state.months['2026-02'][0].amount=19000;
  assert.equal(state.months['2026-01'][0].amount,18000);
  assert.equal(summary(state.months['2026-02']).due,19000);
  assert.equal(validateState(state),true);
});
