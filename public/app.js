import {blankState,generatePeriod,summary,money,makeId,periodKey} from './model.js';
import {exportRecords,parseCsv} from './export.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
// Always start in the billing month for the application's configured Jakarta timezone.
const nowParts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).formatToParts(new Date()).filter(x=>x.type==='year'||x.type==='month').map(x=>[x.type,x.value]));
let current=periodKey(Number(nowParts.year),Number(nowParts.month));let state=null,persistedState=null,etag=null,dirty=false,online=false,view='bills',query='',filter='all',busy=false,syncConflict=false,localEditVersion=0,saveTimer=null;
const rupiah=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v||0);
const dateLabel=ym=>new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(ym+'-01T12:00:00'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=id=>state.categories.find(c=>c.id===id)?.name||'Lainnya';

// Kolom bisa ditukar dengan drag-and-drop dan diubah lebar dengan handle.
const COLUMN_IDS=['paid','name','amount','platform','printed'];
const COLUMNS={paid:{title:'Sudah',width:78,min:68},name:{title:'Deskripsi / Pelanggan',width:270,min:165},amount:{title:'Tagihan (Rp)',width:176,min:135},platform:{title:'Toko / Platform',width:190,min:140},printed:{title:'Cetak',width:78,min:68}};
function fromStorage(key,fallback){try {return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
let columnOrder=fromStorage('tagihan.columns.v1',COLUMN_IDS);
if(!Array.isArray(columnOrder)||columnOrder.length!==5||new Set(columnOrder).size!==5||columnOrder.some(x=>!COLUMN_IDS.includes(x)))columnOrder=[...COLUMN_IDS];
let widths=fromStorage('tagihan.widths.v1',{});
if(!widths||typeof widths!=='object')widths={};
for(const k of COLUMN_IDS)if(!Number.isFinite(widths[k])||widths[k]<COLUMNS[k].min||widths[k]>630)widths[k]=COLUMNS[k].width;
function storeColumns(){try{localStorage.setItem('tagihan.columns.v1',JSON.stringify(columnOrder));localStorage.setItem('tagihan.widths.v1',JSON.stringify(widths));}catch{}}
function moveColumn(source,target){const a=columnOrder.indexOf(source),b=columnOrder.indexOf(target);if(a<0||b<0||a===b)return;columnOrder.splice(a,1);columnOrder.splice(b,0,source);storeColumns();render();}
const formatIdrInput=v=>rupiah(Number(v)||0);
function parseIdrInput(value){const t=String(value??'').trim();if(!t||t.startsWith('-')||/[a-z]/i.test(t.replace(/^Rp\s*/i,'')))return null;const digits=t.replace(/\D/g,'');const n=Number(digits);return digits&&Number.isSafeInteger(n)&&n<=1e13?n:null;}
function paymentUrl(platform){const x=String(platform||'').toLowerCase();if(x.includes('blibli'))return 'https://www.blibli.com/digital/p/top-up-tagihan';if(x.includes('tokopedia')||x.includes('toko pedia'))return 'https://www.tokopedia.com/top-up-tagihan';return null;}
function paymentLink(platform){const url=paymentUrl(platform);return url?`<a class="payment-link" href="${url}" target="_blank" rel="noopener noreferrer" title="Buka pembayaran ${esc(platform)}">🔗 Bayar di ${url.includes('blibli')?'Blibli':'Tokopedia'} ↗</a>`:'';}
function colHeader(key){const x=COLUMNS[key];return `<th class="col-head" draggable="true" data-col="${key}" style="width:${widths[key]}px" title="Tarik judul untuk memindahkan kolom"><span class="col-title">☷ ${x.title}</span><span class="resize-grip" data-resize="${key}" title="Tarik untuk mengubah lebar kolom" aria-label="Ubah lebar kolom ${x.title}"></span></th>`;}
// Copy a customer/payment code with a single tap. Preserve leading zeros.
function copyNumberControl(record,source='bill'){
  const number=String(record?.number??'').trim();
  if(!number)return '<span class="muted-small">Nomor: —</span>';
  return `<button type="button" class="copy-number" data-action="copyNumber" data-source="${source}" data-id="${esc(record.id)}" aria-label="Salin nomor pelanggan ${esc(number)}" title="Klik untuk menyalin nomor"><span class="copy-number-text">Nomor: <b>${esc(number)}</b></span><span class="copy-number-icon" aria-hidden="true">⧉</span><span class="copy-number-hint" aria-hidden="true">Salin</span></button>`;
}
async function writeCustomerNumber(number){
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(number);return true;}catch{}
  }
  // Fallback for older iOS Safari and WebViews where Clipboard API is unavailable.
  const previous=document.activeElement,area=document.createElement('textarea');
  area.value=number;area.setAttribute('readonly','');
  area.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;font-size:16px';
  document.body.appendChild(area);
  let copied=false;
  try{area.focus();area.select();area.setSelectionRange(0,number.length);copied=!!document.execCommand?.('copy');}
  catch{}finally{area.remove();try{previous?.focus?.({preventScroll:true});}catch{}}
  return copied;
}
function colCell(r,key){if(key==='paid')return `<td class="check-col"><input aria-label="Sudah dibayar" type="checkbox" data-field="paid" ${r.paid?'checked':''}/></td>`;if(key==='name')return `<td><input class="customer" type="text" data-field="name" value="${esc(r.name)}" aria-label="Nama tagihan"/>${copyNumberControl(r)}</td>`;if(key==='amount')return `<td class="money-col"><input class="idr-input" type="text" inputmode="numeric" autocomplete="off" data-field="amount" value="${esc(formatIdrInput(r.amount))}" aria-label="Tagihan dalam rupiah"/></td>`;if(key==='platform')return `<td class="store-col"><input type="text" data-field="platform" value="${esc(r.platform)}" placeholder="Blibli / Tokopedia" aria-label="Platform bayar"/>${paymentLink(r.platform)}</td>`;if(key==='printed')return `<td class="check-col"><input aria-label="Bukti sudah dicetak" type="checkbox" data-field="printed" ${r.printed?'checked':''}/></td>`;return '';}

function toast(m){const t=$('#toast');t.textContent=m;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),4200);}
function setSync(){const b=$('#syncBadge');if(!b)return;b.textContent=!online?'PostgreSQL tidak tersedia':syncConflict?'⚠ Konflik perubahan':busy?'⟳ Menyimpan...':dirty?'● Menunggu sinkronisasi':'✓ Tersinkron ke PostgreSQL';$('.live-dot')?.classList.toggle('danger',!online||syncConflict);}
function scheduleSync(delay=1400){clearTimeout(saveTimer);if(!online||syncConflict)return;saveTimer=setTimeout(()=>{if(dirty&&!busy)save(true);else if(dirty&&busy)scheduleSync(1000);},delay);}

