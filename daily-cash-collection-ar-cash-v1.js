/* BIG BROTHER — Daily Cash Collection: combined Sales Cash + old A/R Cash preview (V1).
   The only write is the protected atomic RPC; existing approval and clearing workflows remain unchanged. */
(function(){
'use strict';
const adapter=window.BBDailyCashAdapter||window.BBDailyCashMobileAdapter;
const sourceMode=window.BBDailyCashMobileAdapter?'mobile':'desktop';
if(!adapter||typeof window.openCashRequest!=='function'||typeof window.sendCashRequest!=='function'){
 console.warn('Combined collection requires the signed-in Daily Cash workspace.');return;
}
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const fmt=(n,c)=>c==='KHR'?'៛'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2}):'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const selected=new Map();
let available=[],fetched=false,loading=false,sending=false,pendingToken='',pendingSignature='';
const oldOpen=window.openCashRequest, oldSend=window.sendCashRequest,oldSummary=window.openDailyCashSummary,oldUpdate=window.updateSelectedSummary,oldClear=window.clearSelection;
const oldRecalculateClose=window.recalculateClose;
const css=document.createElement('style');css.id='bb-ar-combined-cash-style';
css.textContent=[
'#bbArMainPanel{background:#f3f8ff;border:1px solid #cbdcee;border-radius:12px;padding:12px 14px;margin:10px 0 14px;color:#1b4771}',
'#bbArMainPanel h3{font-size:14px;margin:0 0 5px;font-weight:900}',
'.bb-ar-small{font-size:11px;line-height:1.5;color:#5b7188;margin:5px 0}',
'.bb-ar-actions{display:flex;gap:8px;flex-wrap:wrap;margin:9px 0}',
'.bb-ar-actions button{background:#184b89;color:white;border:1px solid #174680;border-radius:8px;min-height:37px;padding:8px 13px;font-weight:750;cursor:pointer}',
'.bb-ar-actions button:disabled{opacity:.5;cursor:not-allowed}',
'.bb-ar-pills{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}',
'.bb-ar-pill{background:white;border:1px solid #cbdcec;border-radius:9px;padding:8px}',
'.bb-ar-pill small{display:block;font-size:10px;color:#59728b}.bb-ar-pill strong{font-size:13px;color:#123f79}',
'#bbArClosePanel{background:#edf8f3;border:1px solid #b9dccb;border-radius:10px;padding:10px;margin:9px 0;font-size:12px;line-height:1.5}',
'#bbArCloseLines{background:#fff;border:1px solid #d8e7eb;border-radius:9px;padding:10px;margin-top:12px;font-size:11px;line-height:1.7}',
'#bbArPicker[hidden]{display:none!important}',
'#bbArPicker{position:fixed;inset:0;z-index:100000;background:rgba(8,25,47,.63);display:flex;align-items:center;justify-content:center;padding:12px}',
'.bb-ar-dialog{width:min(890px,100%);max-height:93dvh;background:#fff;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 15px 50px #071c404b}',
'.bb-ar-dialog-header{background:#17457e;color:white;padding:14px 17px;display:flex;align-items:center;gap:12px;justify-content:space-between}',
'.bb-ar-dialog-header h2{font-size:17px;margin:0}.bb-ar-dialog-header button{color:#17457e;background:white;border:0;border-radius:7px;padding:9px 12px;cursor:pointer}',
'.bb-ar-dialog-body{padding:13px;overflow:auto;flex:1;min-height:0}',
'#bbArSearch{width:100%;box-sizing:border-box;padding:12px;border:1px solid #bbcede;border-radius:8px;font-size:14px}',
'.bb-ar-row{display:grid;grid-template-columns:22px minmax(0,1fr) 105px;gap:9px;align-items:center;border-bottom:1px solid #e5edf5;padding:10px 2px}',
'.bb-ar-row strong{color:#153d70;font-size:12px}.bb-ar-row small{color:#6a7e90;font-size:10px;display:block;line-height:1.4}',
'.bb-ar-row input[type=number]{width:100%;box-sizing:border-box;padding:9px;border:1px solid #b9c9dc;border-radius:7px;text-align:right}',
'.bb-ar-row input[type=number]:disabled{background:#eef2f5;color:#96a3ad}',
'.bb-ar-dialog-footer{border-top:1px solid #d6e2ec;padding:11px 14px;display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}',
'.bb-ar-dialog-footer button{border:0;border-radius:8px;padding:10px 15px;color:#fff;background:#176a4a;font-weight:bold;cursor:pointer}',
'#bbArPickerError{font-size:11px;color:#a22;min-height:14px;padding:0 12px 8px}',
'@media(max-width:620px){.bb-ar-pills{grid-template-columns:1fr 1fr}.bb-ar-dialog{max-height:96dvh}.bb-ar-row{grid-template-columns:22px minmax(0,1fr) 88px}.bb-ar-row strong{font-size:11px}}'
].join('');
document.head.appendChild(css);

