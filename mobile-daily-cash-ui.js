/* BIG BROTHER — Daily Cash Collection Mobile UI V1 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}
function setup(){
  const filters=document.querySelector('.filters');
  const cards=document.querySelector('.cards');
  if(!filters||!cards)return;

  if(!document.getElementById('bbDccMobileHead')){
    const head=document.createElement('div');
    head.id='bbDccMobileHead';
    head.className='bb-mobile-head';
    head.innerHTML='<strong>Daily Cash Collection</strong><button type="button" data-bb-filter>☷ Filters</button><button type="button" class="bb-refresh" data-bb-refresh>↻</button>';
    cards.parentNode.insertBefore(head,cards);
    head.querySelector('[data-bb-refresh]').onclick=()=>$('refreshBtn')?.click();
  }

  let backdrop=document.getElementById('bbDccFilterBackdrop');
  if(!backdrop){backdrop=document.createElement('div');backdrop.id='bbDccFilterBackdrop';backdrop.className='bb-filter-backdrop';document.body.appendChild(backdrop)}

  if(!filters.querySelector('.bb-filter-title')){
    const title=document.createElement('div');title.className='bb-filter-title';title.innerHTML='<strong>Filter Cash Invoices</strong><button type="button" aria-label="Close">×</button>';filters.insertBefore(title,filters.firstChild);
    title.querySelector('button').onclick=closeFilters;
  }

  const fieldDefs=[['dateFrom','From Date'],['dateTo','To Date'],['locationFilter','Location']];
  fieldDefs.forEach(([id,label])=>{
    const el=$(id);if(!el||el.parentElement?.classList.contains('bb-filter-field'))return;
    const wrap=document.createElement('div');wrap.className='bb-filter-field';
    const lab=document.createElement('label');lab.textContent=label;
    el.parentNode.insertBefore(wrap,el);wrap.appendChild(lab);wrap.appendChild(el);
  });

  if(!filters.querySelector('.bb-filter-actions')){
    const clearBtn=[...filters.children].find(x=>x.tagName==='BUTTON'&&/clear/i.test(x.textContent||''));
    const refreshBtn=$('refreshBtn');
    const actions=document.createElement('div');actions.className='bb-filter-actions';
    if(clearBtn)actions.appendChild(clearBtn);
    if(refreshBtn)actions.appendChild(refreshBtn);
    const done=document.createElement('button');done.type='button';done.className='btn primary';done.textContent='Done';done.onclick=closeFilters;actions.appendChild(done);
    filters.appendChild(actions);
  }

  document.querySelector('[data-bb-filter]').onclick=openFilters;
  backdrop.onclick=closeFilters;

  const body=$('summaryBody');
  if(body&&!body.dataset.bbObserved){
    body.dataset.bbObserved='1';
    const polish=()=>body.querySelectorAll(':scope>tr').forEach(tr=>tr.classList.toggle('bb-empty-row',!!tr.querySelector('td.empty')));
    new MutationObserver(polish).observe(body,{childList:true,subtree:true});polish();
  }
}
function openFilters(){document.querySelector('.filters')?.classList.add('bb-mobile-open');$('bbDccFilterBackdrop')?.classList.add('show')}
function closeFilters(){document.querySelector('.filters')?.classList.remove('bb-mobile-open');$('bbDccFilterBackdrop')?.classList.remove('show')}
ready(()=>{setup();setTimeout(setup,250);setTimeout(setup,900)});
})();