async function api(path,opts={}){const r=await fetch(`/api/${path}`,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...opts});const x=await r.json().catch(()=>({error:'Gagal membaca server'}));if(!r.ok)throw Object.assign(new Error(x.error||`HTTP ${r.status}`),{status:r.status});return x;}
async function boot(){try{const ses=await api('session');if(ses.authenticated)await enter();else{$('#login').classList.remove('hidden');$('#loginError').textContent=ses.configured?'':'Server belum memiliki password admin.';}}catch(e){$('#login').classList.remove('hidden');$('#loginError').textContent=e.message;}}
async function enter(){$('#login').classList.add('hidden');$('#shell').classList.remove('hidden');await reload();}
async function reload(){try{const reply=await api('state');state=reply.state;persistedState=structuredClone(state);etag=reply.etag;online=true;dirty=false;syncConflict=false;localEditVersion=0;}catch(e){online=false;etag=null;state=blankState();persistedState=structuredClone(state);toast('Koneksi PostgreSQL belum siap. '+e.message);}setSync();render();}
function markDirty(){dirty=true;localEditVersion++;setSync();scheduleSync();}
function discardDraft(){if(dirty){state=structuredClone(persistedState);dirty=false;clearTimeout(saveTimer);setSync();}}
function ensureMonth(){if(!state.months[current]){state.months[current]=generatePeriod(state,current);if(online)markDirty();}}
function changeMonth(shift){if(dirty){if(!confirm('Ada perubahan yang belum disimpan. Pindah bulan tanpa menyimpan?'))return;discardDraft();}const d=new Date(current+'-01T12:00:00');d.setMonth(d.getMonth()+shift);current=periodKey(d.getFullYear(),d.getMonth()+1);dirty=false;render();}
function chooseMonth(ym){if(dirty){if(!confirm('Ada perubahan yang belum disimpan. Pindah tanpa menyimpan?')){render();return;}discardDraft();}current=ym;dirty=false;render();}
function closeMobileMenu(){const sidebar=$('#sidebar');sidebar.classList.remove('open');$('#mobileMenu')?.setAttribute('aria-expanded','false');$('#navBackdrop')?.classList.remove('open');document.body.classList.remove('mobile-drawer-open');}
function openMobileMenu(){const sidebar=$('#sidebar');sidebar.classList.add('open');$('#mobileMenu')?.setAttribute('aria-expanded','true');$('#navBackdrop')?.classList.add('open');document.body.classList.add('mobile-drawer-open');}
function updateNav(){ $$('#nav [data-page],#mobileBottomNav [data-page]').forEach(b=>{const active=b.dataset.page===view;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}); }
function navigate(p){if(dirty){if(!confirm('Ada perubahan belum disimpan. Tetap pindah menu?'))return;discardDraft();}view=p;updateNav();$('#crumbPage').textContent=({dashboard:'Dashboard',bills:'Tagihan Bulanan',masters:'Master Tagihan',history:'Riwayat',io:'Impor & Ekspor',settings:'Pengaturan'})[p];closeMobileMenu();render();window.scrollTo(0,0);}
function boxStats(rows){const s=summary(rows);return `<div class="stats"><div class="stat"><div class="s-top"><span>Total Tagihan</span><span class="s-icon">▤</span></div><b>${rupiah(s.total)}</b><small>${s.count} baris tagihan</small></div><div class="stat"><div class="s-top"><span>Sudah Dibayar</span><span class="s-icon">✓</span></div><b class="accent-green">${rupiah(s.paid)}</b><small>${s.paidCount} tagihan lunas</small></div><div class="stat"><div class="s-top"><span>Belum Dibayar</span><span class="s-icon">◷</span></div><b class="accent-red">${rupiah(s.due)}</b><small>${s.unpaidCount} tagihan belum lunas</small></div><div class="stat"><div class="s-top"><span>Bukti Belum Dicetak</span><span class="s-icon">▣</span></div><b>${s.unprintedCount}</b><small>Tagihan lunas, bukti belum cetak</small></div></div>`;}
function hero(title,subtitle,buttons=''){return `<div class="page-title"><div><p class="eyebrow">TAGIHAN BULANAN / WORKSPACE</p><h1>${title}</h1><p>${subtitle}</p></div><div class="actions">${buttons}</div></div>`;}
function warning(){return !online?'<div class="alert error"><strong>⚠</strong><div><b>PostgreSQL Render belum terhubung.</b><div style="font-size:12px">Aplikasi tidak menampilkan angka contoh. Data asli 2.440 tagihan dari 83 bulan telah dipersiapkan untuk impor otomatis ketika DATABASE_URL tersedia. Tidak ada Google Apps Script.</div></div></div>':'';}
function periodPicker(){const periods=new Set([...Object.keys(state.months),current]);const d=new Date(current+'-01T12:00:00');for(let n=-12;n<=12;n++){const x=new Date(d);x.setMonth(x.getMonth()+n);periods.add(periodKey(x.getFullYear(),x.getMonth()+1));}return `<div class="period-nav"><button data-action="prev" title="Bulan sebelumnya" aria-label="Bulan sebelumnya">‹</button><select id="periodSelect" aria-label="Pilih bulan tagihan">${[...periods].sort().reverse().map(x=>`<option value="${x}" ${x===current?'selected':''}>${dateLabel(x)}</option>`).join('')}</select><button data-action="next" title="Bulan berikutnya" aria-label="Bulan berikutnya">›</button></div>`;}
function billFields(r){return `<tr data-row="${esc(r.id)}">${columnOrder.map(key=>colCell(r,key)).join('')}<td class="act-col"><div class="row-buttons"><button type="button" class="row-edit" data-action="editRow" data-id="${esc(r.id)}" title="Edit tagihan" aria-label="Edit tagihan ${esc(r.name)}">✏️</button><button class="delete-btn" data-action="deleteRow" data-id="${esc(r.id)}" title="Hapus baris dari bulan ini">×</button></div></td></tr>`;}
function mobileBill(r){const rid=esc(r.id);return `<article class="mobile-bill" data-row="${rid}" aria-label="Tagihan ${esc(r.name)}"><div class="bill-top"><div class="mobile-name-wrap"><label class="mobile-overline" for="mobile-name-${rid}">Pelanggan / Tagihan</label><input id="mobile-name-${rid}" class="mobile-name field" data-field="name" type="text" value="${esc(r.name)}" aria-label="Nama pelanggan atau tagihan"/>${copyNumberControl(r)}</div><div class="mobile-row-actions"><button type="button" class="row-edit mobile-edit" data-action="editRow" data-id="${rid}" aria-label="Edit tagihan ${esc(r.name)}" title="Edit tagihan">✏️</button><button class="delete-btn mobile-delete" data-action="deleteRow" data-id="${rid}" aria-label="Hapus tagihan ${esc(r.name)}" title="Hapus tagihan">✕</button></div></div><div class="bill-bottom"><div class="mobile-field"><label for="mobile-amount-${rid}">Tagihan (Rp)</label><input id="mobile-amount-${rid}" class="field idr-input" data-field="amount" type="text" inputmode="numeric" autocomplete="off" value="${esc(formatIdrInput(r.amount))}"/></div><div class="mobile-field"><label for="mobile-store-${rid}">Toko / Platform</label><input id="mobile-store-${rid}" class="field" data-field="platform" type="text" value="${esc(r.platform)}" placeholder="Blibli / Tokopedia"/>${paymentLink(r.platform)}</div></div><div class="mobile-status-row"><label class="mobile-toggle"><input data-field="paid" aria-label="Tandai sudah dibayar" type="checkbox" ${r.paid?'checked':''}/><span>✓ Sudah bayar</span></label><label class="mobile-toggle"><input data-field="printed" aria-label="Tandai bukti sudah dicetak" type="checkbox" ${r.printed?'checked':''}/><span>🖨 Bukti dicetak</span></label></div></article>`;}

