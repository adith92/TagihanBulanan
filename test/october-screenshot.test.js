import test from 'node:test';
import assert from 'node:assert/strict';
import {alignOctoberWithScreenshot2026} from '../lib/october-migration.js';

const excluded=new Set([5,7,10,19,28,29,31]);
function setup(){
  const month=(ym)=>Array.from({length:31},(_,i)=>{
    const n=i+1;return {
      id:ym+'-'+n,templateId:'tmpl-'+n,sourceRow:n,sourceSheet:ym==='2026-10'?'Oktober 2026':'September 2026',
      categoryId:'cat-1',name:'Fiktif '+n,number:'TEST-'+n,
      amount:excluded.has(n)?(n===5?2581448:0):100,
      notes:'',platform:'Test',paid:false,printed:false,hidden:false
    };
  });
  const seed={schema:2,revision:1,months:{'2026-09':month('2026-09'),'2026-10':month('2026-10')},
    templates:Array.from({length:31},(_,i)=>({id:'tmpl-'+(i+1),categoryId:'cat-1',name:'Fiktif '+(i+1),number:'TEST-'+(i+1),platform:'Test',active:true,createdYm:'2026-10'}))};
  return {seed,live:structuredClone(seed)};
}
test('owner screenshot keeps exactly 24 visible rows; September and all numeric values remain intact',()=>{
  const {seed,live}=setup();const before=structuredClone(live);
  const result=alignOctoberWithScreenshot2026(live,seed);
  assert.equal(result.status,'applied');assert.equal(result.changed,true);
  assert.equal(result.hiddenRows,7);assert.equal(result.archivedTemplates,7);
  assert.equal(result.visibleRows,24);assert.equal(result.visibleTotal,2400);
  assert.deepEqual(live,before);
  assert.deepEqual(result.state.months['2026-09'],before.months['2026-09']);
  assert.equal(result.state.months['2026-10'].length,31);
  assert.equal(result.state.months['2026-10'].find(r=>r.sourceRow===5).amount,2581448);
});
test('user-edited October row is preserved, never deleted or hidden',()=>{
  const {seed,live}=setup();
  live.months['2026-10'][4].amount=900000;
  const result=alignOctoberWithScreenshot2026(live,seed);
  assert.equal(result.status,'applied-partial');
  assert.equal(result.hiddenRows,6);
  assert.equal(result.preservedEdited,1);
  assert.equal(result.visibleRows,25);
  assert.equal(result.state.months['2026-10'][4].amount,900000);
  assert.equal(result.state.months['2026-10'][4].hidden,false);
  assert.equal(result.state.templates[4].active,true);
});
test('reconciliation is idempotent; never creates duplicates',()=>{
  const {seed,live}=setup();
  const first=alignOctoberWithScreenshot2026(live,seed);
  const second=alignOctoberWithScreenshot2026(first.state,seed);
  assert.equal(second.changed,false);
  assert.equal(second.status,'already-aligned');
  assert.equal(second.visibleRows,24);
  assert.equal(second.hiddenRows,0);
  assert.equal(second.alreadyHidden,7);
});
test('does not archive a template already used in newer periods',()=>{
  const {seed,live}=setup();
  live.months['2026-11']=[{id:'new',templateId:'tmpl-5',hidden:false,amount:44}];
  const corrected=alignOctoberWithScreenshot2026(live,seed);
  assert.equal(corrected.state.templates[4].active,true);
});
test('invalid source markers abort without mutation',()=>{
  const {seed,live}=setup();
  seed.months['2026-10'][4].sourceRow=123;
  const result=alignOctoberWithScreenshot2026(live,seed);
  assert.equal(result.status,'skipped');
  assert.equal(result.changed,false);
});
