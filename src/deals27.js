/* ===================================================================================================
   Deals & Customers (P1RMR-62).
   One Deals list carries a sale from Opportunity → Quoted → Signed → Sold; when every payment is
   paid it leaves Deals and lives on the Customers page, grouped under its customer. A renewal or
   rate change from Vista brings the agreement back to Deals as its own row until it is paid.
   The legacy Pipeline and Agreements views stay (the flat list), reachable from the Deals page.
   =================================================================================================== */
"use strict";

/* ---------------- stages ---------------- */
const STAGE27={
  opportunity:{label:'Opportunity',css:'st27-opp'},
  quoted:{label:'Quoted',css:'st27-quo'},
  signed:{label:'Signed',css:'st27-sig'},
  sold:{label:'Sold',css:'st27-sold'},
  lost:{label:'Lost',css:'st27-lost'}
};
const LOST_REASONS27=[['price','Price'],['competitor','Went with competitor'],['timing','Timing / no budget'],['no_response','No response'],['scope','Scope changed'],['other','Other']];
const SOURCES27=[['','—'],['referral','Referral'],['existing','Existing customer'],['hunter','Hunter outreach'],['inbound','Inbound / web'],['vista','Found in Vista'],['other','Other']];
const lostLabel27=c=>{const m=LOST_REASONS27.find(x=>x[0]===c);return m?m[1]:(c||'');};
function stageChip27(s,extra){ const d=STAGE27[s]||STAGE27.opportunity; return `<span class="chip ${d.css}">${d.label}</span>${extra||''}`; }

/* ---------------- shell: nav, pages, styles ---------------- */
(function initDeals27(){
  const css=document.createElement('style'); css.textContent=`
  .chip.st27-opp{color:#555555;background:#eeeeee}
  .chip.st27-quo{color:#5b3fb0;background:#f1edfb}
  .chip.st27-sig{color:#46309a;background:#e3dcf6}
  .chip.st27-sold{color:#ffffff;background:#4b2e8a}
  .chip.st27-lost{color:#6e6e6e;background:transparent;border:1px solid #c9c9c9}
  .tot27{display:flex;gap:18px;flex-wrap:wrap;align-items:baseline;padding:8px 14px;margin:0 0 8px;border:1px solid var(--line);border-radius:8px;background:#fafbfc;font-size:12.5px}
  .tot27 .lb{font-weight:800;color:var(--ink);margin-right:auto}
  .tot27 .it{color:var(--muted)} .tot27 .it b{color:var(--ink);font-size:14px}
  .pillrow27{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:2px 0 12px}
  .pillrow27 button{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:5px 13px;font-size:12px;font-weight:600;cursor:pointer;color:var(--muted)}
  .pillrow27 button.on{background:#1c1c1c;color:#fff;border-color:#1c1c1c}
  .pillrow27 .cnt{opacity:.75;font-weight:500;margin-left:4px}
  .cust27{border:1px solid var(--line);border-radius:10px;background:var(--card);margin-bottom:8px;overflow:hidden}
  .cust27>.hd{display:flex;gap:14px;align-items:center;padding:10px 14px;cursor:pointer;user-select:none;flex-wrap:wrap}
  .cust27>.hd:hover{background:#fafbfc}
  .cust27 .nm{font-weight:800;font-size:13.5px}
  .cust27 .mut{color:var(--muted);font-size:12px}
  .cust27 .bd{border-top:1px solid var(--line);padding:4px 14px 10px}
  .cust27 table{width:100%;font-size:12.5px;border-collapse:collapse}
  .cust27 td,.cust27 th{padding:6px 8px;border-bottom:1px solid #f0f2f5;text-align:left}
  .cust27 td.num,.cust27 th.num{text-align:right}
  .cust27 tr.rowlink:hover{background:#f7f8fb;cursor:pointer}
  .flag27{display:inline-block;font-size:10px;font-weight:700;border-radius:999px;padding:2px 8px;margin-left:4px}
  .flag27.red{color:var(--held);background:var(--held-bg)}
  .flag27.amb{color:var(--maturing);background:var(--maturing-bg)}
  .flag27.grn{color:var(--payable);background:var(--payable-bg)}
  #lostForm27{position:fixed;inset:0;background:rgba(20,20,28,.45);z-index:260;display:flex;align-items:center;justify-content:center}
  #lostForm27 .bx{background:var(--card);border-radius:12px;padding:18px 20px;max-width:430px;width:92%;font-size:13px}
  #lostForm27 label{display:block;font-size:11.5px;font-weight:700;color:var(--muted);margin:10px 0 3px}
  #lostForm27 select,#lostForm27 input,#lostForm27 textarea{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--line);border-radius:7px;font:inherit;font-size:12.5px}
  .tl27{font-size:12.5px;border-left:2px solid #e3dcf6;margin:6px 0 10px 6px;padding-left:14px}
  .tl27 .ev{position:relative;padding:5px 0}
  .tl27 .ev:before{content:'';position:absolute;left:-19.5px;top:11px;width:9px;height:9px;border-radius:50%;background:#4b2e8a}
  .tl27 .ev.rc:before{background:#9b87d4}
  `; document.head.appendChild(css);

  // nav entries + sections
  if(typeof TAB27!=='object') return;
  TAB27.deals='tabDeals'; TAB27.customers='tabCustomers';
  ICON27.deals=ICON27.opportunities||ICON27.agreements||''; ICON27.customers=ICON27.agreements||'';
  PAGE27.deals=['Deals','Every sale on its way to paid: Opportunity → Quoted → Signed → Sold. Paid deals move to Customers.','My deals','Your sales from first contact to paid commission.'];
  PAGE27.customers=['Customers','Every customer and every agreement under them. Finished deals live here.','My customers','Your customers and their agreements.'];
  PAGE27.opportunities=['Pipeline (legacy)','This page merged into Deals.','Pipeline','This page merged into Deals.'];
  PAGE27.agreements=['All agreements','The flat list of every agreement, for sorting. Deals and Customers are the working views.','My deals (list)','The flat list of your agreements.'];
  const swap=arr=>{ const i=arr.findIndex(x=>Array.isArray(x)&&x[0]==='opportunities'); if(i>=0)arr.splice(i,1,['deals',arr===NAV27.rep?'My deals':'Deals']);
    const j=arr.findIndex(x=>Array.isArray(x)&&x[0]==='agreements'); if(j>=0)arr.splice(j,1,['customers','Customers']); };
  swap(NAV27.team); swap(NAV27.rep);
  const nav=document.querySelector('#side27 nav.tabs'); const main=document.querySelector('#app main');
  [['deals','tabDeals'],['customers','tabCustomers']].forEach(([v,id])=>{
    if($(id))return;
    const b=document.createElement('button'); b.id=id; b.dataset.view=v; b.onclick=()=>switchView(v); nav.appendChild(b);
    const sec=document.createElement('section'); sec.id='view-'+v; sec.style.display='none'; sec.innerHTML=`<div id="${v}Host27" class="pg27"></div>`; main.appendChild(sec); });
  // sales reports container
  const vr=$('view-reports'); if(vr&&!$('salesRep27')){ const d=document.createElement('div'); d.id='salesRep27'; vr.insertBefore(d,vr.firstChild); }
  try{ decorateNav27(); }catch(e){}
  // render hook
  const rd=window.render;
  window.render=function(){ rd.apply(this,arguments);
    try{ if(view==='deals')renderDeals27(); if(view==='customers')renderCustomers27(); if(view==='reports')renderSalesReports27(); }catch(e){ console.warn('deals27',e); } };
  // lost flow replaces the prompt() dialog
  const lb=$('oppLost'); if(lb) lb.onclick=()=>lostForm27(editingOppId);
  const sv=$('oppSave'); if(sv) sv.onclick=()=>saveOpp27();
  injectSourceField27();
  initModal27();
})();

