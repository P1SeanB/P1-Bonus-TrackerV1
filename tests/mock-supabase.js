// In-memory Supabase stand-in for headless UI tests. Enforces the append-only triggers the migration installs.
(function(){
  const DB=window.__DB=window.__DB||{};
  const APPEND_ONLY=['rmr_comm_events','rmr_credit_shares','rmr_ledger_entries','rmr_cost_versions','rmr_plan_acknowledgements','rmr_receipt_verifications','rmr_plan_history','rmr_billing_log_audit_v22'];
  const UNIQUE={rmr_comm_events:'event_uid',rmr_ledger_entries:'entry_uid',rmr_worklist:'item_uid',rmr_vista_invoices:'invoice_number',rmr_vista_receipts:'receipt_key',rmr_settings:'key',rmr_users:'email',rmr_receipt_verifications:'verification_uid'};
  let seq=1000;
  function Q(table){ this.t=table; this.f=[]; this.op='select'; this.ord=null; this.rng=null; this.lim=null; this.payload=null; this.opts={}; this.ret=false; }
  const P=Q.prototype;
  P.select=function(){ if(this.op==='select')this.op='select'; else this.ret=true; return this; };
  P.order=function(c,o){ this.ord=[c,(o&&o.ascending===false)?-1:1]; return this; };
  P.range=function(a,b){ this.rng=[a,b]; return this; };
  P.limit=function(n){ this.lim=n; return this; };
  P.eq=function(c,v){ this.f.push(r=>String(r[c])===String(v)); return this; };
  P.neq=function(c,v){ this.f.push(r=>String(r[c])!==String(v)); return this; };
  P.in=function(c,vs){ this.f.push(r=>vs.map(String).includes(String(r[c]))); return this; };
  P.ilike=function(c,p){ const re=new RegExp('^'+p.replace(/%/g,'.*')+'$','i'); this.f.push(r=>re.test(String(r[c]||''))); return this; };
  P.insert=function(p){ this.op='insert'; this.payload=Array.isArray(p)?p:[p]; return this; };
  P.upsert=function(p,o){ this.op='upsert'; this.payload=Array.isArray(p)?p:[p]; this.opts=o||{}; return this; };
  P.update=function(p){ this.op='update'; this.payload=p; return this; };
  P.delete=function(){ this.op='delete'; return this; };
  P.then=function(res,rej){ try{ res(this.exec()); }catch(e){ rej?rej(e):res({data:null,error:{message:e.message}}); } };
  P.exec=function(){
    if(!(this.t in DB)){ if(window.__MISSING&&window.__MISSING.includes(this.t)) return {data:null,error:{message:`relation "public.${this.t}" does not exist`}}; DB[this.t]=[]; }
    const T=DB[this.t]; const match=r=>this.f.every(fn=>fn(r));
    if(this.op==='select'){ let rows=T.filter(match); if(this.ord){ const [c,d]=this.ord; rows=rows.slice().sort((a,b)=>String(a[c]??'').localeCompare(String(b[c]??''),undefined,{numeric:true})*d); } if(this.rng)rows=rows.slice(this.rng[0],this.rng[1]+1); if(this.lim)rows=rows.slice(0,this.lim); return {data:JSON.parse(JSON.stringify(rows)),error:null}; }
    if(this.op==='insert'||this.op==='upsert'){ const key=(this.opts.onConflict)||UNIQUE[this.t]; const out=[];
      for(const r0 of this.payload){ const r=JSON.parse(JSON.stringify(r0)); if(r.id==null)r.id=(this.t==='rmr_agreements'||this.t==='rmr_plan_versions')?('id-'+(++seq)):(++seq); if(!r.created_at)r.created_at=new Date().toISOString();
        const ex=key?T.find(x=>String(x[key])===String(r[key])):null;
        if(ex){ if(this.op==='insert')return {data:null,error:{message:`duplicate key value violates unique constraint (${key})`}}; if(this.opts.ignoreDuplicates)continue; if(APPEND_ONLY.includes(this.t))return {data:null,error:{message:'append-only'}}; Object.assign(ex,r,{id:ex.id}); out.push(ex); continue; }
        if(this.t==='rmr_plan_assignments'){ const v=(DB.rmr_plan_versions||[]).find(x=>String(x.id)===String(r.plan_version_id)); if(!v||v.status!=='published'||(v.config&&v.config.placeholder))return {data:null,error:{message:'Rejected: only a published, configured plan version can be assigned'}}; }
        T.push(r); out.push(r); }
      return {data:JSON.parse(JSON.stringify(out)),error:null}; }
    if(this.op==='update'){ if(APPEND_ONLY.includes(this.t))return {data:null,error:{message:`Table ${this.t} is append-only`}}; const rows=T.filter(match);
      for(const r of rows){ if(this.t==='rmr_plan_versions'&&r.status==='published'&&!(this.payload.status==='retired'))return {data:null,error:{message:'published and immutable'}}; Object.assign(r,JSON.parse(JSON.stringify(this.payload))); } return {data:rows,error:null}; }
    if(this.op==='delete'){ if(APPEND_ONLY.includes(this.t))return {data:null,error:{message:'append-only'}}; DB[this.t]=T.filter(r=>!match(r)); return {data:null,error:null}; }
  };
  window.supabase={createClient:()=>({
    from:t=>new Q(t),
    auth:{getSession:async()=>({data:{session:{user:{email:window.__EMAIL||'sean.bithell@point1.com'}}}}),onAuthStateChange:()=>{},signOut:async()=>({}),signInWithPassword:async()=>({error:null}),signUp:async({email})=>{ (window.__SIGNUPS=window.__SIGNUPS||[]).push(email); return {data:{user:{email,identities:[{id:1}]}},error:null}; },updateUser:async()=>({data:{},error:null})},
    rpc:async(fn)=>{ if(fn==='rmr_password_set'){ (window.__DB.rmr_users||[]).forEach(u=>{ if(u.email===(window.__EMAIL||'sean.bithell@point1.com'))u.must_set_password=false; }); } return {data:null,error:null}; },
    storage:{from:()=>({list:async()=>({data:[],error:null}),upload:async()=>({error:null}),createSignedUrl:async()=>({data:{signedUrl:'#'}})})}
  })};
})();