function rows(){return [...selected.values()];}
function arTotals(){
 const out={USD:0,KHR:0};
 rows().forEach(r=>{if(r.currency==='KHR')out.KHR+=r.amount;else out.USD+=r.amount;});
 return out;
}
function saleRows(){
 try{
  if(!$('cashRequestOverlay')?.classList.contains('hidden')&&typeof window.selectedCloseInvoices==='function')
   return window.selectedCloseInvoices();
  if(typeof window.selectedGroupObjects==='function'&&typeof window.groupAvailableInvoices==='function')
   return window.selectedGroupObjects().flatMap(window.groupAvailableInvoices);
 }catch(_){}
 return [];
}
function saleTotals(useActual=false){
 const out={USD:0,KHR:0};
 if(useActual){
  out.USD=amount($('actualCashUSD')?.value);out.KHR=amount($('actualCashKHR')?.value);
 }else{
  saleRows().forEach(r=>{const cur=String(r.currency||'USD').toUpperCase();if(cur==='KHR')out.KHR+=amount(r.amountPaid);else out.USD+=amount(r.amountPaid);});
 }
 return out;
}
// Treat Actual USD/KHR as the WHOLE physical handover. Reserve old A/R currency
// before submitting the remainder to the unchanged Sales Cash close RPC.
function physicalCash(){
 return {USD:amount($('actualCashUSD')?.value),KHR:amount($('actualCashKHR')?.value)};
}
function cashSplit(){
 const total=physicalCash(),ar=arTotals();
 const remainingUSD=Math.round((total.USD-ar.USD)*100)/100;
 const remainingKHR=Math.round(total.KHR-ar.KHR);
 return {total,ar,remainingUSD,remainingKHR,
   shortUSD:remainingUSD<-.005,shortKHR:remainingKHR<-.000001};
}
function updateClosePanel(){
 const panel=$('bbArClosePanel');if(!panel||!selected.size)return;
 const split=cashSplit();
 const saleExpected=typeof window.expectedCloseUSD==='function'
   ?amount(window.expectedCloseUSD()):0;
 panel.innerHTML='<strong>One physical cash handover · Sales + Old A/R</strong>'+
  '<div class="bb-ar-small">Cash Sales expected (after refunds): '+fmt(saleExpected,'USD')+
  '<br>Old A/R expected: '+fmt(split.ar.USD,'USD')+' / '+fmt(split.ar.KHR,'KHR')+
  '<br>Physical cash counted in Actual fields: '+fmt(split.total.USD,'USD')+' / '+fmt(split.total.KHR,'KHR')+
  '<br>Reserved for old A/R: '+fmt(split.ar.USD,'USD')+' / '+fmt(split.ar.KHR,'KHR')+
  '<br><strong>Remaining for Daily Cash: '+fmt(Math.max(0,split.remainingUSD),'USD')+
  ' / '+fmt(Math.max(0,split.remainingKHR),'KHR')+'</strong></div>'+
  '<small>Enter the FULL handover once. Old A/R is deducted from the counted amount before saving the Sales Cash request. A/R cash must be received in the invoice currency; different-currency A/R uses the normal receivable workflow.</small>';
}
function validateList(){
 if(!rows().length)throw Error('Select at least one old A/R invoice.');
 for(const r of rows()){
  if(!String(r.locationCode||'').trim())throw Error('Customer assigned location is missing for invoice '+r.invoiceNo+'. Update the customer directory.');
  if(!(r.amount>0)||r.amount>amount(r.outstanding)+.000001)throw Error('Collected A/R amount must be greater than zero and cannot exceed outstanding: '+r.invoiceNo);
 }
}
function viewTotals(){
 const a=arTotals(),s=saleTotals(),t={USD:s.USD+a.USD,KHR:s.KHR+a.KHR};
 const box=$('bbArMainTotals');
 if(box)box.innerHTML=[
  '<div class="bb-ar-pill"><small>Sales Cash (invoice currency)</small><strong>'+fmt(s.USD,'USD')+' · '+fmt(s.KHR,'KHR')+'</strong></div>',
  '<div class="bb-ar-pill"><small>Old A/R Cash (invoice currency)</small><strong>'+fmt(a.USD,'USD')+' · '+fmt(a.KHR,'KHR')+'</strong></div>',
  '<div class="bb-ar-pill"><small>Combined Collection</small><strong>'+fmt(t.USD,'USD')+' · '+fmt(t.KHR,'KHR')+'</strong></div>'
 ].join('');
 if($('bbArRequestOnly'))$('bbArRequestOnly').disabled=!selected.size||sending;
 const summaryBtn=$('dailyCashSummaryBtn');
 if(summaryBtn){
  const cashCount=typeof window.selectedCashInvoicesForSummary==='function'?window.selectedCashInvoicesForSummary().length:0;
  summaryBtn.disabled=!cashCount&&!selected.size;
  summaryBtn.textContent=selected.size
   ?'▦ Combined Cash Summary ('+cashCount+' Sales + '+selected.size+' A/R)'
   :'▦ Daily Cash Summary ('+cashCount+')';
 }
 if($('bbArSelectionCount'))$('bbArSelectionCount').textContent=selected.size+' old A/R invoices selected';
 const b=$('bbArClosePanel');
 if(b){b.hidden=selected.size===0;if(selected.size)updateClosePanel();}
  const closeLines=$('bbArCloseLines');
 if(closeLines){
  closeLines.hidden=!selected.size;
  closeLines.innerHTML='<strong>Old A/R cash included in this handover ('+selected.size+')</strong><div>'+
   rows().map(r=>esc(r.invoiceNo)+' · '+esc(r.customer)+' · '+fmt(r.amount,r.currency)+' ('+esc(r.locationCode)+')').join('<br>')+
   '</div><div class="bb-ar-small">These will become separate Pending Receivable requests, not Daily Cash invoices.</div>';
 }
 const btn=$('sendCashRequestBtn');
 if(btn)btn.textContent=selected.size?'✓ Send Daily Cash + A/R Requests':'✓ Send Close to Admin';
 const heading=$('cashRequestTitle');
 if(heading)heading.textContent=selected.size?'Close Cash Collection · Sales + Old A/R':
  'Close Daily Cash ('+saleRows().length+' invoice'+(saleRows().length===1?'':'s')+')';
 const expectedLabel=$('closeExpectedUSD')?.closest('.close-metric')?.querySelector('small');
 if(expectedLabel)expectedLabel.textContent=selected.size?
  'Combined Net Expected Cash (Sales + A/R)':'Net Expected Cash';
 const usdLabel=$('actualCashUSD')?.closest('.field')?.querySelector('label');
 const khrLabel=$('actualCashKHR')?.closest('.field')?.querySelector('label');
 if(usdLabel)usdLabel.textContent=selected.size?'Total Physical USD Cash (Sales + A/R)':'Actual USD Cash';
 if(khrLabel)khrLabel.textContent=selected.size?'Total Physical KHR Cash (Sales + A/R)':'Actual KHR Cash';
 if($('cashRequestOverlay')&&!$('cashRequestOverlay').classList.contains('hidden')&&
    typeof window.recalculateClose==='function')window.recalculateClose();
}
function mount(){
 const bar=document.querySelector('.requestbar');
 if(!bar||$('bbArMainPanel'))return;
 const panel=document.createElement('section');panel.id='bbArMainPanel';
 panel.innerHTML='<h3>Old A/R Cash in Daily Cash Collection</h3>'+
  '<div class="bb-ar-small">Select cash collected from customers using their assigned customer locations, even if the invoice was sold or shipped from another route. Daily Cash and A/R keep their separate Admin approvals.</div>'+
  '<div class="bb-ar-actions"><button type="button" id="bbArSelectBtn">＋ Select Old A/R Cash</button>'+
  '<button type="button" id="bbArRequestOnly" disabled>Send A/R Requests Only</button></div>'+
  '<div id="bbArMainTotals" class="bb-ar-pills"></div>'+
  '<div class="bb-ar-small" id="bbArSelectionCount">0 old A/R invoices selected</div>'+
  '<div class="bb-ar-small">Amounts show invoice currencies. For A/R received in another physical currency, use the standard A/R request workflow so Admin can verify the exchange.</div>';
 bar.insertAdjacentElement('afterend',panel);
 const line=document.createElement('div');line.id='bbArCloseLines';line.hidden=true;
 $('closePagination')?.parentElement?.insertAdjacentElement('afterend',line);
 const box=document.createElement('div');box.id='bbArClosePanel';box.hidden=true;
 $('closeGroupRule')?.insertAdjacentElement('afterend',box);
 const picker=document.createElement('div');picker.id='bbArPicker';picker.hidden=true;
 picker.innerHTML='<section class="bb-ar-dialog" role="dialog" aria-modal="true" aria-label="Select Old Receivable Cash">'+
  '<header class="bb-ar-dialog-header"><h2>Old A/R Cash · Select Collected Invoices</h2>'+
  '<button type="button" id="bbArPickerClose">✕ Close</button></header>'+
  '<div class="bb-ar-dialog-body"><p class="bb-ar-small">Only outstanding invoices in your authorized customer locations are listed. Sale or batch location does not determine A/R collection responsibility. Partial payments remain subject to Admin approval.</p>'+
  '<label class="bb-ar-small" for="bbArLocationFilter">Customer assigned location (not sale/batch location)</label>'+
  '<select id="bbArLocationFilter" style="width:100%;padding:10px;border:1px solid #bbcede;border-radius:8px;margin-bottom:8px"><option value="">All authorized customer locations</option></select>'+
  '<input id="bbArSearch" placeholder="Search customer, invoice number, or customer location…" autocomplete="off">'+
  '<div id="bbArRows">Loading available receivables…</div>'+
  '</div><footer class="bb-ar-dialog-footer"><span id="bbArPickerTotals">0 selected</span>'+
  '<button type="button" id="bbArPickerDone">✓ Use Selected A/R Cash</button></footer>'+
  '<div id="bbArPickerError" role="alert"></div></section>';
 document.body.appendChild(picker);
 $('bbArSelectBtn').addEventListener('click',openPicker);
 $('bbArPickerClose').addEventListener('click',()=>{picker.hidden=true});
 $('bbArPickerDone').addEventListener('click',()=>{
  try{validateList();picker.hidden=true;viewTotals();}catch(error){if(!rows().length){picker.hidden=true;viewTotals()}else $('bbArPickerError').textContent=error.message}
 });
 $('bbArRequestOnly').addEventListener('click',()=>submit(false));
 $('bbArSearch').addEventListener('input',renderPicker);
 $('bbArLocationFilter').addEventListener('change',renderPicker);
 $('bbArRows').addEventListener('change',e=>{
  const target=e.target,invoiceId=target?.dataset?.invoiceId;
  if(!invoiceId)return;
  const c=available.find(x=>String(x.invoiceId)===invoiceId);if(!c)return;
  if(target.dataset.action==='select'){
   if(target.checked){
    if(!String(c.locationCode||'').trim()){
     target.checked=false;$('bbArPickerError').textContent='Customer assigned location missing. Update the Customer directory first.';return;
    }
    selected.set(invoiceId,{...c,amount:amount(c.outstanding)});
   }else selected.delete(invoiceId);
   renderPicker();viewTotals();
  }
 });
 $('bbArRows').addEventListener('input',e=>{
  const t=e.target,id=t?.dataset?.invoiceId;
  if(!id||t.dataset.action!=='amount'||!selected.has(id))return;
  selected.get(id).amount=amount(t.value);
  t.style.borderColor=amount(t.value)>0&&amount(t.value)<=amount(selected.get(id).outstanding)?'#b9c9dc':'#c22';
  viewPickerTotal();viewTotals();
 });
 viewTotals();
}
async function load(){
 if(fetched)return;
 if(loading)return;
 loading=true;
 try{
  const res=await adapter.rpc('bb_sales_support_ar_cash_candidates_v1');
  if(!res?.success)throw Error(res?.message||'Cannot load receivables');
  available=Array.isArray(res.invoices)?res.invoices:[];
  const select=$('bbArLocationFilter');
  if(select){
   const old=select.value;
   const routes=new Map();
   for(const inv of available)if(inv.locationCode)routes.set(inv.locationCode,String(inv.locationName||inv.locationCode));
   select.innerHTML='<option value="">All authorized customer locations</option>'+
    [...routes.entries()].sort((a,b)=>a[1].localeCompare(b[1])).map(([code,name])=>
     '<option value="'+esc(code)+'">'+esc(name)+' · '+esc(code)+'</option>').join('');
   if(routes.has(old))select.value=old;
  }
  fetched=true;
 }finally{loading=false}
}
async function openPicker(){
 mount();$('bbArPicker').hidden=false;$('bbArPickerError').textContent='';
 $('bbArRows').textContent='Loading open receivables…';
 try{await load();renderPicker();$('bbArSearch').focus();}
 catch(e){$('bbArRows').textContent='Could not load A/R: '+(e?.message||e);}
}
function renderPicker(){
 const host=$('bbArRows');if(!host)return;
 const query=String($('bbArSearch')?.value||'').trim().toLowerCase();
 const locationFilter=String($('bbArLocationFilter')?.value||'');
 const matches=available.filter(x=>(!locationFilter||x.locationCode===locationFilter)&&(
  !query||[x.invoiceNo,x.customer,x.customerId,x.locationCode,x.locationName,x.invoiceDate]
  .some(y=>String(y||'').toLowerCase().includes(query))
 ));
 const subset=matches.slice(0,70);
 host.innerHTML=(!subset.length?'<div class="bb-ar-small">No eligible outstanding receivables at this location/search.</div>':
 subset.map(x=>{
  const id=String(x.invoiceId||''),sel=selected.get(id),on=!!sel;
  return '<div class="bb-ar-row"><input type="checkbox" data-action="select" data-invoice-id="'+esc(id)+'"'+(on?' checked':'')+'>'+
   '<div><strong>'+esc(x.invoiceNo)+' · '+esc(x.customer)+'</strong>'+
   '<small>'+esc(x.invoiceDate)+' · Customer location: '+esc(x.locationName||x.locationCode)+' ('+esc(x.locationCode)+')'+
   (x.saleLocationCode&&x.saleLocationCode!==x.locationCode?' · Sale source: '+esc(x.saleLocationCode):'')+
   ' · Outstanding '+fmt(x.outstanding,x.currency)+'</small></div>'+
   '<label><small>Collected '+esc(x.currency)+'</small><input data-action="amount" data-invoice-id="'+esc(id)+'" type="number" min="0.01" max="'+esc(x.outstanding)+'" step="'+(x.currency==='KHR'?'1':'.01')+
   '" value="'+(on?esc(sel.amount):esc(x.outstanding))+'"'+(on?'':' disabled')+'></label></div>';
 }).join(''))+
 (matches.length>70?'<div class="bb-ar-small">Showing first 70 of '+matches.length+' — narrow your search for more.</div>':'');
 viewPickerTotal();
}
function viewPickerTotal(){
 const t=arTotals();
 if($('bbArPickerTotals'))$('bbArPickerTotals').textContent=selected.size+
  ' invoices · '+fmt(t.USD,'USD')+' / '+fmt(t.KHR,'KHR');
}
async function submit(withSales){
 if(sending)return;
 try{
  validateList();
  const invoices=withSales&&typeof window.selectedCloseInvoices==='function'?window.selectedCloseInvoices():[];
  const ids=[...new Set(invoices.map(x=>String(x.invoiceId||'').trim()).filter(Boolean))];
  if(withSales&&!ids.length)throw Error('Select Cash Sale invoices before sending the combined request.');
  if(ids.length&&$('closeMethod')?.value!=='Hand Cash to Accountant')
   throw Error('Mixed Daily Cash + A/R must use Hand Cash to Accountant. Bank deposits use the existing separate workflow.');
  const allocation=cashSplit();
  if(ids.length){
   const calc=window.recalculateClose();
   if(allocation.shortUSD||allocation.shortKHR)
     throw Error('Counted cash must cover the old A/R amount in the SAME currency as its invoices. Enter ALL collected Sales + A/R cash in the Actual USD/KHR fields.');
   if(!calc?.matched)
     throw Error('Total physical cash must match Sales Cash (after refunds) + Old A/R. Check counted USD/KHR and closing rate.');
   const rate=amount($('closingRate')?.value);
   const remainderEquivalent=allocation.remainingUSD+
     (allocation.remainingKHR>0&&rate>0?allocation.remainingKHR/rate:0);
   const saleExpected=typeof window.expectedCloseUSD==='function'?
     amount(window.expectedCloseUSD()):0;
   if((allocation.remainingKHR>0&&rate<=0)||
     Math.abs(remainderEquivalent-saleExpected)>.05)
     throw Error('Cash Sales remainder does not match the original Daily Cash expected amount.');
  }
  if(!window.crypto?.randomUUID)throw Error('Secure request identifier unavailable; refresh the workspace.');
  const salePayload=ids.length?{
   invoiceIds:ids,closeMethod:'Hand Cash to Accountant',
   actualCashUSD:Math.max(0,allocation.remainingUSD),actualCashKHR:Math.max(0,allocation.remainingKHR),
   closingRate:amount($('closingRate')?.value),
   refundIds:[...document.querySelectorAll('#bbRefundChoices input:checked')].map(x=>x.value),
   note:String($('cashRequestNote')?.value||'').trim()
  }:{invoiceIds:[]};
  const arEntries=rows().map(r=>({invoiceId:r.invoiceId,amount:r.amount}));
  const signature=JSON.stringify({sales:salePayload,arEntries});
  if(signature!==pendingSignature){pendingSignature=signature;pendingToken=crypto.randomUUID();}
  const activeButton=ids.length?$('sendCashRequestBtn'):$('bbArRequestOnly');
  sending=true;if(activeButton){activeButton.disabled=true;activeButton.textContent='Submitting both request types…';}
  const d=await adapter.rpc('bb_dcc_combined_cash_request_v1',
   {p_payload:{requestId:pendingToken,sourceMode,sales:salePayload,arEntries}});
  if(!d?.success)throw Error(d?.message||'Combined request was not confirmed');
  if(ids.length&&d.sales){
   ids.forEach(id=>{
    invoiceStates[id]={closeId:d.sales.closeId||'',requestId:d.sales.requestId||'',
      status:'Pending',rawStatus:'Pending',canRequest:false};
   });
   lockedInvoices=invoiceStates;
   if(typeof window.saveCloseStateCache==='function')window.saveCloseStateCache();
   selectedGroups.clear();
   window.closeCashRequest();
   window.buildGroups();
   await window.loadRequestState();
  }
  selected.clear();pendingToken='';pendingSignature='';fetched=false;available=[];
  viewTotals();
  const arIds=(d.receivables||[]).map(r=>r.requestId).join(', ');
  alert('Daily Cash Collection request submitted.\n'+
   (d.sales?'Daily Cash → Pending Daily Cash: '+d.sales.closeId+'\n':'')+
   (arIds?'Receivable → Pending Receivable: '+arIds+'\n':'')+
   '\nThe existing Admin approval and cash clearing flows are unchanged.');
 }catch(e){
  const msg=e?.message||String(e);
  if($('cashRequestOverlay')&&!$('cashRequestOverlay').classList.contains('hidden')){
   $('cashRequestError').textContent=msg;$('cashRequestError').classList.add('show');
  }else alert('Could not submit collection: '+msg);
 }finally{
  sending=false;
  if($('sendCashRequestBtn')){$('sendCashRequestBtn').disabled=false;}
  viewTotals();
 }
}
function injectArSummary(){
 if(!selected.size)return;
 const base=typeof window.selectedCashInvoicesForSummary==='function'?window.selectedCashInvoicesForSummary():[];
 if(base.length){oldSummary();}
 else{
  $('dailyCashSummaryOverlay').classList.remove('hidden');
  $('dailyCashInvoiceDetailPanel').classList.add('hidden');
  $('dailyCashSummaryBody').innerHTML='';
 }
 const a=arTotals(),s=saleTotals(),t={USD:s.USD+a.USD,KHR:s.KHR+a.KHR};
 $('dailyCashSummarySubtitle').textContent='Combined salesman cash collection preview · separate Daily Cash and A/R requests';
 $('dailyCashSummaryMeta').innerHTML='<div class="meta-box"><small>Sales Cash</small><strong>'+fmt(s.USD,'USD')+' · '+fmt(s.KHR,'KHR')+'</strong></div>'+
  '<div class="meta-box"><small>Old A/R Cash</small><strong>'+fmt(a.USD,'USD')+' · '+fmt(a.KHR,'KHR')+'</strong></div>'+
  '<div class="meta-box"><small>Combined Cash</small><strong>'+fmt(t.USD,'USD')+' · '+fmt(t.KHR,'KHR')+'</strong></div>'+
  '<div class="meta-box"><small>Review</small><strong>2 separate request queues</strong></div>';
 $('dailyCashSummaryBody').insertAdjacentHTML('beforeend',rows().map(r=>
  '<tr><td>'+esc(r.invoiceDate)+'</td><td><strong>'+esc(r.invoiceNo)+' (Old A/R)</strong></td>'+
  '<td>'+esc(r.customer)+'</td><td>'+esc(r.salesperson||'-')+'</td>'+
  '<td>'+esc(r.locationName||r.locationCode)+'</td><td>'+esc(r.currency)+'</td>'+
  '<td class="money">'+fmt(r.amount,r.currency)+'</td>'+
  '<td><span class="status-pill">To Pending Receivable</span></td><td>Admin A/R Review</td></tr>'
 ).join(''));
}
window.recalculateClose=function(...args){
 const base=oldRecalculateClose.apply(this,args);
 if(!selected.size)return base;
 const counted=physicalCash(),ar=arTotals(),split=cashSplit();
 const rate=amount($('closingRate')?.value);
 const missingRate=(counted.KHR>0||ar.KHR>0)&&!(rate>0);
 const expected=missingRate?NaN:base.expected+ar.USD+(ar.KHR>0?ar.KHR/rate:0);
 const actual=missingRate?NaN:counted.USD+(counted.KHR>0?counted.KHR/rate:0);
 const diff=actual-expected;
 const matched=!missingRate&&!split.shortUSD&&!split.shortKHR&&
   Number.isFinite(diff)&&Math.abs(diff)<=.05;
 $('closeExpectedUSD').textContent=missingRate?'Exchange rate required':fmt(expected,'USD');
 $('closeActualEquivalent').textContent=missingRate?'Exchange rate required':fmt(actual,'USD');
 $('closeDifference').textContent=missingRate?'—':(diff>=0?'+':'-')+fmt(Math.abs(diff),'USD');
 $('closeMatchStatus').textContent=missingRate?'ENTER EXCHANGE RATE':
  split.shortUSD||split.shortKHR?'SHORT A/R CASH':matched?'MATCHED ✓':'NOT MATCHED';
 $('closeMatchStatus').style.color=matched?'#198754':'#c93c46';
 const card=$('closeResultCard');if(card){
  card.classList.toggle('good',matched);card.classList.toggle('bad',!matched);
 }
 const salesOnly=Number(base.expected)||0;
 if($('closePageTotal'))$('closePageTotal').textContent=
   'Sales subtotal: '+fmt(salesOnly,'USD')+' · Old A/R: '+
   fmt(ar.USD,'USD')+' / '+fmt(ar.KHR,'KHR')+
   ' · Combined expected: '+(missingRate?'enter exchange rate':fmt(expected,'USD'));
 updateClosePanel();
 return {expected,actual,diff,matched,salesExpected:base.expected};
};
window.openCashRequest=function(...args){const r=oldOpen.apply(this,args);viewTotals();return r;};
window.sendCashRequest=function(){return selected.size?submit(true):oldSend();};
window.openDailyCashSummary=function(){return selected.size?injectArSummary():oldSummary();};
window.updateSelectedSummary=function(...args){const r=oldUpdate.apply(this,args);viewTotals();
 if($('dailyCashSummaryBtn')&&selected.size){$('dailyCashSummaryBtn').disabled=false;$('dailyCashSummaryBtn').textContent='▦ Combined Cash Summary ('+selected.size+' A/R + Sales)';}
 return r;};
window.clearSelection=function(...args){selected.clear();pendingToken='';pendingSignature='';
 const r=oldClear.apply(this,args);viewTotals();return r;};
mount();
})();
