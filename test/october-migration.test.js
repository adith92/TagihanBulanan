import test from 'node:test';
import assert from 'node:assert/strict';
import {resetCopiedOctober2026} from '../lib/october-migration.js';
const mk=(sheet,id)=>({id,templateId:'t1',categoryId:'cat-1',name:'Tagihan contoh',number:'001234',amount:250000,platform:'Blibli',paid:true,printed:true,hidden:false,notes:'',sourceSheet:sheet,paidAt:null,printedAt:null});
const state=()=>({schema:2,revision:1,categories:[],templates:[],months:{'2026-09':[mk('September','sep')],'2026-10':[mk('Oktober','oct')]}});
test('Oktober clone reset paid/printed, preserve September and amount',()=>{const original=state(),result=resetCopiedOctober2026(original);assert.equal(result.status,'applied');assert.equal(result.rowCount,1);assert.equal(result.state.months['2026-10'][0].paid,false);assert.equal(result.state.months['2026-10'][0].printed,false);assert.equal(result.state.months['2026-10'][0].amount,250000);assert.equal(original.months['2026-09'][0].paid,true);assert.equal(original.months['2026-10'][0].paid,true);});
test('Different October amount prevents destructive migration',()=>{const original=state();original.months['2026-10'][0].amount+=1;assert.equal(resetCopiedOctober2026(original).status,'skipped');});
