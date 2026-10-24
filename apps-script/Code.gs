/**
 * TAGIHANBULANAN | GOOGLE DRIVE BRIDGE
 * Vercel uses server-to-server HTTPS POST with shared key. Keep deployed URL
 * and BRIDGE_SECRET out of the public repository. Never share the Drive JSON.
 *
 * Script Properties (Project Settings):
 *   DATA_FILE_ID   = exact ID of the imported tagihanbulanan-state.json
 *   BRIDGE_SECRET  = same high-entropy secret as Vercel GDRIVE_BRIDGE_SECRET
 *
 * Deploy > New deployment > Web app
 * Execute as: Me
 * Who has access: Anyone (authenticated by the secret inside POST body).
 */

function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  try {
    const request=JSON.parse(e.postData.contents||'{}');
    const properties=PropertiesService.getScriptProperties();
    const secret=properties.getProperty('BRIDGE_SECRET');
    const fileId=properties.getProperty('DATA_FILE_ID');
    if(!secret||secret.length<32||!fileId) return reply_({ok:false,code:503,error:'Script Properties belum dikonfigurasi'});
    if(typeof request.secret!=='string'||request.secret!==secret) return reply_({ok:false,code:403,error:'Izin API tidak valid'});
    if(request.action!=='read'&&request.action!=='save') return reply_({ok:false,code:405,error:'Aksi tidak didukung'});
    // Read and write under the same script lock. A second Save cannot overwrite
    // another tab without observing the changed revision.
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(25000)) return reply_({ok:false,code:503,error:'File sedang disimpan, coba lagi'});
    try {
      const file=DriveApp.getFileById(fileId);
      const state=JSON.parse(file.getBlob().getDataAsString('UTF-8'));
      if(state.schema!==2||!state.months||!Array.isArray(state.templates))throw new Error('Format sumber bukan state TagihanBulanan v2');
      const revision=Number(state.revision||0);
      if(request.action==='read')return reply_({ok:true,state:state,etag:String(revision)});
      if(String(request.etag)!==String(revision))return reply_({ok:false,code:409,error:'Data sudah berubah di server. Muat ulang sebelum menyimpan.'});
      const next=request.state;
      if(!next||next.schema!==2||!Array.isArray(next.categories)||!Array.isArray(next.templates)||!next.months) return reply_({ok:false,code:400,error:'State tidak valid'});
      const body=JSON.stringify(next);
      if(body.length>9000000)return reply_({ok:false,code:413,error:'Data terlalu besar'});
      next.revision=revision+1;
      next.updatedAt=new Date().toISOString();
      file.setContent(JSON.stringify(next));
      const saved=JSON.parse(file.getBlob().getDataAsString('UTF-8'));
      if(saved.revision!==revision+1)throw new Error('Verifikasi tulis gagal');
      return reply_({ok:true,etag:String(saved.revision),revision:saved.revision,updatedAt:saved.updatedAt});
    } finally {lock.releaseLock();}
  } catch(e){return reply_({ok:false,code:500,error:String(e.message||e)});}
}

// Optional quick authorization test in Apps Script editor: run once as owner.
function testDriveConnection(){
  const id=PropertiesService.getScriptProperties().getProperty('DATA_FILE_ID');
  const state=JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'));
  Logger.log('TagihanBulanan schema='+state.schema+' periods='+Object.keys(state.months||{}).length);
}
