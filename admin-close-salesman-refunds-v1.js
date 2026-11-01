/* BIG BROTHER — Admin Salesman Cash Refund Deduction V1 */
(function(){
'use strict';
const oldOpen=window.openCashRequest;
const oldExpected=window.expectedCloseUSD;
const oldPost=window.apiPost;
if(typeof oldOpen!=='function'||typeof oldExpected!=='function'||typeof oldPost!=='function'){
 console.error('Salesman refund integration markers unavailable');return;
}
let rows=[];
const selected=()=>Array.from(document.querySelectorAll('#bbRefundChoices input:checked')).map(x=>x.value);
const deduction=()=>{const ids=new Set(selected());return rows.filter(x=>ids.has(x.refundId)).reduce((s,x)=>s+Number(x.amountUSD||0),0);};
const gross=()=>Number(oldExpected());
function display(){
 const d=deduction(), g=gross();
 if(document.getElementById('bbRefundGross'))document.getElementById('bbRefundGross').textContent='$'+g.toFixed(2);
 if(document.getElementById('bbRefundDeduct'))document.getElementById('bbRefundDeduct').textContent='$'+d.toFixed(2);
 if(document.getElementById('bbRefundNet'))document.getElementById('bbRefundNet').textContent='$'+Math.max(g-d,0).toFixed(2);
}
const box=document.createElement('div');
box.id='bbSalesmanRefundBox';
box.className='field';
box.style.cssText='padding:12px;margin:10px 0;border:1px solid #cadced;border-radius:9px;background:#f5faff';
box.innerHTML='<label>Salesman Refund Deductions — Admin Close</label><div id="bbRefundChoices" style="font-size:12px">Open a cash collection to select available refunds.</div><div style="margin-top:8px;font-size:12px">Gross: <b id="bbRefundGross">$0.00</b> · Refunds: <b id="bbRefundDeduct">$0.00</b> · Net handover: <b id="bbRefundNet">$0.00</b></div>';
document.querySelector('.close-metrics')?.insertAdjacentElement('beforebegin',box);
window.expectedCloseUSD=function(){return Math.max(0,gross()-deduction());};
window.apiPost=async function(params){
 if(params?.action==='dccCreateRequest'){
   let data;try{data=JSON.parse(params.requestData||'{}')}catch(e){throw Error('Invalid collection payload')}
   data.refundIds=selected();
   params={...params,requestData:JSON.stringify(data)};
 }
 return oldPost(params);
};
window.openCashRequest=function(...args){
 const result=oldOpen.apply(this,args);
 rows=[];const el=document.getElementById('bbRefundChoices');
 if(el)el.textContent='Loading salesman refund deductions...';
 display();
 (async()=>{
  try{
   const data=await window.BBDailyCashAdapter.refundAvailable();
   const location=String((typeof selectedCloseInvoices==='function'?selectedCloseInvoices():[])[0]?.locationCode||'');
   rows=(data.refunds||[]).filter(x=>x.locationCode===location);
   if(!el)return;el.replaceChildren();
   if(!rows.length)el.textContent='No available refunds for this location.';
   rows.forEach(x=>{
    const label=document.createElement('label');
    label.style.cssText='display:flex;gap:8px;align-items:center;margin:7px 0';
    const checkbox=document.createElement('input');
    checkbox.type='checkbox';checkbox.value=x.refundId;checkbox.style.width='auto';
    checkbox.addEventListener('change',()=>{display();if(typeof recalculateClose==='function')recalculateClose()});
    label.append(checkbox,document.createTextNode(x.refundId+' · '+x.invoiceNo+' · '+(x.customer||'')+' · -$'+Number(x.amountUSD).toFixed(2)));
    el.appendChild(label);
   });
  }catch(e){if(el)el.textContent='Could not load refund deductions: '+(e?.message||e)}
  display();if(typeof recalculateClose==='function')recalculateClose();
 })();
 return result;
};
document.querySelector('#closeExpectedUSD')?.closest('.close-metric')?.querySelector('small')?.replaceChildren(document.createTextNode('Net Expected Cash'));
})();