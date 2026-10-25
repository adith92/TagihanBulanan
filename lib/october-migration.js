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