function renderBills(){ensureMonth();const rows=state.months[current],visible=rows.filter(r=>!r.hidden);const cats=state.categories.filter(c=>visible.some(r=>r.categoryId===c.id));const search=visible.filter(r=>(r.name+' '+r.number+' '+r.platform).toLowerCase().includes(query.toLowerCase())).filter(r=>filter==='all'||(filter==='paid'&&r.paid)||(filter==='due'&&!r.paid)||(filter==='unprinted'&&r.paid&&!r.printed));
let html=hero('Tagihan Bulanan',`Kelola pembayaran untuk ${dateLabel(current)} dan tersinkron otomatis ke PostgreSQL.`,`<button class="btn" data-action="exportXlsx">⇩ Export Excel</button><button class="btn primary" data-action="save" ${!online||!dirty||busy?'disabled':''}>▣ Save</button>`)+warning()+boxStats(visible);
html+=`<div class="panel"><div class="toolbar"><div class="left">${periodPicker()}<input id="searchInput" class="text-input" type="search" placeholder="⌕ Cari nama / nomor pelanggan" value="${esc(query)}"/><select id="filterSelect" class="field"><option value="all" ${filter==='all'?'selected':''}>Semua status</option><option value="paid" ${filter==='paid'?'selected':''}>Sudah dibayar</option><option value="due" ${filter==='due'?'selected':''}>Belum dibayar</option><option value="unprinted" ${filter==='unprinted'?'selected':''}>Bukti belum dicetak</option></select></div><div class="actions"><button class="btn small" data-action="addCategory">＋ Kategori</button><button class="btn small" data-action="addRow">＋ Tambah Baris</button></div></div>`;
html+='<div id="billResults" aria-live="polite">';
if(!search.length) html+='<div class="skeleton">Belum ada tagihan yang cocok. Klik Tambah Baris untuk memulai.</div>';
html+='<p class="col-help">↔️ Tarik judul kolom untuk mengurutkan, tarik tepi kanan untuk mengubah lebarnya. Pengaturan kolom tersimpan di perangkat ini.</p>';
for(const cat of cats){const group=search.filter(r=>r.categoryId===cat.id);if(!group.length)continue;html+=`<section class="category"><div class="category-title"><h3>${esc(cat.name)} <span>${group.length} baris</span></h3><strong>${rupiah(group.reduce((n,r)=>n+r.amount,0))}</strong></div><div class="table-scroll"><table class="bill-table" style="min-width:${columnOrder.reduce((n,k)=>n+widths[k],0)+110}px"><colgroup>${columnOrder.map(k=>`<col data-col="${k}" style="width:${widths[k]}px">`).join('')}<col style="width:110px"></colgroup><thead><tr>${columnOrder.map(colHeader).join('')}<th class="act-col">Aksi</th></tr></thead><tbody>${group.map(billFields).join('')}</tbody></table></div>${group.map(mobileBill).join('')}</section>`;}
html+='</div>';html+=`<div class="panel-foot"><span>${visible.length} tagihan dalam periode ini</span><div class="summary-strip"><span>Total <b>${rupiah(summary(visible).total)}</b></span><span>Belum dibayar <b>${rupiah(summary(visible).due)}</b></span></div></div></div><p class="footer-note">Perubahan tersimpan otomatis setelah berhenti mengedit sebentar; tombol Save tetap tersedia. Status Sudah dan Cetak tidak diwariskan ke bulan baru.</p>`;return html;}
function renderDashboard(){ensureMonth();const rows=state.months[current];const cats=state.categories.map(cat=>{const group=rows.filter(r=>!r.hidden&&r.categoryId===cat.id);return {cat,...summary(group)};}).filter(x=>x.count);let html=hero('Ringkasan Tagihan',`Pantau pembayaran ${dateLabel(current)} secara menyeluruh.`,`<button class="btn primary" data-action="gotoBills">Lihat Tagihan →</button>`)+warning()+boxStats(rows);html+=`<div class="grid-two"><div class="panel"><div class="panel-head"><h3>Pengeluaran per Kategori</h3><span class="muted">${dateLabel(current)}</span></div>${cats.map(x=>`<div class="list-row"><div style="flex:1"><strong>${esc(x.cat.name)}</strong><div class="progress"><div style="width:${summary(rows).total?Math.round(x.total/summary(rows).total*100):0}%"></div></div></div><div style="text-align:right"><b>${rupiah(x.total)}</b><div class="muted-small">${x.count} tagihan</div></div></div>`).join('')||'<div class="skeleton">Belum ada kategori aktif.</div>'}</div><div class="panel"><div class="panel-head"><h3>Aktivitas Bulanan</h3></div>${Object.keys(state.months).sort().reverse().slice(0,7).map(ym=>`<div class="list-row"><div><b>${dateLabel(ym)}</b><div class="muted-small">${state.months[ym].length} entri</div></div><strong>${rupiah(summary(state.months[ym]).total)}</strong></div>`).join('')}</div></div>`;return html;}
function renderMasters(){const templates=state.templates.filter(t=>t.active!==false);return hero('Master Tagihan','Daftar pelanggan yang otomatis dibuat ulang tiap bulan.',`<button class="btn primary" data-action="addRow">＋ Tambah Tagihan</button>`)+warning()+`<div class="panel"><div class="panel-head"><h3>${templates.length} tagihan berulang aktif</h3></div><div class="master-table-wrap"><table class="data-table master-table"><thead><tr><th>Kategori</th><th>Nama</th><th>Nomor Pelanggan</th><th>Platform</th><th>Aksi</th></tr></thead><tbody>${templates.map(t=>`<tr><td data-label="Kategori">${esc(N(t.categoryId))}</td><td data-label="Nama">${esc(t.name)}</td><td data-label="Nomor Pelanggan">${copyNumberControl(t,'template')}</td><td data-label="Platform">${esc(t.platform||'')}</td><td data-label="Aksi"><div class="master-actions"><button class="btn small" data-action="editTemplate" data-id="${esc(t.id)}">✏️ Edit</button><button class="btn small" data-action="archiveTemplate" data-id="${esc(t.id)}">Arsipkan</button></div></td></tr>`).join('')}</tbody></table></div></div>`;}
function renderHistory(){const months=Object.keys(state.months).sort().reverse();return hero('Riwayat Pembayaran','Semua bulan lama tetap tersimpan sebagai snapshot terpisah.',`<button class="btn" data-action="exportAll">⇩ Export Semua</button>`)+warning()+`<div class="panel"><div class="panel-head"><h3>Periode Tersimpan</h3><span class="muted">${months.length} bulan</span></div><div class="period-grid">${months.map(ym=>`<button class="period-card" data-action="openPeriod" data-ym="${ym}"><strong>${dateLabel(ym)}</strong><small>${state.months[ym].length} tagihan</small><small>${rupiah(summary(state.months[ym]).total)}</small></button>`).join('')}</div></div>`;}
function renderIO(){return hero('Impor & Ekspor','Bawa data keluar atau impor hasil ekspor dari Apple Numbers dan Excel.')+warning()+`<div class="grid-two"><div class="panel"><div class="panel-head"><h3>Impor Tagihan</h3></div><div class="io-drop"><div class="big">⇧</div><h3>Import CSV atau Excel</h3><p>Pilih file .csv atau .xlsx hasil ekspor Numbers / Excel. Pratinjau data disiapkan sebelum mengubah riwayat. Format .numbers native perlu diekspor ke Excel terlebih dulu.</p><button class="btn primary" data-action="import">Pilih File</button><div id="importPreview" class="muted-small"></div></div><div class="print-hint">Riwayat 2.440 tagihan dari Apple Numbers telah disiapkan dalam seed terenkripsi untuk PostgreSQL. Impor awal dijalankan otomatis satu kali saat database tersambung.</div></div><div class="panel"><div class="panel-head"><h3>Export Spreadsheet</h3></div><div style="padding:20px"><p class="muted" style="line-height:1.8;margin-bottom:19px">File Excel bisa langsung dibuka di Microsoft Excel dan Apple Numbers. Format CSV cocok untuk transfer data sederhana. Kolom nomor pelanggan dijaga sebagai teks.</p><div class="form-grid"><div><label>Periode</label><select class="field" id="exportPeriod"><option value="all">Semua periode</option>${Object.keys(state.months).sort().reverse().map(ym=>`<option value="${ym}" ${ym===current?'selected':''}>${dateLabel(ym)}</option>`).join('')}</select></div><div><label>Format</label><select class="field" id="exportFormat"><option value="xlsx">Excel (.xlsx) / Numbers</option><option value="csv">CSV (.csv)</option></select></div></div><button class="btn primary" style="margin-top:22px" data-action="doExport">⇩ Download File</button></div></div></div>`;}
function renderSettings(){return hero('Pengaturan','Manajemen kategori dan status sistem.')+warning()+`<div class="grid-two"><div class="panel"><div class="panel-head"><h3>Kategori Tagihan</h3><button class="btn small" data-action="addCategory">＋ Kategori</button></div>${state.categories.map(c=>`<div class="list-row"><span>${esc(c.name)} ${c.active===false?'(diarsipkan)':''}</span><div class="actions"><button class="btn small" data-action="renameCategory" data-id="${esc(c.id)}">Ubah</button><button class="btn small" data-action="archiveCategory" data-id="${esc(c.id)}">${c.active===false?'Aktifkan':'Arsipkan'}</button></div></div>`).join('')}</div><div class="panel"><div class="panel-head"><h3>Keamanan & Penyimpanan</h3></div><div style="padding:20px;line-height:2"><p>🗄️ Database: <b>${online?'Render PostgreSQL':'Belum terhubung'}</b></p><p>🔓 Login: <b>Tanpa kata sandi (sesuai permintaan). Siapa pun dengan URL dapat mengakses data.</b></p><p>📅 Zona waktu: <b>Asia/Jakarta</b></p><p>📦 Riwayat: <b>${Object.keys(state.months).length} bulan</b></p><p>🔄 Versi data: <b>${state.revision}</b></p><p>💾 Mode Save: <b>Otomatis + tombol Save</b></p><button class="btn" data-action="exportAll" style="margin-top:16px">Unduh Backup Excel</button></div></div><section class="panel install-guide"><div class="panel-head"><h3>📲 Pasang di layar utama HP</h3></div><div class="install-content"><p><b>Android:</b> buka situs di Chrome atau Samsung Internet → menu <b>⋮</b> → <b>Install app</b> / <b>Add to Home screen</b>.</p><p><b>iPhone/iPad:</b> buka situs di Safari → tombol <b>Bagikan</b> → <b>Tambah ke Layar Utama</b>.</p><p class="muted">Ikon aplikasi bisa dipasang, tetapi transaksi tetap membutuhkan internet agar tersimpan ke PostgreSQL. Data pribadi tidak dicache oleh mode aplikasi.</p></div></section></div>`;}
function render(){if(!state)return;setSync();updateNav();const main=$('#main');if(!online){main.innerHTML=`<div class="page">${hero('Menyiapkan data riwayat','Data historis tidak akan diisi nol atau diganti contoh. Seluruhnya akan tampil sesudah PostgreSQL tersambung.')} ${warning()}<div class="panel" style="padding:28px;line-height:1.8"><h3>📚 Arsip asli sudah siap dipulihkan</h3><p>83 periode • 2.440 tagihan • 71 master • 6 kategori</p><p class="muted">Sumber: Tagihan Listrik Sekolahan.numbers, November 2019 sampai Oktober 2026. Penyimpanan melalui PostgreSQL Render, bukan Google Apps Script.</p><button class="btn primary" data-action="retry" style="margin-top:20px">↻ Coba muat ulang data</button></div></div>`;return;}main.innerHTML=`<div class="page">${({dashboard:renderDashboard,bills:renderBills,masters:renderMasters,history:renderHistory,io:renderIO,settings:renderSettings})[view]()}</div>`;}
function getRow(id){return (state.months[current]||[]).find(x=>x.id===id);}
function addCategory(){const name=prompt('Nama kategori baru:')?.trim();if(!name)return;if(state.categories.some(c=>c.name.toLowerCase()===name.toLowerCase()))return toast('Kategori sudah ada');state.categories.push({id:makeId(),name,active:true,order:state.categories.length});markDirty();render();}
function addRow(){ensureMonth();const name=prompt('Nama pelanggan/tagihan baru:')?.trim();if(!name)return;const number=(prompt('Nomor pelanggan (boleh kosong):')??'').trim();const cats=state.categories.filter(c=>c.active!==false);const input=prompt(`Pilih kategori (ketik angka):\n${cats.map((c,i)=>`${i+1}. ${c.name}`).join('\n')}`,'1');const category=cats[Number(input)-1];if(!category)return toast('Kategori tidak valid');if(isDuplicateNumber(state.months[current],null,category.id,name,number)||isDuplicateNumber(state.templates,null,category.id,name,number))return toast('Data pelanggan ini sudah ada. Gunakan tombol pensil untuk mengubahnya.');const recurring=confirm('Tagihan ini berulang setiap bulan?\nOK = berulang, Cancel = hanya bulan ini');const templateId=recurring?makeId():null;const row={id:makeId(),templateId,categoryId:category.id,categoryName:category.name,name,number,amount:0,platform:'',paid:false,printed:false,paidAt:null,printedAt:null,recurring,hidden:false,notes:''};state.months[current].push(row);if(recurring)state.templates.push({id:templateId,categoryId:category.id,name,number,platform:'',active:true,createdYm:current});markDirty();view='bills';render();}
async function save(automatic=false){if(!online||!dirty||busy||syncConflict)return;clearTimeout(saveTimer);busy=true;setSync();const snapshot=structuredClone(state);const editVersion=localEditVersion;
try{const saved=await api('state',{method:'PUT',body:JSON.stringify({state:snapshot,etag})});etag=saved.etag;snapshot.revision=saved.revision;snapshot.updatedAt=saved.updatedAt;persistedState=structuredClone(snapshot);state.revision=saved.revision;state.updatedAt=saved.updatedAt;if(editVersion===localEditVersion){dirty=false;if(!automatic)toast('✓ Perubahan berhasil disimpan ke PostgreSQL');}else{dirty=true;scheduleSync(900);}}
catch(e){if(e.status===409){syncConflict=true;toast('⚠ Konflik versi! Data pada tab ini belum disimpan. Jangan refresh; gunakan Save setelah menyelesaikan konflik.');}else{toast('Sinkronisasi gagal: '+e.message);scheduleSync(9000);}}
finally{busy=false;setSync();if(!automatic)render();}}