/* ---------------- period filter (shared, trimmed) ---------------- */
function pf27(){ try{ return JSON.parse(LS.get('pf27')||'0')||{preset:'all'}; }catch(e){ return {preset:'all'}; } }
function pfRange27(){
  const p=pf27(); const t=E27.businessToday(); const y=+t.slice(0,4); const q=Math.floor((+t.slice(5,7)-1)/3);
  const qr=(yy,qq)=>[`${yy}-${String(qq*3+1).padStart(2,'0')}-01`, `${yy}-${String(qq*3+3).padStart(2,'0')}-${qq===0?'31':qq===1?'30':qq===2?'30':'31'}`];
  if(p.preset==='thisq'){const[a,b]=qr(y,q);return{from:a,to:b};}
  if(p.preset==='lastq'){const yy=q===0?y-1:y, qq=q===0?3:q-1;const[a,b]=qr(yy,qq);return{from:a,to:b};}
  if(p.preset==='ytd')return{from:`${y}-01-01`,to:t};
  if(p.preset==='lasty')return{from:`${y-1}-01-01`,to:`${y-1}-12-31`};
  if(p.preset==='custom')return{from:p.from||'0000',to:p.to||'9999'};
  return null; // all time
}
function pfIn27(d){ const r=pfRange27(); if(!r)return true; if(!d)return false; d=String(d).slice(0,10); return d>=r.from&&d<=r.to; }
function pfBar27(onchange){
  const p=pf27(); const opts=[['all','All time'],['thisq','This quarter'],['lastq','Last quarter'],['ytd','Year to date'],['lasty','Last year'],['custom','Custom']];
  const id='pfb'+Math.floor(Math.random()*1e6);
  setTimeout(()=>{ const host=$(id); if(!host)return;
    host.querySelectorAll('[data-pf]').forEach(b=>b.onclick=()=>{ const np={...pf27(),preset:b.dataset.pf}; LS.set('pf27',JSON.stringify(np)); onchange(); });
    host.querySelectorAll('[data-pfd]').forEach(i=>i.onchange=()=>{ const np={...pf27(),preset:'custom'}; np[i.dataset.pfd]=i.value; LS.set('pf27',JSON.stringify(np)); onchange(); });
  },0);
  return `<span id="${id}" style="display:inline-flex;gap:5px;align-items:center;flex-wrap:wrap">
    ${opts.map(([k,l])=>`<button data-pf="${k}" class="${p.preset===k?'on':''}">${l}</button>`).join('')}
    ${p.preset==='custom'?`<input type="date" class="cfg-in" data-pfd="from" value="${esc(p.from||'')}" style="font-size:11.5px"> – <input type="date" class="cfg-in" data-pfd="to" value="${esc(p.to||'')}" style="font-size:11.5px">`:''}
  </span>`;
}

/* clickable column sorting for the Deals and Hunt tables */
let DSORT27=(()=>{ try{ return JSON.parse(LS.get('dsort27')||'0')||{k:null,d:1}; }catch(e){ return {k:null,d:1}; } })();
const STORD27={opportunity:0,quoted:1,signed:2,sold:3,lost:4};
function sortVal27(r,k){ const a=r.a;
  switch(k){ case 'deal': return String(custNameOf27(a)||a.customer_name||'').toLowerCase();
    case 'stage': return STORD27[r.stage]!=null?STORD27[r.stage]:(r.lost?4:5);
    case 'what': return String(r.label||r.what||'').toLowerCase();
    case 'owner': return String(a.owner_email||'').toLowerCase();
    case 'mrr': return r.rmr==null?-1:+r.rmr;
    case 'comm': return r.amount==null?-1:+r.amount;
    case 'date': return String(r.date||'');
    case 'why': return String(r.why||'').toLowerCase();
    case 'revisit': return String(r.revisit||'');
    case 'age': return r.date?-new Date(r.date).getTime():0;
    default: return 0; } }
function applySort27(list){ if(!DSORT27.k)return list; const k=DSORT27.k,d=DSORT27.d;
  return [...list].sort((x,y)=>{ const a=sortVal27(x,k),b=sortVal27(y,k); return (a<b?-1:a>b?1:0)*d; }); }
function th27(label,k,cls){ const on=DSORT27.k===k; return `<th data-dsort="${k}" class="${cls||''}" style="cursor:pointer;user-select:none" title="Sort by ${esc(label)}">${label}${on?(DSORT27.d>0?' ▲':' ▼'):''}</th>`; }
function wireSort27(host,rerender){ host.querySelectorAll('[data-dsort]').forEach(h=>h.onclick=()=>{ const k=h.dataset.dsort;
  DSORT27=DSORT27.k===k?{k,d:-DSORT27.d}:{k,d:(k==='mrr'||k==='comm'||k==='date')?-1:1}; LS.set('dsort27',JSON.stringify(DSORT27)); rerender(); }); }

/* friendlier next-step text: readable dates, plain wording */
function niceNote27(t){ t=plainText27(t||''); return String(t).replace(/\b(\d{4}-\d{2}-\d{2})\b/g,(m)=>fmtD27(m)).replace(/^earned /i,'Earned '); }

/* totals line that follows the current filter and search */
function totalsBar27(items,label){
  return `<div class="tot27"><span class="lb">${esc(label||'')}</span>${items.map(([v,k])=>`<span class="it"><b>${v}</b> ${esc(k)}</span>`).join('')}</div>`; }

/* ---------------- deal rows ---------------- */
function custNoOf27(a){
  if(a.customer_number)return String(a.customer_number);
  try{ const t=(TERMS_BY_NO[String(a.agreement_number)]||[])[0];
    if(t&&t.customer){ const m=String(t.customer).match(/^\s*([^\s(]+)/); if(m)return m[1]; } }catch(e){}
  return null;
}
function custNameOf27(a){
  if(a.customer_name)return a.customer_name;
  try{ const t=(TERMS_BY_NO[String(a.agreement_number)]||[])[0];
    if(t&&t.customer){ const m=String(t.customer).match(/\(([^)]+)\)\s*$/); if(m)return m[1]; } }catch(e){}
  return '';
}
function openWork27(a){
  // open commission work on a won agreement: one row per event that is not finished
  const rows=[];
  if(!isRevisedTransaction(a)){
    if(!a.history_only&&!committedEventsFor(a).length) rows.push({kind:'new_sale',state:'signed',note:'Not marked sold yet.',date:eventDateOf(a)});
    return rows;
  }
  let P=null; try{ P=pricedEvents27(a); }catch(e){}
  if(!P||!P.length){
    if(!a.history_only) rows.push({kind:'new_sale',state:'signed',note:'Set up the agreement — no Vista terms or rate yet.',date:eventDateOf(a)});
    return rows;
  }
  const L=hybridLines27(a)||[]; const by={}; L.forEach(l=>{(by[l.uid]=by[l.uid]||[]).push(l);});
  P.forEach(p=>{
    if(p.noPay||p.override)return;                                   // nothing pays, or paid under the override
    const ls=by[p.uid]||[]; const open=ls.filter(l=>l.rstate!=='paid');
    if(!p.evRow){ rows.push({p,kind:p.e.kind,state:'signed',date:p.date,note:p.blocked?plainText27(p.blocked):'Not marked sold yet — a manager records the commission event.',amount:p.calc?Number(p.calc.totalCents)/100:null}); return; }
    if(!p.calc){ rows.push({p,kind:p.e.kind,state:'sold',date:p.date,note:plainText27(p.blocked||'Blocked'),amount:Number(p.evRow.total_cents)/100,soldBy:p.evRow.created_by||null,soldOn:String(p.evRow.created_at||'').slice(0,10)}); return; }
    if(open.length) rows.push({p,kind:p.e.kind,state:'sold',date:p.date,note:open[0].note,amount:open.reduce((s,l)=>s+l.amount,0),open,
      soldBy:p.evRow.created_by||null,soldOn:String(p.evRow.created_at||'').slice(0,10)});
  });
  return rows;
}
function dealRows27(){
  const out=[]; const t=E27.businessToday();
  const opps=(typeof scopedOpps==='function'?scopedOpps():[]);
  opps.forEach(a=>{
    const revisit=a.revisit_date&&String(a.revisit_date).slice(0,10)<=t;
    if(a.stage==='lost'){
      if(revisit){ out.push({a,stage:'opportunity',label:'Sale',rmr:+a.est_monthly_rmr||null,date:String(a.revisit_date).slice(0,10),note:'Revisit — was lost: '+(lostLabel27(a.lost_reason_code)||a.lost_reason||''),revisitTag:true}); return; }
      out.push({a,stage:'lost',label:'Sale',rmr:+a.est_monthly_rmr||null,date:(a.stage_dates&&a.stage_dates.lost)||String(a.updated_at||'').slice(0,10),note:lostLabel27(a.lost_reason_code)||a.lost_reason||'',revisit:a.revisit_date||null}); return; }
    out.push({a,stage:a.stage==='quoting'?'quoted':'opportunity',label:'Sale',rmr:+a.est_monthly_rmr||null,
      date:a.stage==='quoting'?((a.stage_dates&&a.stage_dates.quoted)||String(a.updated_at||'').slice(0,10)):String(a.created_at||'').slice(0,10),
      note:a.estimate_ref?('Estimate '+a.estimate_ref):'',revisitTag:revisit});
  });
  const ags=(typeof scopedAgreements==='function'?scopedAgreements():[]);
  ags.forEach(a=>{ if(isPipeline(a)||isEnded(a))return;
    let rows=[]; try{ rows=openWork27(a); }catch(e){}
    rows.forEach(r=>{
      const lab=r.kind==='new_sale'?'Sale':(KIND_LABEL27&&KIND_LABEL27[r.kind])||r.kind;
      out.push({a,stage:r.state,label:lab,rmr:r.p&&r.p.e.next!=null?+r.p.e.next:(+agreementMrr(a)||null),
        date:r.date,note:r.note||'',amount:r.amount,soldBy:r.soldBy,soldOn:r.soldOn});
    });
  });
  return out;
}

