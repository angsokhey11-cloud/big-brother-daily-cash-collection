(function(){
'use strict';
async function boot(){
 const root=document.querySelector('.wrap')||document.body;
 const section=document.createElement('section');
 section.className='panel';section.style.cssText='margin:16px 0;padding:16px';
 section.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">Salesman Customer Refunds — Admin Overview</h3><button type="button" id="bbAdminRefundRefresh" style="padding:8px 12px">Refresh Refunds</button></div><p style="font-size:12px;color:#617089">All salesman-paid refunds. AVAILABLE can be used in a new collection; CLAIMED belongs to a pending close; USED belongs to an approved close.</p><div id="bbAdminRefundRows" style="overflow-x:auto">Loading...</div>';
 root.insertAdjacentElement('afterbegin',section);
 const container=section.querySelector('#bbAdminRefundRows');
 const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const fmt=v=>'$'+Number(v||0).toFixed(2);
 async function refresh(){
  container.textContent='Loading refunds...';
  try{
   const result=await window.BBDailyCashAdapter.adminRefundOverview();
   const rows=result?.rows||[];
   const available=rows.filter(x=>x.status==='AVAILABLE').reduce((a,x)=>a+Number(x.amountUSD||0),0);
   const claimed=rows.filter(x=>x.status==='CLAIMED').reduce((a,x)=>a+Number(x.amountUSD||0),0);
   const used=rows.filter(x=>x.status==='USED').reduce((a,x)=>a+Number(x.amountUSD||0),0);
   const sums=document.createElement('div');sums.style.cssText='display:flex;gap:16px;flex-wrap:wrap;margin:12px 0;font-size:13px;font-weight:700';
   sums.textContent='Available: '+fmt(available)+'  |  Pending Close: '+fmt(claimed)+'  |  Approved: '+fmt(used);
   container.replaceChildren(sums);
   if(!rows.length){container.append('No salesman refund records yet.');return;}
   const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap';
   table.innerHTML='<thead><tr>'+['Refund ID','Invoice','Salesman','Location','Deduction','Status','Close','Gross Closed','Refunds Closed','Net Closed'].map(x=>'<th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(x=>'<tr>'+[x.refundId,x.invoiceNo,x.salesmanStaffId,x.locationCode,fmt(x.amountUSD),x.status,x.closeId||'—',x.closeId?fmt(x.grossCollectionUSD):'—',x.closeId?fmt(x.refundCollectionUSD):'—',x.closeId?fmt(x.netExpectedUSD):'—'].map(v=>'<td style="padding:9px;border-bottom:1px solid #e3e8ef">'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody>';
   container.appendChild(table);
  }catch(e){container.textContent='Refund overview unavailable: '+(e?.message||e);}
 }
 section.querySelector('#bbAdminRefundRefresh').addEventListener('click',refresh);
 await refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();