function updateField(el){const row=getRow(el.closest('[data-row]')?.dataset.row);if(!row)return;const f=el.dataset.field;if(!['paid','printed','name','amount','platform'].includes(f))return;let v=el.type==='checkbox'?el.checked:el.value;
if(f==='amount'){v=parseIdrInput(v);if(v===null){el.value=formatIdrInput(row.amount);toast('Masukkan nominal rupiah valid (tanpa angka negatif).');return;}el.value=formatIdrInput(v);}
if(row[f]===v)return;
if((f==='paid'||f==='printed')){row[f+'At']=v?new Date().toISOString():null;}row[f]=v;
// Inline edits affect this month's row only; the pencil editor controls master updates explicitly.
markDirty();if(el.type==='checkbox'||f==='platform'){render();}}


/** Single editor for current-period bills and recurring master records. Past months stay unchanged. */
let editingRecord=null;
const editDialog=()=>$('#editDialog');
const editValue=key=>$('#editForm').elements.namedItem(key);
function editError(message=''){
  const box=$('#editError');
  box.textContent=message;
  box.classList.toggle('hidden',!message);
}
function isDuplicateNumber(rows,id,categoryId,name,number){
  const trimmed=String(number??'').trim();
  if(!trimmed)return false;
  const label=String(name??'').trim().toLocaleLowerCase('id');
  return rows.some(r=>r.id!==id&&r.active!==false&&!r.hidden&&r.categoryId===categoryId&&String(r.number??'').trim()===trimmed&&String(r.name??'').trim().toLocaleLowerCase('id')===label);
}
function openRecordEditor(kind,id){
  if(!online||syncConflict)return toast('Periksa status sinkronisasi PostgreSQL sebelum mengedit.');
  const record=kind==='template'?state.templates.find(t=>t.id===id):getRow(id);
  if(!record)return toast('Baris tidak ditemukan.');
  editingRecord={kind,id,period:current};
  const dialog=editDialog(),form=$('#editForm');
  form.reset();
  editError();
  $('#editDialogTitle').textContent=kind==='template'?'✏️ Edit master tagihan':'✏️ Edit baris tagihan';
  $('#editDialogHelp').textContent=kind==='template'?'Perubahan master berlaku untuk periode yang dibuat berikutnya.':'Perubahan hanya pada bulan ini. Pilih perbarui master jika nomor berubah untuk bulan mendatang.';
  editValue('name').value=record.name??'';
  editValue('number').value=String(record.number??'');
  editValue('platform').value=record.platform??'';
  const categories=editValue('categoryId');
  categories.replaceChildren();
  for(const cat of state.categories.filter(c=>c.active!==false||c.id===record.categoryId)){
    categories.add(new Option(cat.name,cat.id));
  }
  categories.value=record.categoryId;
  for(const item of form.querySelectorAll('.edit-bill-field'))item.classList.toggle('hidden',kind==='template');
  $('#editMasterChoice').classList.toggle('hidden',kind==='template'||!record.templateId);
  if(kind==='bill'){
    editValue('amount').value=formatIdrInput(record.amount);
    editValue('notes').value=record.notes??'';
    editValue('paid').checked=!!record.paid;
    editValue('printed').checked=!!record.printed;
    editValue('updateMaster').checked=!!record.templateId;
  }
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
  editValue('number').focus();
}
function closeRecordEditor(){
  const dialog=editDialog();
  if(dialog.open&&typeof dialog.close==='function')dialog.close();
  else dialog.removeAttribute('open');
  editingRecord=null;
}
function applyRecordEditor(event){
  event.preventDefault();
  if(!editingRecord)return;
  if(!online||syncConflict)return editError('Server belum siap. Cek koneksi atau konflik sinkronisasi.');
  if(editingRecord.kind==='bill'&&current!==editingRecord.period)return editError('Periode berubah. Buka editor kembali.');
  const {kind,id}=editingRecord;
  const record=kind==='template'?state.templates.find(t=>t.id===id):getRow(id);
  if(!record)return editError('Baris tidak ditemukan.');
  const name=editValue('name').value.trim();
  const number=editValue('number').value.trim(); // Keep as text, including leading zeros.
  const categoryId=editValue('categoryId').value;
  const platform=editValue('platform').value.trim();
  const category=state.categories.find(c=>c.id===categoryId);
  if(!name)return editError('Nama tagihan wajib diisi.');
  if(!category)return editError('Kategori tidak valid.');
  const amount=kind==='bill'?parseIdrInput(editValue('amount').value):null;
  if(kind==='bill'&&amount===null)return editError('Nominal Rupiah tidak valid.');
  const peers=kind==='template'?state.templates:(state.months[current]||[]);
  if(isDuplicateNumber(peers,id,categoryId,name,number))return editError('Nomor, nama, dan kategori ini sudah ada di periode tersebut.');
  const updates={name,number,categoryId,platform};
  if(kind==='bill'){
    updates.categoryName=category.name;
    updates.amount=amount;
    updates.notes=editValue('notes').value.trim();
    updates.paid=editValue('paid').checked;
    updates.printed=editValue('printed').checked;
  }
  const tmpl=kind==='bill'&&editValue('updateMaster').checked&&record.templateId?state.templates.find(t=>t.id===record.templateId):null;
  if(tmpl&&isDuplicateNumber(state.templates,tmpl.id,categoryId,name,number))return editError('Master nomor pelanggan ini sudah ada.');
  const masterUpdates={name,number,categoryId,platform};
  const changed=Object.entries(updates).some(([k,v])=>record[k]!==v);
  const masterChanged=!!(tmpl&&Object.entries(masterUpdates).some(([k,v])=>tmpl[k]!==v));
  if(changed){
    if(kind==='bill'){
      const timestamp=new Date().toISOString();
      if(record.paid!==updates.paid)record.paidAt=updates.paid?timestamp:null;
      if(record.printed!==updates.printed)record.printedAt=updates.printed?timestamp:null;
    }
    Object.assign(record,updates);
  }
  if(masterChanged)Object.assign(tmpl,masterUpdates);
  closeRecordEditor();
  if(changed||masterChanged){
    markDirty();
    render();
    if(!busy)void save(false); // Trigger the existing PostgreSQL revision-safe save.
    toast('✓ Perubahan diterapkan, sinkronisasi sedang berjalan.');
  }else toast('Tidak ada perubahan pada baris.');
}
$('#editForm').addEventListener('submit',applyRecordEditor);
$('#editCancel').addEventListener('click',closeRecordEditor);
$('#editClose').addEventListener('click',closeRecordEditor);
editDialog().addEventListener('close',()=>{editingRecord=null;});

