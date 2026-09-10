/* BIG BROTHER — Daily Cash Collection Supabase Adapter V1 */
(function(){
  'use strict';

  const URL='https://sjfhlaclgmkwwofzstok.supabase.co';
  const KEY='sb_publishable_w762jR65CWwlO30fKQsYOw_6L9grx8S';
  const SESSION_KEY='BB_SUPABASE_DEV_SESSION_V1';
  let session=null;

  function readSession(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}
    catch(_){return null}
  }

  function saveSession(value){
    session=value||null;
    try{
      if(!value){localStorage.removeItem(SESSION_KEY);return;}
      if(!value.expires_at&&value.expires_in){
        value.expires_at=Math.floor(Date.now()/1000)+Number(value.expires_in);
      }
      localStorage.setItem(SESSION_KEY,JSON.stringify(value));
    }catch(_){}
  }

  async function parse(response){
    const text=await response.text();
    let data={};
    try{data=text?JSON.parse(text):{}}
    catch(_){data={message:text}}
    if(!response.ok){
      throw new Error(data.message||data.error_description||data.error||('Daily Cash database request failed ('+response.status+')'));
    }
    return data;
  }

  async function refreshSession(){
    const current=readSession();
    if(!current?.refresh_token)throw new Error('Please sign in to BIG BROTHER first.');
    const response=await fetch(URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:current.refresh_token})
    });
    const next=await parse(response);saveSession(next);return next;
  }

  async function ensureSession(){
    session=readSession();
    if(!session?.access_token)throw new Error('Please sign in to BIG BROTHER first.');
    const now=Math.floor(Date.now()/1000);
    if(session.expires_at&&Number(session.expires_at)<now+30)await refreshSession();
    return session;
  }

  async function rpc(fn,args={}){
    await ensureSession();
    const response=await fetch(URL+'/rest/v1/rpc/'+fn,{
      method:'POST',
      headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify(args||{}),cache:'no-store'
    });
    return parse(response);
  }

  function payload(value){
    if(value&&typeof value==='object')return value;
    if(typeof value!=='string'||!value.trim())return {};
    try{return JSON.parse(value)}catch(_){throw new Error('Invalid Daily Cash request data.');}
  }

  async function api(params={}){
    const action=String(params.action||'');
    switch(action){
      case 'invoiceList':
        return rpc('bb_dcc_invoice_list');
      case 'invoiceDetail':
        return rpc('bb_dcc_invoice_detail',{p_invoice_no:String(params.invoiceNo||'')});
      case 'invoiceHistoryRevision': {
        const revision=await rpc('bb_dcc_revision');
        return {success:true,revision:String(revision||'')};
      }
      case 'dccMyState':
        return rpc('bb_dcc_my_state');
      default:
        throw new Error('Unsupported Daily Cash action: '+action);
    }
  }

  async function apiPost(params={}){
    const action=String(params.action||'');
    if(action==='dccCreateRequest'){
      return rpc('bb_dcc_create_request',{p_payload:payload(params.requestData)});
    }
    throw new Error('Unsupported Daily Cash write action: '+action);
  }

  async function accessProfile(){return rpc('bb_dcc_access_profile');}

  async function locationMap(){
    const p=await accessProfile();
    const map={};
    (Array.isArray(p?.locations)?p.locations:[]).forEach(l=>{
      const code=String(l?.locationCode||'').trim();
      if(code)map[code.toLowerCase()]=String(l?.locationName||code).trim()||code;
    });
    return map;
  }

  window.BBDailyCashAdapter={rpc,api,apiPost,ensureSession,accessProfile,locationMap};
})();