import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, generatePeriod, summary, validateState, parseIdrAmount } from '../public/model.js';

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


test('paste currency from websites converts directly into integer Rupiah',()=>{
 const cases=[
  ['Rp3.179.571',3179571],
  ['**Rp3.179.571**',3179571],
  ['Rp 3.179.571',3179571],
  ['Rp\u00a03.179.571',3179571],
  ['Rp\u202f3.179.571',3179571],
  ['IDR 3,179,571',3179571],
  ['Rp. 3.179.571',3179571],
  ['Rp 3.179.571,00',3179571],
  ['Rp 3,179,571.00',3179571],
  ['Rp3.179.571,-',3179571],
  ['3 179 571',3179571],
  ['3179571',3179571],
  ['Rp0',0],
  ['Rp 100.000.000',100000000]
 ];
 for(const [input,value] of cases)assert.equal(parseIdrAmount(input),value,'Currency parse failed: '+input);
 const rows=[{id:'1',amount:parseIdrAmount('**Rp3.179.571**'),paid:false,hidden:false},
             {id:'2',amount:parseIdrAmount('Rp 125.000'),paid:true,hidden:false}];
 assert.equal(summary(rows).total,3304571);
 assert.equal(summary(rows).due,3179571);
 assert.equal(summary(rows).paid,125000);
});

test('reject invalid or ambiguous pasted money instead of silently concatenating values',()=>{
 for(const value of [
  '3.179.571,75','Rp3.179.571 Rp100.000','1.234.56',
  '-Rp 500','Rp','Rp3.179.571xx','Rp1,2',
  'Rp 10.000,50','100000000000001','','abc',null
 ])assert.equal(parseIdrAmount(value),null,'Should reject: '+value);
});
