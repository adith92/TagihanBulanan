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
