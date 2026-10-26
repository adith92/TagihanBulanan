/** One-time, guarded and reversible migration for the duplicated October 2026 sheet.
 * Returns a new state only if every September/October entry still matches.
 * Never overwrite an October 2026 month that has already been edited.
 */
export function resetCopiedOctober2026(state){
  const september=state?.months?.['2026-09'];
  const october=state?.months?.['2026-10'];
  if(!Array.isArray(september)||!Array.isArray(october)||september.length!==october.length||!september.length){
    return {status:'skipped',reason:'Jumlah baris September/Oktober tidak cocok atau tidak tersedia'};
  }
  // The original Numbers file copied these fields row by row. Reject even one mismatch.
  const fields=['categoryId','name','number','templateId','amount','platform','paid','printed','hidden','notes'];
  for(let i=0;i<september.length;i++){
    const sept=september[i],oct=october[i];
    if(!oct || !sept || !fields.every(field=>sept[field]===oct[field]) || !/^oktober/i.test(String(oct.sourceSheet||''))){
      return {status:'skipped',reason:`Bulan Oktober sudah berbeda dengan September di baris ${i+1}; pembaruan otomatis dibatalkan untuk melindungi catatan pengguna`};
    }
  }
  const result=structuredClone(state);
  for(let i=0;i<october.length;i++){
    const row=result.months['2026-10'][i];
    row.amount=september[i].amount;
    row.platform=september[i].platform;
    row.paid=false;
    row.printed=false;
    row.paidAt=null;
    row.printedAt=null;
    row.notes=row.notes||'';
  }
  return {status:'applied',rowCount:october.length,priorPaid:october.filter(r=>r.paid).length,priorPrinted:october.filter(r=>r.printed).length,state:result};
}

/** If an October row has already been edited, leave that row alone.
 * Reset only original, untouched October rows using the verified Numbers seed.
 */
export function resetUntouchedOctober2026(liveState,seedState){
  const seedSep=seedState?.months?.['2026-09'];
  const seedOct=seedState?.months?.['2026-10'];
  const liveOct=liveState?.months?.['2026-10'];
  if(!Array.isArray(seedSep)||!Array.isArray(seedOct)||!Array.isArray(liveOct)||seedSep.length!==seedOct.length||!seedSep.length){
    return {status:'skipped',reason:'Periode sumber tidak valid'};
  }
  const matchFields=['categoryId','name','number','templateId','amount','platform','paid','printed','hidden','notes','recurring'];
  const copyFields=['categoryId','name','number','templateId','amount','platform','paid','printed'];
  const baseline=new Map(seedOct.map((row,i)=>[row.id,{row,i}]));
  const result=structuredClone(liveState);
  let resetRows=0,editedRows=0,resetPaid=0,resetPrinted=0;
  for(const row of result.months['2026-10']){
    const baselineRow=baseline.get(row.id);
    if(!baselineRow){editedRows++;continue;}
    const {row:source,i}=baselineRow,sep=seedSep[i];
    const unchanged=matchFields.every(f=>row[f]===source[f]);
    const copied=copyFields.every(f=>source[f]===sep[f]);
    if(!unchanged||!copied){editedRows++;continue;}
    if(row.paid)resetPaid++;
    if(row.printed)resetPrinted++;
    row.amount=sep.amount;
    row.platform=sep.platform;
    row.paid=false;
    row.printed=false;
    row.paidAt=null;
    row.printedAt=null;
    resetRows++;
  }
  if(!resetRows)return {status:'skipped',reason:'Tidak ada baris Oktober yang masih merupakan salinan asli',editedRows};
  return {status:editedRows?'applied-partial':'applied',resetRows,editedRows,resetPaid,resetPrinted,state:result};
}


/**
 * Reconcile only the seven October rows that are absent from the screenshot
 * provided by the owner on 27 Oct 2026. They existed in the Numbers extraction
 * but are not visible in the owner's October sheet screenshot.
 *
 * Non-destructive: mark matched rows as hidden instead of deleting them, and
 * preserve an entire pre-change state in tracker_migration_audit (server side).
 * September and all other historic periods are NEVER changed.
 */