/* ---------------- Deals page ---------------- */
let DEAL_PILL27=LS.get('dealPill27')||'open';
function renderDeals27(){
  const host=$('dealsHost27'); if(!host)return;
  if(!signedIn){ host.innerHTML='<div class="empty"><b>Sign in</b></div>'; return; }
  let rows=[]; try{ rows=dealRows27(); }catch(e){ console.warn(e); }
  const n=s=>rows.filter(r=>r.stage===s).length;
  const openRows=rows.filter(r=>r.stage!=='lost');
  const lostRows=rows.filter(r=>r.stage==='lost'||r.cancelled);
  const pills=[['open','All open',openRows.length],['opportunity','Opportunity',n('opportunity')],['quoted','Quoted',n('quoted')],['signed','Signed',n('signed')],['sold','Sold',n('sold')],['lost','Lost / hunt list',null]];
  const q=(window.DEAL_Q27||'').toLowerCase();
  let list=DEAL_PILL27==='open'?openRows:DEAL_PILL27==='lost'?huntRows27():rows.filter(r=>r.stage===DEAL_PILL27);
  if(q)list=list.filter(r=>String(r.a.customer_name||'').toLowerCase().includes(q)||String(r.a.agreement_number||'').toLowerCase().includes(q)||String(r.a.opportunity_number||'').toLowerCase().includes(q));
  const ord={opportunity:0,quoted:1,signed:2,sold:3,lost:4};
  list=[...list].sort((x,y)=>(ord[x.stage]-ord[y.stage])||String(y.date||'').localeCompare(String(x.date||''))); list=applySort27(list);
  const team=canViewAll();
  const sumRmr=openRows.filter(r=>r.a.category!=='sla').reduce((s,r)=>s+(+r.rmr||0),0), sumSla=openRows.filter(r=>r.a.category==='sla').reduce((s,r)=>s+(+r.rmr||0),0);
  host.innerHTML=`
   <div class="kpis27">
    <div class="kpi27 hero"><span class="k">Open deals</span><span class="v">${openRows.length}</span><span class="s">opportunity → sold, not yet fully paid</span></div>
    <div class="kpi27"><span class="k">Open deal RMR</span><span class="v">${money27(sumRmr)}</span><span class="s">per month on open RMR deals (not the whole book)${sumSla?` · SLA deals ${money27(sumSla)}/mo separate`:''}</span></div>
    <div class="kpi27"><span class="k">Waiting on a manager</span><span class="v">${n('signed')}</span><span class="s">signed, not marked sold yet</span></div>
    <div class="kpi27"><span class="k">Sold, unpaid</span><span class="v">${n('sold')}</span><span class="s">commission recorded, a payment still open</span></div></div>
   <div class="pillrow27">${pills.map(([k,l,c])=>`<button data-pill="${k}" class="${DEAL_PILL27===k?'on':''}">${l}${c!=null?`<span class="cnt">${c}</span>`:''}</button>`).join('')}
     <span style="flex:1"></span>
     <input id="dealQ27" class="cfg-in" placeholder="Search customer / #" value="${esc(window.DEAL_Q27||'')}" style="width:190px;font-size:12px">
     ${can('editOpps')?'<button class="btn-primary" id="dealNew27" style="padding:7px 14px">New opportunity</button>':''}
     <button class="iconbtn" id="dealFlat27" title="The flat, sortable list of every agreement">All agreements ▸</button></div>
   ${DEAL_PILL27==='lost'?`<div class="pillrow27" style="margin-top:-4px">${pfBar27(renderDeals27)}</div>`:''}
   <div id="dealTbl27"></div>`;
  host.querySelectorAll('[data-pill]').forEach(b=>b.onclick=()=>{ DEAL_PILL27=b.dataset.pill; LS.set('dealPill27',DEAL_PILL27); renderDeals27(); });
  $('dealQ27').oninput=function(){ window.DEAL_Q27=this.value; renderDeals27(); const i=$('dealQ27'); i.focus(); i.setSelectionRange(i.value.length,i.value.length); };
  if($('dealNew27'))$('dealNew27').onclick=()=>openOpp(null);
  $('dealFlat27').onclick=()=>switchView('agreements');
  if(DEAL_PILL27==='lost'){ renderHunt27(list); return; }
  const tb=$('dealTbl27');
  if(!list.length){ tb.innerHTML='<div class="empty"><b>Nothing here</b>Deals appear as opportunities are created and leave once every commission payment is paid.</div>'; return; }
  const tMrr=list.reduce((s,r)=>s+(+r.rmr||0),0), tCom=list.reduce((s,r)=>s+(+r.amount||0),0);
  const pillName=(pills.find(x=>x[0]===DEAL_PILL27)||[0,''])[1];
  tb.innerHTML=`${totalsBar27([[list.length+' deal'+(list.length===1?'':'s'),'showing'],[fmt(tMrr)+'/mo','monthly RMR'],[fmt2(tCom),'commission']],pillName+(q?` · matching "${esc(window.DEAL_Q27)}"`:''))}
  <div class="panel"><div class="admin-body" style="padding:0"><table class="cfg-table" style="font-size:12.5px"><thead><tr>
    ${th27('Deal','deal')}${th27('Stage','stage')}${th27('What','what')}${team?th27('Owner','owner'):''}${th27('MRR','mrr','num')}${th27('Commission','comm','num')}${th27('Date','date')}<th>Next step</th><th></th></tr></thead><tbody>
   ${list.map((r,i)=>{ const a=r.a; const no=a.agreement_number?('#'+a.agreement_number):(a.opportunity_number||'—');
     return `<tr data-dl="${i}" class="rowlink">
      <td><b>${esc(custNameOf27(a)||a.customer_name||'—')}</b><div class="qctx">${esc(no)}${a.site_number?' · site '+esc(a.site_number):''}</div></td>
      <td>${stageChip27(r.stage,r.revisitTag?' <span class="flag27 amb">Revisit</span>':'')}</td>
      <td>${esc(r.label)}</td>
      ${team?`<td style="font-size:11.5px;color:var(--muted)">${esc(a.owner_email||'—')}</td>`:''}
      <td class="num mono">${r.rmr!=null?fmt(+r.rmr):'—'}</td>
      <td class="num mono">${r.amount!=null?fmt2(r.amount):'—'}</td>
      <td class="mono" style="color:var(--muted)">${r.date?esc(fmtD27(r.date)):'—'}</td>
      <td style="min-width:240px">${esc(niceNote27(r.note))}${r.soldBy?`<div class="qctx" style="font-size:12.5px">Sold ✓ ${esc(nameOf27(r.soldBy))}${r.soldOn?' · '+esc(fmtD27(r.soldOn)):''}</div>`:''}</td>
      <td>${(r.stage==='opportunity'||r.stage==='quoted')&&can('editOpps')?`<button class="iconbtn" data-dedit="${i}">Edit</button>${can('editAgreements')?` <button class="iconbtn" data-dwin="${i}">Win ▸</button>`:''}`:''}</td>
     </tr>`; }).join('')}
   <tr style="font-weight:800;background:#fafbfc"><td>Total · ${list.length}</td><td></td><td></td>${team?'<td></td>':''}<td class="num mono">${fmt(tMrr)}</td><td class="num mono">${fmt2(tCom)}</td><td colspan="3"></td></tr>
  </tbody></table></div></div>
  <div class="qctx" style="margin-top:8px">A deal leaves this page once every commission payment on it is paid; it then lives under <b>Customers</b>. A renewal or rate change from Vista brings the agreement back as its own row.</div>`;
  wireSort27(tb,renderDeals27);
  tb.querySelectorAll('[data-dedit]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); openOpp(list[+b.dataset.dedit].a.id); });
  tb.querySelectorAll('[data-dwin]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); winOpp(list[+b.dataset.dwin].a.id); });
  tb.querySelectorAll('tr[data-dl]').forEach(tr=>tr.onclick=()=>{ const r=list[+tr.dataset.dl];
    if(r.stage==='opportunity'||r.stage==='quoted'){ if(can('editOpps'))openOpp(r.a.id); return; }
    if(can('editAgreements'))openModal(r.a.id); });
}

/* ---------------- hunt list (lost + cancelled) ---------------- */
function huntRows27(){
  const out=[];
  (typeof scopedOpps==='function'?scopedOpps():[]).forEach(a=>{ if(a.stage!=='lost')return;
    out.push({a,why:lostLabel27(a.lost_reason_code)||a.lost_reason||'—',what:'Lost quote',rmr:+a.est_monthly_rmr||null,
      date:(a.stage_dates&&a.stage_dates.lost)||String(a.updated_at||'').slice(0,10),revisit:a.revisit_date||null,lost:true}); });
  (typeof scopedBook==='function'?scopedBook():[]).forEach(a=>{
    if(isPipeline(a)||!isEnded(a)||a.consolidated_into)return;                    // consolidations aren't losses
    let rate=+a.monthly_rmr||null; try{ const tl=tlFor(a); if(tl&&tl.currentRate)rate=tl.currentRate; }catch(e){}
    out.push({a,why:a.cancel_reason||'Cancelled / not renewed',what:'Cancelled account',rmr:rate,date:String(a.ended_date||'').slice(0,10),revisit:a.revisit_date||null}); });
  return out.filter(r=>pfIn27(r.date)||!r.date).sort((x,y)=>String(y.date||'').localeCompare(String(x.date||'')));
}
function renderHunt27(list){
  const tb=$('dealTbl27'); const team=canViewAll(); const t=E27.businessToday();
  if(!list.length){ tb.innerHTML='<div class="empty"><b>Nothing to hunt</b>Lost quotes and cancelled accounts land here so they can be chased again.</div>'; return; }
  const hM=list.reduce((s,r)=>s+(+r.rmr||0),0), nL=list.filter(r=>r.lost).length;
  tb.innerHTML=`${totalsBar27([[String(list.length),'showing'],[String(nL),'lost quotes'],[String(list.length-nL),'cancelled accounts'],[fmt(hM)+'/mo','monthly RMR to win back']],'Hunt list'+((window.DEAL_Q27||'')?` · matching "${esc(window.DEAL_Q27)}"`:''))}
  <div class="panel"><div class="panel-head"><h2>Hunt list</h2><span class="qctx">lost quotes and cancelled accounts — worth another call. A win-back pays as its own commission.</span></div>
  <div class="admin-body" style="padding:0"><table class="cfg-table" style="font-size:12.5px"><thead><tr>
    ${th27('Customer','deal')}${th27('What','stage')}${th27('Why','why')}${team?th27('Owner','owner'):''}${th27('MRR','mrr','num')}${th27('Lost / ended','date')}${th27('Age','age')}${th27('Revisit','revisit')}<th></th></tr></thead><tbody>
   ${list.map((r,i)=>{ const a=r.a; const age=r.date?Math.max(0,Math.round((new Date(t)-new Date(r.date))/86400000)):null;
     return `<tr><td><b>${esc(a.customer_name||'—')}</b><div class="qctx">${esc(a.agreement_number?('#'+a.agreement_number):(a.opportunity_number||''))}</div></td>
      <td>${r.lost?stageChip27('lost'):'<span class="chip c-held">Cancelled</span>'} <span style="font-size:11px">${esc(r.what)}</span></td>
      <td style="font-size:11.5px">${esc(r.why)}</td>
      ${team?`<td style="font-size:11.5px;color:var(--muted)">${esc(a.owner_email||'—')}</td>`:''}
      <td class="num mono">${r.rmr!=null?fmt(+r.rmr):'—'}</td>
      <td class="mono" style="color:var(--muted)">${r.date?esc(fmtD27(r.date)):'—'}</td><td class="mono">${age!=null?age+'d':'—'}</td>
      <td class="mono">${r.revisit?esc(fmtD27(r.revisit)):'—'}</td>
      <td>${r.lost&&can('editOpps')?`<button class="iconbtn" data-hreopen="${i}">Reopen</button>`:''}</td></tr>`; }).join('')}
   <tr style="font-weight:800;background:#fafbfc"><td>Total · ${list.length}</td><td></td><td></td>${team?'<td></td>':''}<td class="num mono">${fmt(hM)}</td><td colspan="4"></td></tr>
  </tbody></table></div></div>`;
  wireSort27(tb,renderDeals27);
  tb.querySelectorAll('[data-hreopen]').forEach(b=>b.onclick=()=>reopenOpp(list[+b.dataset.hreopen].a.id));
}

/* ---------------- lost form (replaces the blocking prompt) ---------------- */
function lostForm27(id){
  const a=AGREEMENTS.find(x=>x.id===id); if(!a)return;
  let f=$('lostForm27'); if(f)f.remove();
  f=document.createElement('div'); f.id='lostForm27';
  f.innerHTML=`<div class="bx"><b style="font-size:14px">Mark lost — ${esc(a.customer_name||'')}</b>
    <label>Why was it lost?</label><select id="lf_code">${LOST_REASONS27.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select>
    <label>Note (optional)</label><input id="lf_note" placeholder="what happened">
    <label>Revisit on (optional — it returns to Deals as an opportunity that day)</label><input id="lf_rev" type="date">
    <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="iconbtn" id="lf_x">Cancel</button><button class="btn-primary" id="lf_go">Mark lost</button></div></div>`;
  document.body.appendChild(f);
  $('lf_x').onclick=()=>f.remove();
  $('lf_go').onclick=async()=>{
    const code=$('lf_code').value, note=$('lf_note').value.trim(), rev=$('lf_rev').value||null;
    const t=E27.businessToday();
    const full={stage:'lost',lost_reason:note||lostLabel27(code),lost_reason_code:code,revisit_date:rev,stage_dates:{...(a.stage_dates||{}),lost:t},updated_at:new Date().toISOString()};
    let {error}=await sb.from('rmr_agreements').update(full).eq('id',id);
    if(error&&/column|schema/i.test(error.message)){ ({error}=await sb.from('rmr_agreements').update({stage:'lost',lost_reason:(note||lostLabel27(code)),updated_at:new Date().toISOString()}).eq('id',id));
      if(!error)toast('Saved without the reason code — run migration_v28_deals.sql for full lost tracking.'); }
    if(error){toast(error.message);return;}
    Object.assign(a,full); audit('Opportunity lost','Deals',a.opportunity_number||a.agreement_number,null,{customer:a.customer_name,reason:code,note,revisit:rev},null);
    f.remove(); if(typeof closeOpp==='function')closeOpp(); toast('Marked lost'); render();
  };
}

/* ---------------- opportunity form: Source field + stage dates ---------------- */
function injectSourceField27(){
  const est=$('o_est'); if(!est||$('o_source'))return;
  const fld=est.closest('.fld'); if(!fld)return;
  const d=document.createElement('div'); d.className='fld';
  d.innerHTML=`<label>Source <span class="hint">where this deal came from</span></label><select id="o_source">${SOURCES27.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select>`;
  fld.parentNode.insertBefore(d,fld);
  const oo=window.openOpp; window.openOpp=function(id){ oo.apply(this,arguments); try{ const a=AGREEMENTS.find(x=>x.id===id); $('o_source').value=(a&&a.source)||''; }catch(e){} };
}
async function saveOpp27(){
  // the legacy saveOpp, plus Source and the quoted stage date
  if(!sb){toast('Sign in first');return;}
  if(!can('editOpps')){ $('oppErr').textContent='Your role cannot create or edit opportunities.'; $('oppErr').style.display='block'; return; }
  const eid=editingOppId;
  if(eid&&!canViewAll()){ const ex=AGREEMENTS.find(a=>a.id===eid); if(ex&&(ex.owner_email||'').toLowerCase()!==(CURRENT_EMAIL||'').toLowerCase()){ $('oppErr').textContent='You can only edit your own opportunities.'; $('oppErr').style.display='block'; return; } }
  const cust=$('o_cust').value.trim();
  if(!cust){ $('oppErr').textContent='Customer / prospect is required.'; $('oppErr').style.display='block'; return; }
  const oppNo=$('o_num').value.trim()||nextOppNumber();
  const owner=(canViewAll()&&$('oppOwnerFld').style.display!=='none'&&$('o_owner').value)?$('o_owner').value
            :(eid?((AGREEMENTS.find(a=>a.id===eid)||{}).owner_email||CURRENT_EMAIL||null):(CURRENT_EMAIL||null));
  const prev=eid?(AGREEMENTS.find(a=>a.id===eid)||{}):{};
  const stage=$('o_stage').value||'opportunity';
  const sd={...(prev.stage_dates||{})}; if(stage==='quoting'&&!sd.quoted)sd.quoted=E27.businessToday();
  const fields={ opportunity_number:oppNo, customer_name:cust, stage,
    estimate_ref:$('o_est').value.trim()||null, est_monthly_rmr:($('o_rmr').value.trim()===''?null:(+$('o_rmr').value||0)),
    expected_close:$('o_close').value||null, notes:$('o_notes').value.trim()||null, owner_email:owner, monthly_rmr:prev.monthly_rmr||0,
    source:($('o_source')&&$('o_source').value)||null, stage_dates:sd };
  const doSave=async flds=>eid?sb.from('rmr_agreements').update({...flds,updated_at:new Date().toISOString()}).eq('id',eid)
    :sb.from('rmr_agreements').insert({...flds,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  try{
    let {error}=await doSave(fields);
    if(error&&/column|schema/i.test(error.message)){ const {source,stage_dates,...legacy}=fields; ({error}=await doSave(legacy));
      if(!error)toast('Saved without Source — run migration_v28_deals.sql.'); }
    if(error)throw error;
    await load();
    audit(eid?'Opportunity edited':'Opportunity created','Deals',oppNo,null,{opportunity:oppNo,customer:cust,stage,est_rmr:fields.est_monthly_rmr,source:fields.source},null);
    closeOpp(); toast(eid?'Opportunity updated':`Opportunity ${oppNo} created`);
  }catch(e){ $('oppErr').textContent=oppMigrationMsg(e); $('oppErr').style.display='block'; }
}

/* ---------------- Customers page ---------------- */
let CUST_OPEN27={};
function custFlags27(items){
  let pastNet=false,renewSoon=false,pending=false;
  const t=E27.businessToday(); const soon=E27.addDays(t,60);
  items.forEach(a=>{ if(isPipeline(a)||isEnded(a))return;
    try{ const w=openWork27(a); if(w.length)pending=true;
      (hybridLines27(a)||[]).forEach(l=>{ if(l.rstate!=='paid'&&/past net/i.test(l.note||''))pastNet=true; });
      const tl=tlFor(a); if(tl&&tl.live&&tl.current&&tl.current.end&&tl.current.end>=t&&tl.current.end<=soon)renewSoon=true; }catch(e){} });
  return {pastNet,renewSoon,pending};
}
function renderCustomers27(){
  const host=$('customersHost27'); if(!host)return;
  if(!signedIn){ host.innerHTML='<div class="empty"><b>Sign in</b></div>'; return; }
  const q=(window.CUST_Q27||'').toLowerCase();
  const ags=(typeof scopedBook==='function'?scopedBook():[]).filter(a=>!isPipeline(a));
  const by={};
  ags.forEach(a=>{ const no=custNoOf27(a), nm=custNameOf27(a)||'(no name)';
    const k=no?('n'+no):('x'+nm.toLowerCase());
    (by[k]=by[k]||{no,nm,items:[]}).items.push(a); if(!by[k].no&&no)by[k].no=no; if(by[k].nm==='(no name)'&&nm)by[k].nm=nm; });
  let groups=Object.values(by);
  if(q)groups=groups.filter(g=>g.nm.toLowerCase().includes(q)||String(g.no||'').includes(q)||g.items.some(a=>String(a.agreement_number||'').toLowerCase().includes(q)));
  groups.sort((x,y)=>x.nm.localeCompare(y.nm));
  const curRate=a=>{ try{ const tl=tlFor(a); if(tl&&tl.live&&tl.currentRate!=null)return +tl.currentRate; }catch(e){} return +agreementMrr(a)||0; };
  const liveAg=ags.filter(a=>!isEnded(a)); const bookRmr=liveAg.filter(a=>a.category!=='sla').reduce((s,a)=>s+curRate(a),0), slaRmr=liveAg.filter(a=>a.category==='sla').reduce((s,a)=>s+curRate(a),0);
  const totRmr=bookRmr+slaRmr;
  const shownAgs=groups.reduce((s,g)=>s.concat(g.items),[]); const shownLive=shownAgs.filter(a=>!isEnded(a));
  const shownRmr=shownLive.reduce((s,a)=>s+(+agreementMrr(a)||0),0);
  host.innerHTML=`
   <div class="kpis27">
    <div class="kpi27 hero"><span class="k">Customers</span><span class="v">${groups.length}</span><span class="s">with ${ags.length} agreements</span></div>
    <div class="kpi27"><span class="k">RMR book</span><span class="v">${money27(bookRmr)}</span><span class="s">per month · live RMR agreements, current Vista rates</span></div>
    <div class="kpi27"><span class="k">SLA book</span><span class="v">${money27(slaRmr)}</span><span class="s">per month equivalent · kept separate</span></div></div>
   <div class="pillrow27"><input id="custQ27" class="cfg-in" placeholder="Search customer, customer # or agreement #" value="${esc(window.CUST_Q27||'')}" style="width:280px;font-size:12px">
    <span style="flex:1"></span><button class="iconbtn" id="custFlat27">All agreements ▸</button></div>
   ${totalsBar27([[String(groups.length),'customers'],[String(shownLive.length),'live agreements'],[String(shownAgs.length-shownLive.length),'ended'],[fmt(shownRmr)+'/mo','monthly RMR']],q?`matching "${esc(window.CUST_Q27)}"`:'All customers')}
   <div id="custList27">${groups.map(g=>{
     const live=g.items.filter(a=>!isEnded(a)), ended=g.items.filter(a=>isEnded(a));
     const rmr=live.reduce((s,a)=>s+(+agreementMrr(a)||0),0);
     const fl=custFlags27(g.items); const key=g.no?('n'+g.no):('x'+g.nm.toLowerCase());
     const open=!!CUST_OPEN27[key]||!!q;
     const row=a=>{ let tl=null; try{ tl=tlFor(a); }catch(e){}
       const type=tl?tl.currentType:(a.agreement_type||'—'); const end=tl&&tl.current?tl.current.end:a.term_end;
       const notes=[]; if(a.consolidated_into)notes.push('consolidated into #'+a.consolidated_into); if(a.transfer_from)notes.push('from #'+a.transfer_from);
       let st='<span class="chip c-paid" style="font-size:9px">Active</span>', work='';
       if(isEnded(a))st='<span class="chip c-none" style="font-size:9px">Ended</span>';
       else{ try{ const w=openWork27(a); if(w.length){ st=stageChip27(w[0].state); work=plainText27(w[0].note||''); } }catch(e){} }
       return `<tr class="rowlink" data-cag="${a.id}"><td class="mono">#${esc(a.agreement_number||'—')}</td>
        <td>${esc(a.description||a.category||'')}${notes.length?`<div class="qctx">${esc(notes.join(' · '))}</div>`:''}</td>
        <td>${st}</td><td class="num mono">${fmt(+agreementMrr(a)||0)}</td>
        <td class="mono" style="color:var(--muted)">${end?esc(String(end).slice(0,10)):'—'}</td>
        <td style="font-size:11px">${esc(type)}</td><td style="font-size:11px;color:var(--muted)">${esc(work)}</td></tr>`; };
     return `<div class="cust27"><div class="hd" data-ck="${key}">
       <span class="nm">${esc(g.nm)}</span>${g.no?`<span class="mut">cust #${esc(g.no)}</span>`:''}
       <span class="mut">${live.length} live${ended.length?` · ${ended.length} ended`:''}</span>
       <span class="mut mono">${fmt(rmr)}/mo</span>
       <span style="flex:1"></span>
       ${fl.pastNet?'<span class="flag27 red">past net 60</span>':''}${fl.renewSoon?'<span class="flag27 amb">renewal ≤ 60d</span>':''}${fl.pending?'<span class="flag27 grn">commission open</span>':''}
       <span class="mut">${open?'▾':'▸'}</span></div>
      ${open?`<div class="bd"><table><thead><tr><th>Agr #</th><th>Description</th><th>Status</th><th class="num">$/mo</th><th>Term end</th><th>Renewal</th><th></th></tr></thead>
        <tbody>${live.map(row).join('')}${ended.length?`<tr><td colspan="7" style="color:var(--muted);font-size:11px;padding-top:8px">Ended</td></tr>${ended.map(row).join('')}`:''}</tbody></table></div>`:''}
     </div>`; }).join('')||'<div class="empty"><b>No customers match</b></div>'}</div>`;
  $('custQ27').oninput=function(){ window.CUST_Q27=this.value; renderCustomers27(); const i=$('custQ27'); i.focus(); i.setSelectionRange(i.value.length,i.value.length); };
  $('custFlat27').onclick=()=>switchView('agreements');
  host.querySelectorAll('[data-ck]').forEach(h=>h.onclick=()=>{ CUST_OPEN27[h.dataset.ck]=!CUST_OPEN27[h.dataset.ck]; renderCustomers27(); });
  host.querySelectorAll('[data-cag]').forEach(tr=>tr.onclick=e=>{ e.stopPropagation();
    if(can('editAgreements'))openModal(tr.dataset.cag); });
}

/* ---------------- agreement window: commission-chain layout ---------------- */
function initModal27(){
  const tabs=$('agTabs'); if(!tabs)return;
  const lab={deal:'Overview',renew:'History',comm:'Commissions',hist:'Commission ledger',bill:'Invoices',costs:'Costs & margin'};
  Object.keys(lab).forEach(k=>{ const b=tabs.querySelector(`[data-tab="${k}"]`); if(b){ b.textContent=lab[k]; tabs.appendChild(b); } });
  // Files gets its own tab; the button joins agTabs and reuses the existing pane-switch wiring
  if(!tabs.querySelector('[data-tab="files"]')){
    const b=document.createElement('button'); b.dataset.tab='files'; b.textContent='Files'; tabs.appendChild(b);
    const pane=document.createElement('div'); pane.className='grid agpane'; pane.dataset.pane='files'; pane.style.display='none';
    const billPane=document.querySelector('.agpane[data-pane="bill"]');
    const filesFld=$('agFiles')?$('agFiles').closest('.fld'):null;
    if(filesFld)pane.appendChild(filesFld);
    billPane.parentNode.insertBefore(pane,billPane.nextSibling);
    b.onclick=()=>{ document.querySelectorAll('#agTabs button').forEach(x=>x.classList.toggle('active',x===b));
      document.querySelectorAll('.agpane').forEach(p=>p.style.display=(p.dataset.pane==='files')?'':'none'); };
    tabs.addEventListener('click',e=>{ const x=e.target.closest('button'); if(x&&x!==b)b.classList.remove('active'); });
  }
  // the agreement type field is the renewal type of the CURRENT term (the same switch as on Renewals)
  const ft=$('f_type'); if(ft){ const lb=ft.closest('.fld')&&ft.closest('.fld').querySelector('label'); if(lb) lb.innerHTML='Renewal type — current term <span class="hint">12-month terms renew manually by default; switching here changes this term only and is audited</span>'; }
  // hide the fields nobody edits any more (they stay in the DOM)
  const hide=['Revision #','Vista source reference','Quote expiration','Term conversion','Continuity reason'];
  document.querySelectorAll('.agpane[data-pane="deal"] .fld label').forEach(l=>{
    const t=l.textContent.trim(); if(hide.some(h=>t.startsWith(h))) l.closest('.fld').style.display='none'; });
  // injection points
  const renewPane=document.querySelector('.agpane[data-pane="renew"]');
  if(renewPane&&!$('agHist27')){ const d=document.createElement('div'); d.className='fld full'; d.innerHTML='<div id="agHist27"></div>';
    renewPane.insertBefore(d,renewPane.firstChild);
    const det=document.createElement('details'); det.className='fld full'; det.innerHTML='<summary style="cursor:pointer;font-size:12px;color:var(--muted)">Legacy renewal entry (manual tools)</summary>';
    const kids=[...renewPane.children].filter(x=>x!==d&&x!==det); renewPane.appendChild(det); kids.forEach(k=>det.appendChild(k)); }
  const billPane=document.querySelector('.agpane[data-pane="bill"]');
  if(billPane&&!$('agInv27')){ const d=document.createElement('div'); d.className='fld full'; d.innerHTML='<div id="agInv27"></div>'; billPane.insertBefore(d,billPane.firstChild); }
  const commPane=document.querySelector('.agpane[data-pane="comm"]');
  if(commPane&&!$('agComm27')){ const d=document.createElement('div'); d.className='fld full'; d.innerHTML='<div id="agComm27"></div>'; commPane.insertBefore(d,commPane.firstChild); }
  // saving the agreement window with a different renewal type sets the current term's switch (same as Renewals)
  const sv=$('mSave'); if(sv&&sv.onclick&&!sv.dataset.rt27){ sv.dataset.rt27='1'; const orig=sv.onclick;
    sv.onclick=async function(ev){ const id=editingId; const before=id?(AGREEMENTS.find(x=>x.id===id)||{}).agreement_type:null;
      const r=await orig.call(this,ev);
      try{ const a=id&&AGREEMENTS.find(x=>x.id===id); if(a&&a.agreement_type&&a.agreement_type!==before) await syncRenewalSwitch27(a,before); }catch(e){ console.warn('renewal switch',e); }
      return r; }; }
  const om=window.openModal; window.openModal=function(id,promote){ om.apply(this,arguments); try{ decorateModal27(); }catch(e){ console.warn('modal27',e); } };
}
function decorateModal27(){
  const a=editingId?AGREEMENTS.find(x=>x.id===editingId):null;
  const hist=$('agHist27'), inv=$('agInv27'), comm=$('agComm27'); if(hist)hist.innerHTML=''; if(inv)inv.innerHTML=''; if(comm)comm.innerHTML='';
  if(!a)return;
  // header: stage + what it's waiting on
  const sum=$('agSummary27');
  if(sum&&sum.firstChild){ let work=[]; try{ work=openWork27(a); }catch(e){}
    const st=isPipeline(a)?(a.stage==='quoting'?'quoted':a.stage==='lost'?'lost':'opportunity'):(work.length?work[0].state:null);
    const chip=st?stageChip27(st):(isEnded(a)?'<span class="chip c-none">Ended · with customer</span>':'<span class="chip c-paid">Paid in full · with customer</span>');
    const wait=work.length?` <span class="qctx">${esc(plainText27(work[0].note||''))}</span>`:'';
    const bar=sum.firstChild; const d=document.createElement('span'); d.innerHTML=chip+wait; bar.appendChild(d); }
  // History
  if(hist){ let tl=null; try{ tl=tlFor(a); }catch(e){}
    if(!tl||!tl.ok){ hist.innerHTML='<div class="file-hint">No Vista contract terms imported for this agreement yet — the timeline appears after an SM Agreement List import.</div>'; }
    else{ const evs=eventsFor27?eventsFor27(a):tl.events;
      hist.innerHTML=`<div class="fieldset-h">Agreement history — from Vista</div>
      <div class="qctx" style="margin-bottom:6px">Original start <b>${esc(tl.originalStart)}</b> · ${tl.renewals} renewal${tl.renewals===1?'':'s'} · current term ${esc(tl.current.start)} → ${esc(tl.current.end||'—')} (${tl.current.months||'—'} mo, ${esc(tl.currentType)} renewal)</div>
      <div class="tl27">${evs.map(e=>{ const lab=(KIND_LABEL27&&KIND_LABEL27[e.kind])||e.kind;
        const rate=e.kind==='new_sale'?`${fmt2(+e.next||0)}/mo`:(e.prior!=null?`${fmt2(+e.prior)} → ${fmt2(+e.next)}/mo`:`${fmt2(+e.next||0)}/mo`);
        const inc=e.increase>0?` · increase ${fmt2(e.increase)}`:'';
        return `<div class="ev ${e.kind==='rate_change'?'rc':''}"><b>${esc(String(e.date||'').slice(0,10))}</b> · ${esc(lab)}${e.renewalType?` (${esc(e.renewalType)})`:''} · ${rate}${inc}${e.term?` · ${e.term} mo term`:''}</div>`; }).join('')}</div>`; } }
  // Commissions
  if(comm){ let L=[]; try{ L=hybridLines27(a)||[]; }catch(e){}
    if(L.length){ const RST={paid:['c-paid','Paid'],approved:['c-payable','Approved'],earned:['c-payable','Earned'],expected:['c-maturing','Waiting']};
      comm.innerHTML=`<div class="fieldset-h">Commission payments</div>
      <table class="cfg-table" style="font-size:12px"><thead><tr><th>Payment</th><th class="num">Amount</th><th>Status</th><th>Date</th><th>Note</th></tr></thead><tbody>
      ${L.map(l=>{ const m=RST[l.rstate]||RST.expected; const sold=l.p&&l.p.evRow?`<div class="qctx">marked sold by ${esc(l.p.evRow.created_by||'—')} ${esc(String(l.p.evRow.created_at||'').slice(0,10))}</div>`:'';
        return `<tr><td>${esc(l.label)}${sold}</td><td class="num mono">${fmt2(l.amount)}</td><td><span class="chip ${m[0]}" style="font-size:9px">${m[1]}</span></td>
         <td class="mono" style="color:var(--muted)">${esc(String(l.date||'—').slice(0,10))}</td><td style="font-size:11px">${esc(plainText27(l.note||''))}</td></tr>`; }).join('')}
      </tbody></table><div style="height:10px"></div>`; } }
  // Invoices
  if(inv){ let rows=[]; try{ rows=agreementInvoices(a); }catch(e){}
    let P=[]; try{ P=(pricedEvents27(a)||[]).filter(p=>!p.noPay&&!p.override); }catch(e){}
    const firstOf={}; P.forEach(p=>{ let cand=rows.filter(i=>i.status&&i.status!=='Scheduled'&&i.status!=='Voided'&&i.number&&(+i.total||0)>0&&(p.e.kind==='new_sale'||String(i.date)>=p.date));
      if(p.e.kind!=='new_sale'&&p.e.increase>0&&p.e.next>0){ const atNew=cand.find(i=>(+i.total||0)>=p.e.next-0.6); if(atNew)cand=cand.filter(i=>String(i.date)>=String(atNew.date)); }
      const f=cand[0];
      if(f)firstOf[f.number]=(KIND_LABEL27&&KIND_LABEL27[p.e.kind])||'Sale'; });
    const t=E27.businessToday();
    const real=rows.filter(r=>r.status!=='Scheduled');
    const line=r=>{ const net=r.date?E27.addDays(r.date,60):null; const paid=r.status==='Paid'||r.status==='Settled by credit';
      const late=!paid&&net&&t>net; const dep=firstOf[r.number];
      return `<tr${dep?' style="background:#f7f4fe"':''}><td class="mono">${esc(r.number||'—')}</td><td class="mono" style="color:var(--muted)">${esc(String(r.date||'').slice(0,10))}</td>
       <td class="num mono">${fmt2(+r.total||0)}</td><td>${esc(r.status)}${r.collected&&r.collected.state==='Confirmed'?' · <span style="color:var(--payable);font-weight:700">cash confirmed</span>':''}</td>
       <td class="mono" style="color:${late?'var(--held)':'var(--muted)'}">${net?esc(net):'—'}${late?' · past net 60':''}</td>
       <td style="font-size:10.5px">${dep?esc(dep)+' Payment 2 depends on this':''}</td></tr>`; };
    const main=real.slice(0,8), rest=real.slice(8);
    inv.innerHTML=`<div class="fieldset-h">Invoices — from Vista</div>
     ${real.length?`<table class="cfg-table" style="font-size:12px"><thead><tr><th>Invoice</th><th>Date</th><th class="num">Amount</th><th>Status</th><th>Net 60 by</th><th></th></tr></thead>
      <tbody>${main.map(line).join('')}</tbody></table>
      ${rest.length?`<details style="margin-top:4px"><summary style="cursor:pointer;font-size:11.5px;color:var(--muted)">${rest.length} more invoice${rest.length===1?'':'s'}</summary><table class="cfg-table" style="font-size:12px"><tbody>${rest.map(line).join('')}</tbody></table></details>`:''}`
      :'<div class="file-hint">No Vista invoices matched to this agreement yet. Link them from the Worklist, or import the SM Invoice List.</div>'}
     <div class="fieldset-h" style="margin-top:14px">Billing schedule</div>`; }
}

/* ---------------- sales reports ---------------- */
function qOf27(d){ if(!d)return null; return qIndexFromYM(+String(d).slice(0,4),+String(d).slice(5,7)-1); }
function renderSalesReports27(){
  const host=$('salesRep27'); if(!host)return;
  if(!canViewAll()||!signedIn||!P27.ready){ host.innerHTML=''; return; }
  const t=E27.businessToday(); const y=+t.slice(0,4);
  const qs=[]; for(let q=CUR_QI-7;q<=CUR_QI;q++)qs.push(q);
  const Z=()=>qs.map(q=>({q,wonN:0,wonR:0,lostN:0,lostR:0,newR:0,incR:0,churnN:0,churnR:0}));
  const B=Z(); const at=(qi,f,v)=>{ const b=B.find(x=>x.q===qi); if(b)b[f]+=v; };
  const ags=AGREEMENTS||[];
  // wins = recorded sale events; losses = lost deals; booked = timeline new sales + increases; churn = ended
  (P27.events||[]).forEach(ev=>{ if(!/new_sale|sla_new|win_back/.test(ev.event_type))return;
    const qi=qOf27(ev.event_date); at(qi,'wonN',1); at(qi,'wonR',(+((ev.snapshot||{}).eligibleMrr))||0); });
  ags.forEach(a=>{
    if(a.stage==='lost'){ const d=(a.stage_dates&&a.stage_dates.lost)||String(a.updated_at||'').slice(0,10); at(qOf27(d),'lostN',1); at(qOf27(d),'lostR',+a.est_monthly_rmr||0); }
    if(isEnded(a)&&a.ended_date&&!a.consolidated_into){ const qi=qOf27(a.ended_date); at(qi,'churnN',1); at(qi,'churnR',+a.monthly_rmr||0); }
    if(isPipeline(a))return;
    try{ const tl=tlFor(a); if(!tl||!tl.ok)return;
      tl.events.forEach(e=>{ const qi=qOf27(e.date); if(e.kind==='new_sale')at(qi,'newR',+e.next||0); else if(e.increase>0)at(qi,'incR',+e.increase); }); }catch(e){}
  });
  const pipe={}; let pipeR=0;
  dealRows27().forEach(r=>{ if(r.stage==='lost')return; (pipe[r.stage]=pipe[r.stage]||{n:0,r:0,age:0});
    pipe[r.stage].n++; pipe[r.stage].r+=(+r.rmr||0); const d=r.date?Math.max(0,Math.round((new Date(t)-new Date(r.date))/86400000)):0; pipe[r.stage].age+=d; pipeR+=(+r.rmr||0); });
  const ytdNew=B.filter(b=>String(qLabel(b.q)).includes(String(y))).reduce((s,b)=>s+b.newR+b.incR,0);
  host.innerHTML=`<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>Sales</h2><span class="qctx">wins, losses, booked RMR and churn by quarter</span></div>
   <div class="admin-body">
    <div class="qctx" style="margin-bottom:8px">Win rate, days-to-close and quote aging are reliable from the day stage tracking started (Oct 2026) — older deals have no quote or lost dates, so early quarters undercount losses.</div>
    <table class="cfg-table" style="font-size:12px"><thead><tr><th>Quarter</th><th class="num">Won</th><th class="num">Won RMR</th><th class="num">Lost</th><th class="num">Lost RMR</th><th class="num">Win rate</th><th class="num">New RMR booked</th><th class="num">Increase RMR</th><th class="num">Cancelled</th><th class="num">Churned RMR</th></tr></thead>
    <tbody>${B.map(b=>`<tr${b.q===CUR_QI?' style="font-weight:700"':''}><td>${esc(qLabel(b.q))}</td><td class="num">${b.wonN||'—'}</td><td class="num mono">${b.wonR?fmt(b.wonR):'—'}</td>
      <td class="num">${b.lostN||'—'}</td><td class="num mono">${b.lostR?fmt(b.lostR):'—'}</td>
      <td class="num">${(b.wonN+b.lostN)?Math.round(100*b.wonN/(b.wonN+b.lostN))+'%':'—'}</td>
      <td class="num mono">${b.newR?fmt(b.newR):'—'}</td><td class="num mono">${b.incR?fmt(b.incR):'—'}</td>
      <td class="num">${b.churnN||'—'}</td><td class="num mono">${b.churnR?fmt(b.churnR):'—'}</td></tr>`).join('')}</tbody></table>
    <div class="qctx" style="margin:8px 0 14px">New + increase RMR booked ${y} to date: <b>${fmt(ytdNew)}</b>/mo. Booked RMR comes from the Vista contract timeline, so past quarters are complete; wins count recorded commission events.</div>
    <div class="fieldset-h">Pipeline right now</div>
    <table class="cfg-table" style="font-size:12px;max-width:560px"><thead><tr><th>Stage</th><th class="num">Deals</th><th class="num">Est. / actual RMR</th><th class="num">Avg days in list</th></tr></thead>
    <tbody>${['opportunity','quoted','signed','sold'].map(s=>{ const p=pipe[s]||{n:0,r:0,age:0};
      return `<tr><td>${stageChip27(s)}</td><td class="num">${p.n}</td><td class="num mono">${fmt(p.r)}</td><td class="num">${p.n?Math.round(p.age/p.n):'—'}</td></tr>`; }).join('')}
     <tr style="font-weight:700"><td>Total open</td><td class="num">${Object.values(pipe).reduce((s,p)=>s+p.n,0)}</td><td class="num mono">${fmt(pipeR)}</td><td></td></tr></tbody></table>
   </div></div>`;
}

/* ---------------- commission history period filter ---------------- */
(function histFilter27(){
  if(typeof historyLedger!=='function')return;
  const hl=window.historyLedger;
  window.historyLedger=function(){ let rows=hl.apply(this,arguments);
    try{ if(view==='history'&&pfRange27())rows=rows.filter(r=>pfIn27(r.date)); }catch(e){}
    return rows; };
  const rh=window.renderHistory;
  window.renderHistory=function(){ rh.apply(this,arguments);
    try{ const host=$('histCount'); if(host&&!host.dataset.pf27){ host.dataset.pf27='1';
      const d=document.createElement('div'); d.className='pillrow27'; d.style.marginTop='6px'; host.parentNode.insertBefore(d,host); }
      const bar=host&&host.previousSibling&&host.previousSibling.className==='pillrow27'?host.previousSibling:null;
      if(bar)bar.innerHTML=pfBar27(renderHistory);
    }catch(e){} };
})();

/* ---------------- portfolio bonus: the RMR book only ---------------- */
// Retention (GRR) and growth (NRR) measure the rep's RMR book. SLAs are their own book — they earn
// their own new-sale and renewal commission, and never count toward the RMR retention bonus.
(function rmrBookOnly27(){
  if(typeof portfolioMetrics!=='function')return;
  const pm=portfolioMetrics;
  portfolioMetrics=function(y,book){ return pm.call(this,y,(book||[]).filter(a=>a.category!=='sla')); };
})();

/* the agreement window's renewal type = the current term's renewal switch */
async function syncRenewalSwitch27(a,before){
  const revs=TERMS_BY_NO[String(a.agreement_number)]; if(!revs||typeof R27==='undefined')return;
  const tl=R27.timeline(revs,{today:E27.businessToday(),annualised:a.category==='sla',knownRate:+a.monthly_rmr||null}); if(!tl||!tl.ok||!tl.live)return;
  const v=a.agreement_type, rule=tl.ruleType;
  const patch={renewal_type_override:v===rule?null:v,renewal_override_term_start:v===rule?null:tl.current.start,updated_at:new Date().toISOString()};
  const {error}=await sb.from('rmr_agreements').update(patch).eq('id',a.id); if(error){ toast(error.message); return; }
  Object.assign(a,patch); TL_CACHE=new Map(); PRICE_STAMP++;
  audit('Renewal type switched','Agreement',a.agreement_number,{agreement_type:before||null},Object.assign({agreement_type:v},patch),`From the agreement window · current term from ${tl.current.start}`);
  render();
}