function archiveCategory(id){const cat=state.categories.find(x=>x.id===id);if(!cat)return;cat.active=!cat.active;markDirty();render();}
async function logout(){if(dirty&&!confirm('Perubahan belum disimpan. Yakin keluar?'))return;await api('logout',{method:'POST',body:'{}'});location.reload();}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';try{await api('login',{method:'POST',body:JSON.stringify({password:$('#password').value})});$('#password').value='';await enter();}catch(e){$('#loginError').textContent=e.message;}});
$('#logout').addEventListener('click',logout);$('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.contains('open')?closeMobileMenu():openMobileMenu());
$('#mobileNavClose').addEventListener('click',closeMobileMenu);$('#navBackdrop').addEventListener('click',closeMobileMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#sidebar').classList.contains('open')){closeMobileMenu();$('#mobileMenu').focus();}});
$('#mobileBottomNav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)navigate(b.dataset.page);});
window.matchMedia('(min-width:1101px)').addEventListener('change',e=>{if(e.matches)closeMobileMenu();});
$('#nav').addEventListener('click',e=>{const el=e.target.closest('[data-page]');if(el)navigate(el.dataset.page);});
$('#main').addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;if(a==='editRow')return openRecordEditor('bill',el.dataset.id);if(a==='editTemplate')return openRecordEditor('template',el.dataset.id);if(a==='copyNumber'){const record=el.dataset.source==='template'?state.templates.find(t=>t.id===el.dataset.id):getRow(el.dataset.id);const number=String(record?.number??'').trim();if(!number)return toast('Nomor pelanggan belum tersedia');const copied=await writeCustomerNumber(number);toast(copied?'✓ Nomor '+number+' disalin. Tinggal Paste di aplikasi pembayaran.':'Gagal menyalin otomatis. Periksa izin clipboard browser.');}if(a==='retry')await reload();if(a==='prev')changeMonth(-1);if(a==='next')changeMonth(1);if(a==='save')await save(false);if(a==='addCategory')addCategory();if(a==='addRow')addRow();if(a==='gotoBills')navigate('bills');if(a==='exportXlsx')exportRecords(state,current,'xlsx');if(a==='exportAll')exportRecords(state,'all','xlsx');if(a==='doExport')exportRecords(state,$('#exportPeriod').value,$('#exportFormat').value);if(a==='openPeriod'){current=el.dataset.ym;navigate('bills');}if(a==='import')$('#importFile').click();if(a==='deleteRow'){const row=getRow(el.dataset.id);if(row&&confirm('Hapus baris dari bulan ini? Riwayat bulan lain tetap aman.')){row.hidden=true;markDirty();render();}}if(a==='archiveTemplate'){const t=state.templates.find(t=>t.id===el.dataset.id);if(t&&confirm('Arsipkan tagihan berulang? Baris bulan sebelumnya tidak akan terhapus.')){t.active=false;markDirty();render();}}if(a==='archiveCategory')archiveCategory(el.dataset.id);if(a==='renameCategory'){const cat=state.categories.find(c=>c.id===el.dataset.id);if(cat){const name=prompt('Nama kategori baru:',cat.name)?.trim();if(name){cat.name=name;markDirty();render();}}}});
$('#main').addEventListener('dragstart',e=>{const h=e.target.closest('th[data-col]');if(!h)return;window.__movingColumn=h.dataset.col;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',h.dataset.col);});
$('#main').addEventListener('dragover',e=>{const h=e.target.closest('th[data-col]');if(!h)return;e.preventDefault();e.dataTransfer.dropEffect='move';h.classList.add('drag-over');});
$('#main').addEventListener('dragleave',e=>{const h=e.target.closest('th[data-col]');h?.classList.remove('drag-over');});
$('#main').addEventListener('drop',e=>{const h=e.target.closest('th[data-col]');if(!h)return;e.preventDefault();const source=e.dataTransfer.getData('text/plain');$$('th.drag-over').forEach(x=>x.classList.remove('drag-over'));if(COLUMN_IDS.includes(source))moveColumn(source,h.dataset.col);});
$('#main').addEventListener('dragend',()=>$$('th.drag-over').forEach(x=>x.classList.remove('drag-over')));
$('#main').addEventListener('pointerdown',e=>{const grip=e.target.closest('[data-resize]');if(!grip)return;e.preventDefault();e.stopPropagation();const col=grip.dataset.resize,start=e.clientX,initial=widths[col];const move=v=>{widths[col]=Math.min(630,Math.max(COLUMNS[col].min,initial+v.clientX-start));$$(`col[data-col="${col}"]`).forEach(n=>n.style.width=widths[col]+'px');$$(`th[data-col="${col}"]`).forEach(n=>n.style.width=widths[col]+'px');$$('table.bill-table').forEach(n=>n.style.minWidth=(columnOrder.reduce((sum,k)=>sum+widths[k],0)+110)+'px');};const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);storeColumns();};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});});
$('#main').addEventListener('change',e=>{const el=e.target;if(el.id==='periodSelect')chooseMonth(el.value);else if(el.id==='filterSelect'){filter=el.value;render();}else if(el.dataset.field)updateField(el);});
// Filter only the results fragment: keep the mobile keyboard, caret and search field mounted.
let searchDebounce;
$('#main').addEventListener('input',e=>{
  if(e.target.id!=='searchInput')return;
  query=e.target.value;
  if(e.isComposing)return;
  clearTimeout(searchDebounce);
  searchDebounce=setTimeout(()=>{
    if(view!=='bills'||!online)return;
    const currentResults=$('#billResults');
    if(!currentResults)return;
    const virtual=document.createElement('div');
    virtual.innerHTML=renderBills();
    const results=virtual.querySelector('#billResults');
    if(results)currentResults.replaceWith(results);
  },130);
});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
$('#importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(!file.name.toLowerCase().endsWith('.csv'))throw new Error('Format Excel (.xlsx) perlu dikonversi ke CSV untuk importer versi ini. Ekspor dari Numbers/Excel sebagai CSV.');const table=parseCsv(await file.text());if(table.length<2)throw new Error('CSV kosong');const cols=table[0].map(s=>s.toLowerCase().trim());const ix=(...names)=>cols.findIndex(x=>names.some(n=>x.includes(n)));const ci=ix('kategori','category'),ni=ix('nama','description','deskripsi'),no=ix('nomor','id pelanggan'),ai=ix('tagihan','jumlah','amount'),pi=ix('platform','toko'),si=ix('sudah','bayar','paid'),pr=ix('cetak','printed'),ymi=ix('periode','period');if(ni<0||ai<0)throw new Error('Header CSV harus punya kolom nama/deskripsi dan tagihan');const selected=ymi>=0?null:prompt('Periode tujuan (YYYY-MM):',current);if(selected&&!/^20\d\d-(0[1-9]|1[0-2])$/.test(selected))throw new Error('Periode tidak valid');const proposed=[];for(let i=1;i<table.length;i++){const cells=table[i];const ym=ymi>=0?cells[ymi]:selected;if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(ym||''))continue;const name=String(cells[ni]||'').trim();if(!name)continue;const raw=String(cells[ai]||'').replace(/[^\d]/g,'');const amount=Number(raw);if(!Number.isSafeInteger(amount))continue;const categoryName=String(cells[ci]||'Lainnya').trim();proposed.push({ym,name,number:String(cells[no]||''),categoryName,amount,platform:cells[pi]||'',paid:/^(ya|true|1|sudah)/i.test(cells[si]||''),printed:/^(ya|true|1|sudah)/i.test(cells[pr]||'')});}if(!proposed.length)throw new Error('Tidak ada baris valid');const byPeriod=new Set(proposed.map(x=>x.ym));if(!confirm(`Preview import: ${proposed.length} baris, ${byPeriod.size} periode.\nDuplikat nomor + kategori + periode akan dilewati.\nLanjut gabungkan ke draft?`))return;let count=0;for(const r of proposed){let cat=state.categories.find(c=>c.name.toLowerCase()===r.categoryName.toLowerCase());if(!cat){cat={id:makeId(),name:r.categoryName,active:true,order:state.categories.length};state.categories.push(cat);}const period=state.months[r.ym]??=[];if(period.some(row=>row.categoryId===cat.id&&row.number===r.number&&row.name.toLowerCase()===r.name.toLowerCase()))continue;let tmpl=state.templates.find(t=>t.categoryId===cat.id&&t.number===r.number&&t.name.toLowerCase()===r.name.toLowerCase());if(!tmpl){tmpl={id:makeId(),categoryId:cat.id,name:r.name,number:r.number,platform:r.platform,active:true,createdYm:r.ym};state.templates.push(tmpl);}period.push({id:makeId(),templateId:tmpl.id,categoryId:cat.id,categoryName:cat.name,name:r.name,number:r.number,amount:r.amount,platform:r.platform,paid:r.paid,printed:r.printed,paidAt:null,printedAt:null,hidden:false,recurring:true,notes:''});count++;}markDirty();render();toast(`✓ ${count} baris masuk draft. Klik Save untuk menyimpan permanen.`);}catch(err){toast('Import gagal: '+err.message);}finally{e.target.value='';}});
// Recover automatically when Android/iOS backgrounding or an unreliable connection
// interrupts polling. Never replace local edits or a conflicted draft.
let refreshInFlight=false;
async function reconcileWhenActive(){
  if(!state||refreshInFlight||dirty||busy||syncConflict||editingRecord||document.hidden)return;
  const active=document.activeElement;
  if(active?.closest?.('#main')&&/^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName))return;
  refreshInFlight=true;
  try{
    if(online){
      const info=await api('health');
      if(info.revision==null)throw new Error('Database health not ready');
      if(String(info.revision)===String(etag))return;
    }
    const fresh=await api('state');
    if(dirty||busy||syncConflict)return;
    const restored=!online;
    state=fresh.state;
    persistedState=structuredClone(state);
    etag=fresh.etag;
    online=true;
    render();
    toast(restored?'☁ Koneksi pulih, data PostgreSQL dimuat ulang':'☁ Data terbaru tersinkron dari PostgreSQL');
  }catch(e){if(online){online=false;setSync();}}
  finally{refreshInFlight=false;}
}
setInterval(reconcileWhenActive,30000);
window.addEventListener('online',reconcileWhenActive);
window.addEventListener('pageshow',reconcileWhenActive);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcileWhenActive();});
boot();