export function alignOctoberWithScreenshot2026(liveState,seedState){
  const seedRows=seedState?.months?.['2026-10'];
  const liveRows=liveState?.months?.['2026-10'];
  if(!Array.isArray(seedRows)||!Array.isArray(liveRows))
    return {status:'skipped',reason:'Sumber Oktober tidak tersedia',changed:false};
  // sourceRow is 1-based as imported from the owner's Numbers document.
  // Pair it with the original immutable source ID to avoid false matches.
  // Row positions from the screenshot comparison. Customer identifiers remain
  // only in the encrypted private seed and PostgreSQL, never in public GitHub.
  const excludedSourceRows=[5,7,10,19,28,29,31];
  const originals=excludedSourceRows.map(sourceRow=>
    seedRows.find(r=>r.sourceRow===sourceRow&&/^oktober 2026$/i.test(String(r.sourceSheet??'')))
  );
  if(originals.some(r=>!r))
    return {status:'skipped',reason:'Penanda 7 baris sumber tidak cocok dengan impor awal',changed:false};
  const next=structuredClone(liveState);
  const current=next.months['2026-10'];
  const fields=['templateId','categoryId','name','number','amount','platform','notes'];
  let hiddenRows=0,alreadyHidden=0,preservedEdited=0,missingRows=0,archivedTemplates=0;
  const hiddenIds=new Set();
  for(const baseline of originals){
    const row=current.find(r=>r.id===baseline.id);
    if(!row){missingRows++;continue;}
    if(row.hidden){alreadyHidden++;hiddenIds.add(row.templateId);continue;}
    // Protect user edits, even when the edited row originated from the import.
    if(!fields.every(f=>row[f]===baseline[f])||row.paid||row.printed){
      preservedEdited++;continue;
    }
    row.hidden=true;
    hiddenIds.add(row.templateId);
    hiddenRows++;
  }
  for(const templateId of hiddenIds){
    if(!templateId)continue;
    const currentMaster=next.templates.find(t=>t.id===templateId);
    const originalMaster=seedState.templates?.find(t=>t.id===templateId);
    if(!currentMaster||!originalMaster||currentMaster.active===false)continue;
    const masterFields=['categoryId','name','number','platform','createdYm'];
    if(!masterFields.every(f=>currentMaster[f]===originalMaster[f]))continue;
    if(currentMaster.createdYm!=='2026-10')continue;
    // Do not disable a master if the user is already using it in a later month.
    if(Object.entries(next.months).some(([month,rows])=>month>'2026-10'&&rows.some(r=>r.templateId===templateId&&!r.hidden)))continue;
    currentMaster.active=false;
    archivedTemplates++;
  }
  const visible=current.filter(r=>!r.hidden);
  const visibleTotal=visible.reduce((sum,row)=>sum+row.amount,0);
  const changed=hiddenRows>0||archivedTemplates>0;
  return {
    status:changed?(preservedEdited?'applied-partial':'applied'):(preservedEdited?'preserved-user-edits':'already-aligned'),
    changed,state:changed?next:null,hiddenRows,alreadyHidden,preservedEdited,missingRows,archivedTemplates,
    visibleRows:visible.length,visibleTotal,
    septemberRows:liveState.months['2026-09']?.length??null
  };
}


/**
 * Owner confirmation: the seven imported lines are absent from the screenshot,
 * including one line that was edited after import. Hide by original seed IDs,
 * retaining every field, every edit and the full pre-change audit snapshot.
 * This is a visibility change ONLY; no amounts or historical months are edited.
 */
export function enforceOctoberScreenshotVisibility2026(liveState,seedState){
  const originals=seedState?.months?.['2026-10'];
  const current=liveState?.months?.['2026-10'];
  const excludedSourceRows=[5,7,10,19,28,29,31];
  if(!Array.isArray(originals)||!Array.isArray(current))
    return {status:'skipped',reason:'Oktober 2026 tidak tersedia',changed:false};
  const matches=excludedSourceRows.map(n=>
    originals.find(r=>r.sourceRow===n&&/^oktober 2026$/i.test(String(r.sourceSheet??''))));
  if(matches.some(r=>!r))
    return {status:'skipped',reason:'ID sumber Oktober tidak sesuai arsip awal',changed:false};
  const next=structuredClone(liveState);
  const month=next.months['2026-10'];
  let hiddenNow=0,alreadyHidden=0,missing=0,editedHidden=0,templatesArchived=0;
  for(const original of matches){
    const row=month.find(r=>r.id===original.id);
    if(!row){missing++;continue;}
    if(row.hidden){alreadyHidden++;continue;}
    const fields=['name','number','categoryId','amount','platform','notes','templateId'];
    if(!fields.every(field=>row[field]===original[field])||row.paid||row.printed)editedHidden++;
    // The screenshot is authoritative for row VISIBILITY, not the row data.
    row.hidden=true;
    hiddenNow++;
    const template=next.templates.find(t=>t.id===row.templateId);
    const seedTemplate=seedState.templates?.find(t=>t.id===row.templateId);
    if(template?.active!==false&&template&&seedTemplate&&
       template.createdYm==='2026-10'&&
       ['name','number','categoryId','platform'].every(f=>template[f]===seedTemplate[f])&&
       !Object.entries(next.months).some(([ym,rows])=>ym>'2026-10'&&rows.some(r=>r.templateId===template.id&&!r.hidden))){
      template.active=false;
      templatesArchived++;
    }
  }
  const visible=month.filter(r=>!r.hidden);
  return {
    changed:hiddenNow>0||templatesArchived>0,
    status:hiddenNow>0?'applied':'already-aligned',
    state:hiddenNow>0||templatesArchived>0?next:null,
    hiddenNow,alreadyHidden,missing,editedHidden,templatesArchived,
    visibleRows:visible.length,visibleTotal:visible.reduce((v,r)=>v+r.amount,0),
    septemberRows:liveState.months['2026-09']?.length??null
  };
}
