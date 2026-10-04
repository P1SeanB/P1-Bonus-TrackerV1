/* ===================================================================================================
   Layout B shell (P1RMR-58): side menu, page header, Today, Payouts in five steps with the printed
   approval packet, Vista imports page, rep My pay / My plan, Mark won with the signed contract.
   Point 1 brand from the Outlook signature. The commission engine is untouched.
   =================================================================================================== */
const LOGO27={rev:'__P1_LOGO_REV__',full:'__P1_LOGO__'};
const RAMP27={expected:'#ea9a62',earned:'#cf5c14',paid:'#8a3a0a'};   // validated ordinal ramp: light → dark
const ICON27={
  today:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  opportunities:'<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  agreements:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  renewals:'<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
  quarter:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.9-2.5 2s1 1.7 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5"/>',
  worklist:'<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  imports:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
  history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  forecast:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  recon:'<path d="M12 4v16M6 20h12M5 8h14"/><path d="M5 8l-2.5 6h5zM19 8l-2.5 6h5z"/>',
  reports:'<path d="M5 20V11M11 20V5M17 20v-7M3 20h18"/>',
  admin:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  myplan:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 12l2 2 4-4"/>',
  guides:'<path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z"/>'
};
const svg27=p=>`<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const TAB27={today:'tabToday',opportunities:'tabOpportunities',agreements:'tabAgreements',renewals:'tabRenewals',quarter:'tabQuarter',worklist:'tabWorklist',imports:'tabImports',
  history:'tabHistory',forecast:'tabForecast',recon:'tabRecon',reports:'tabReports',admin:'tabAdmin',myplan:'tabMyPlan',guides:'tabGuides'};
const NAV27={
  team:[['today','Today'],['opportunities','Pipeline'],['agreements','Agreements'],['renewals','Renewals'],['quarter','Payouts'],['worklist','Worklist'],['imports','Vista imports'],
    '§Reports',['history','Commission history'],['forecast','Renewal forecast'],['recon','Reconciliation'],['reports','Reports'],'§Settings',['guides','Guides'],['admin','Admin']],
  rep:[['quarter','My pay'],['opportunities','Pipeline'],['agreements','My deals'],['renewals','Renewals'],['history','Payment history'],['myplan','My plan'],'§Help',['guides','Guides']]
};
const PAGE27={
  today:['Today','What needs you next, soonest first.'],
  opportunities:['Pipeline','Open quotes, and won deals waiting to be set up.','Pipeline','Your quotes. When a customer signs, mark it won and attach the signed contract.'],
  agreements:['Agreements','Every agreement, its commission and where each payment stands.','My deals','Your agreements, view only.'],
  renewals:['Renewals','Renewals due now or soon.'],
  quarter:['Payouts','Close the quarter in five steps: import, verify, review, approve, pay.','My pay','Your next commission payment and every payment behind it.'],
  worklist:['Worklist','Everything waiting on a person: exceptions, set-ups and questions from reps.'],
  imports:['Vista imports','The five Vista files: what each is for, when it is due and how to run it.'],
  history:['Commission history','Every commission event, paid and pending.','Payment history','Every commission payment on your deals.'],
  forecast:['Renewal forecast','What upcoming renewals are worth. Planning only; it does not create commissions.'],
  recon:['Reconciliation','Year by year: paid under the old plan, earned under the revised plan.'],
  reports:['Reports','Profitability by customer, and every upcoming release.'],
  admin:['Admin','Plans, employees, payout calendar and the audit log.'],
  myplan:['My plan','The commission terms you accepted, and how you are paid.'],
  guides:['Guides','How to use the tool, and how commissions work.']
};
const isTeam27=()=>canViewAll();
const lc27=s=>String(s||'').toLowerCase();
const money27=n=>fmt2(Number(n)||0);
const fmtD27=iso=>{ if(!iso)return '—'; const d=/T\d\d:/.test(String(iso))?new Date(iso):new Date(String(iso).slice(0,10)+'T00:00:00'); return isNaN(d)?String(iso):d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };
const daysTo27=iso=>{ if(!iso)return null; const t=new Date(E27.businessToday()+'T00:00:00'), d=new Date(String(iso).slice(0,10)+'T00:00:00'); return Math.round((d-t)/86400000); };
function nameOf27(email){ const u=(P27.users||[]).find(x=>lc27(x.email)===lc27(email)); return (u&&(u.full_name||u.name))||repName(email); }

/* ---------------- frame ---------------- */
(function buildShell27(){
  const app=$('app'); if(!app||$('side27'))return;
  document.body.classList.add('shell27');
  const side=document.createElement('aside'); side.id='side27'; side.setAttribute('aria-label','Main menu');
  side.innerHTML=`<div class="brand27"><img src="${LOGO27.rev}" alt="Point 1 — Connecting what's next"><span>Bonus Tracker</span></div>`;
  const nav=app.querySelector('nav.tabs'); side.appendChild(nav);
  const foot=document.createElement('div'); foot.className='foot27'; foot.id='foot27'; side.appendChild(foot);
  app.insertBefore(side,app.firstChild);
  const main=app.querySelector('main');
  [['today','tabToday'],['imports','tabImports'],['myplan','tabMyPlan'],['guides','tabGuides']].forEach(([v,id])=>{
    const b=document.createElement('button'); b.id=id; b.dataset.view=v; b.onclick=()=>switchView(v); nav.appendChild(b);
    const sec=document.createElement('section'); sec.id='view-'+v; sec.style.display='none'; sec.innerHTML=`<div id="${v}Host27" class="pg27"></div>`; main.appendChild(sec); });
  const hdr=app.querySelector('header'); const ph=document.createElement('div'); ph.id='pageHead27';
  ph.innerHTML='<h1 id="pgTitle27">Bonus Tracker</h1><div class="sub" id="pgSub27"></div>'; hdr.insertBefore(ph,hdr.querySelector('.session'));
  const tip=document.createElement('div'); tip.id='tip27'; document.body.appendChild(tip);
  const gb=$('guideBtn'); if(gb){ gb.textContent='Guides'; gb.onclick=()=>switchView('guides'); }
  decorateNav27();
})();
function decorateNav27(){
  const nav=document.querySelector('#side27 nav.tabs'); if(!nav)return;
  const team=isTeam27(); const order=team?NAV27.team:NAV27.rep; const shown=new Set();
  nav.querySelectorAll('.sec27').forEach(x=>x.remove());
  order.forEach(it=>{
    if(typeof it==='string'){ const s=document.createElement('div'); s.className='sec27'; s.textContent=it.slice(1); nav.appendChild(s); return; }
    const [v,label]=it; const b=$(TAB27[v]); if(!b)return; shown.add(b.id); b.style.display='';
    const badge=b.querySelector('#wlBadge');
    b.textContent=''; b.insertAdjacentHTML('afterbegin',svg27(ICON27[v]||'')); const sp=document.createElement('span'); sp.className='lbl27'; sp.textContent=label; b.appendChild(sp); if(badge)b.appendChild(badge);
    b.title=PAGE27[v]?PAGE27[v][team?1:(PAGE27[v][3]?3:1)]:''; nav.appendChild(b);
  });
  // a section label with nothing visible under it is dropped
  nav.querySelectorAll('button').forEach(b=>{ if(!shown.has(b.id)) b.style.display='none'; });
  if(team){ const adm=$('tabAdmin'); if(adm) adm.style.display=(can('editConfig')||can('viewAudit'))?'':'none';
    const imp=$('tabImports'); if(imp) imp.style.display=''; }
  const secs=[...nav.querySelectorAll('.sec27')]; secs.forEach(s=>{ let n=s.nextElementSibling, any=false; while(n&&!n.classList.contains('sec27')){ if(n.tagName==='BUTTON'&&n.style.display!=='none')any=true; n=n.nextElementSibling; } if(!any)s.style.display='none'; });
  const f=$('foot27'); if(f) f.innerHTML=CURRENT_EMAIL?`<b>${esc(nameOf27(CURRENT_EMAIL))}</b><br>${esc(CURRENT_ROLE||'')}${!team&&compFamilyOf(CURRENT_EMAIL)?' · '+esc(compFamilyOf(CURRENT_EMAIL)):''}<br><span style="opacity:.75">${esc(APP_VERSION)}</span>`:'';
  setPageHead27();
}
function setPageHead27(){
  const p=PAGE27[view]; if(!p)return; const rep=!isTeam27();
  $('pgTitle27').textContent=rep&&p[2]?p[2]:p[0]; $('pgSub27').textContent=rep&&p[3]?p[3]:p[1];
  document.title=`${$('pgTitle27').textContent} · P1 Bonus Tracker`;
}
let HOMED27='';
(function hookShell27(){
  const ap=window.applyPermissions;
  window.applyPermissions=function(){ ap.apply(this,arguments); decorateNav27();
    if(!signedIn)return;
    const who=lc27(CURRENT_EMAIL); if(HOMED27!==who&&isTeam27()&&view==='quarter'){ HOMED27=who; switchView('today'); return; }
    HOMED27=who;
    if(!isTeam27()&&['today','imports','forecast','recon','reports','worklist','admin'].includes(view)) switchView('quarter'); };
  window.switchView=function(v){
    view=v; Object.keys(TAB27).forEach(x=>{ const s=$('view-'+x); if(s) s.style.display=x===v?'block':'none'; });
    document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
    setPageHead27(); window.scrollTo(0,0); render(); };
  const ea=window.enterApp; if(typeof ea==='function') window.enterApp=function(){ HOMED27=''; return ea.apply(this,arguments); };
  const rd=window.render;
  window.render=function(){ rd.apply(this,arguments);
    try{ if(view==='guides')renderGuides27();
      if(view==='quarter'&&!can('editConfig')) setTimeout(()=>document.querySelectorAll('#qTableWrap .paidbtn.is-paid').forEach(b=>{ b.disabled=true; b.title='Only an Administrator can undo a paid mark.'; b.style.cursor='not-allowed'; }),0);
      if(view==='today')renderToday27(); if(view==='imports')renderImports27(); if(view==='myplan')renderMyPlan27(); if(view==='quarter'&&!isTeam27())renderMyPay27(); }
    catch(e){ console.warn('render27',e); } };
})();

/* ---------------- Today ---------------- */
function payoutState27(){
  const run=E27.payoutCalendar(P27.settings.payout_calendar); const items=payoutItems(run);
  const groups={'Ready to pay':[],'Pending verification':[],'Excluded from this run':[]}; items.forEach(i=>groups[i.state].push(i));
  const tot=g=>groups[g].reduce((s,i)=>s+i.amount,0);
  const done=P27.payoutRuns.find(r=>r.year===run.y&&r.quarter===run.q)||null;
  const fi=feedHealth('invoices'), fr=feedHealth('receipts');
  const pkt=packetFor27(run,groups);
  const printed=LS.get('pkt27:'+run.y+'Q'+run.q)||'';
  const s1=fi.due.state==='ok'&&fr.due.state==='ok';
  const pastCut=E27.businessToday()>run.cutoff;
  const s2=groups['Pending verification'].length===0||pastCut;
  const s3=!!done||printed===pkt.no;
  const s4=!!done, s5=!!(done&&done.locked_at);
  const steps=s5?[true,true,true,true,true]:[s1,s2,s3,s4,s5]; const now=steps.findIndex(x=>!x);
  return {run,items,groups,tot,done,fi,fr,pkt,printed,steps,now,pastCut};
}
function renderToday27(){
  const host=$('todayHost27'); if(!host)return;
  if(!P27.ready){ host.innerHTML=`<div class="card27"><div class="bd">Loading…</div></div>`; return; }
  const S=payoutState27(), run=S.run, today=E27.businessToday();
  const openWl=P27.worklist.filter(w=>w.status==='open');
  const qs=openWl.filter(w=>w.type==='rep_question');
  const ren=[]; scopedAgreements().forEach(a=>{ try{ const c=compute(a); if(c.isAuto||c.noRenewal||!(c.renewMult>0))return; const nd=nextDueDate(a); if(!nd)return; const iso=E27.isoDate(nd); const d=daysTo27(iso); if(d!=null&&d<=60) ren.push({a,iso,d}); }catch(_){} });
  const rows=[];
  const add=(date,what,detail,go,label,extra)=>rows.push(Object.assign({date,what,detail,go,label},extra||{}));
  if(!S.steps[0]) add(run.cutoff,'Import the Vista invoice and receipt files',`Invoices: ${S.fi.due.label} · Receipts: ${S.fr.due.label}. Data must reach ${fmtD27(run.quarterEnd)}.`,'imports','Open imports');
  if(!S.steps[1]) add(run.cutoff,`Verify customer payments for the Q${run.q} ${run.y} payout`,`${S.groups['Pending verification'].length} payment(s), ${money27(S.tot('Pending verification'))}, waiting on verification. Anything not verified by ${fmtD27(run.cutoff)} moves to the next payout.`,'quarter','Open payouts');
  if(!S.done){ if(S.pkt.items.length) add(run.payBy,`Get the Q${run.q} ${run.y} approval packet signed`,`${money27(S.tot('Ready to pay'))} ready for ${new Set(S.groups['Ready to pay'].map(i=>lc27(i.a.owner_email))).size} rep(s). Print the packet, have an Executive sign it, then record the approval.`,'quarter','Open payouts');
  } else if(!S.done.locked_at) add(run.payBy,`Mark the Q${run.q} ${run.y} payout paid`,`Approved ${fmtD27(S.done.approved_at)}. Send the payroll file, then enter the payroll date to lock the quarter.`,'quarter','Open payouts');
  openWl.filter(w=>w.type!=='rep_question').forEach(w=>{ const T=(typeof WL_TYPES!=='undefined'&&WL_TYPES[w.type])||[w.type]; if(w.type==='deal_won'&&can('editAgreements')) add(w.due_date||null,T[0],w.title,'setup:'+w.record_ref,'Set up deal',{wl:w}); else add(w.due_date||null,T[0],w.title,'worklist','Open worklist',{wl:w}); });
  qs.forEach(w=>add(w.due_date||null,`Answer ${nameOf27((w.detail||{}).requested_by)}'s question`,(w.detail&&w.detail.question)||w.title,'worklist','Answer'));
  ren.forEach(r=>add(r.iso,`Renewal due · #${r.a.agreement_number||''} ${r.a.customer_name||''}`,'Manual renewal — confirm it on the Renewals page to record the renewal commission.','renewals','Open renewals'));
  rows.sort((x,y)=>String(x.date||'9999').localeCompare(String(y.date||'9999')));
  const chip=d=>{ const n=daysTo27(d); if(n==null)return '<span class="pill27 paid">No date</span>'; if(n<0)return `<span class="pill27 bad">Overdue ${-n}d</span>`; if(n<=7)return `<span class="pill27 soon">Due in ${n}d</span>`; return `<span class="pill27 app">${fmtD27(d)}</span>`; };
  const stepNames=['Import Vista files','Verify payments','Print approval packet','Record Executive approval','Pay & lock'];
  host.innerHTML=`
   <div class="kpis27">
     <div class="kpi27 hero"><span class="k">Next payout · Q${run.q} ${run.y}</span><span class="v">${money27(S.tot('Ready to pay'))}</span><span class="s">ready now · pay by ${fmtD27(run.payBy)}</span></div>
     <div class="kpi27"><span class="k">Waiting on payment</span><span class="v">${money27(S.tot('Pending verification')+myLines27().filter(l=>l.state==='expected'&&l.piece===1).reduce((s,l)=>s+l.amount,0))}</span><span class="s">first invoices not paid or verified yet</span></div>
     <div class="kpi27"><span class="k">Open worklist</span><span class="v">${openWl.length}</span><span class="s">${qs.length} question${qs.length===1?'':'s'} from reps</span></div>
     <div class="kpi27"><span class="k">Renewals · next 60 days</span><span class="v">${ren.length}</span><span class="s">manual renewals to confirm</span></div>
   </div>
   <div class="row27">
     <div class="card27" style="flex:999 1 560px"><div class="hd"><h2>Due soonest</h2><span class="qctx">${rows.length} item${rows.length===1?'':'s'}</span></div>
       ${rows.length?`<div style="overflow-x:auto"><table class="tbl27"><thead><tr><th style="width:120px">When</th><th>What</th><th></th></tr></thead><tbody>${rows.slice(0,30).map((r,i)=>`<tr><td>${chip(r.date)}</td><td><b style="font-size:14px">${esc(r.what)}</b><div class="qctx" style="margin-top:2px;line-height:1.45">${esc(plainText27(String(r.detail||'')))}</div></td><td style="text-align:right;white-space:nowrap"><button class="btn-ghost" data-go27="${r.go}" style="padding:7px 12px;font-size:13px">${esc(r.label)}</button></td></tr>`).join('')}</tbody></table></div>`
         :`<div class="empty"><b>You're all caught up</b>Nothing is due. New items appear here as deals, imports and payouts move.</div>`}
     </div>
     <div class="card27" style="flex:1 1 300px"><div class="hd"><h2>Q${run.q} ${run.y} payout</h2><button class="lnk27" data-go27="quarter">Open</button></div>
       <div class="bd" style="display:flex;flex-direction:column;gap:10px">${stepNames.map((n,i)=>`<div style="display:flex;align-items:center;gap:10px;font-size:14px"><span class="step27 ${S.steps[i]?'done':(i===S.now?'now':'')}" style="padding:0;border:0;background:none"><span class="n">${S.steps[i]?'✓':i+1}</span></span><span style="font-weight:${i===S.now?800:600};color:${S.steps[i]?'var(--muted)':'var(--ink)'}">${n}</span></div>`).join('')}
       <div class="note27" style="margin-top:4px">Quarter ended ${fmtD27(run.quarterEnd)} · verify by ${fmtD27(run.cutoff)} · pay by ${fmtD27(run.payBy)}</div></div></div>
   </div>`;
  host.querySelectorAll('[data-go27]').forEach(b=>b.onclick=()=>{ const g=b.dataset.go27; if(g.startsWith('setup:')){ switchView('opportunities'); openCloseDeal27(g.slice(6)); return; } switchView(g); });
}

/* ---------------- Payouts: five steps + approval packet ---------------- */
function fnv27(s){ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; } return h.toString(16).toUpperCase().padStart(8,'0').slice(0,6); }
const MANUAL_SOURCES27=['sm_invoices_tab','export_grid','override'];
function packetFor27(run,groups){
  const ready=groups['Ready to pay'].slice().sort((x,y)=>String(x.a.agreement_number).localeCompare(String(y.a.agreement_number),undefined,{numeric:true})||String(x.label).localeCompare(String(y.label)));
  const key=`${run.y}Q${run.q}|`+ready.map(i=>`${i.a.id}|${i.label}|${Math.round(i.amount*100)}`).join(';');
  const no=`${run.y}-Q${run.q}-${fnv27(key)}`;
  const me=lc27(CURRENT_EMAIL);
  const items=ready.map(i=>{ const owner=lc27(i.owner||i.a.owner_email);
    const handVerified=owner===me&&(P27.verifs||[]).some(v=>String(v.agreement_id)===String(i.a.id)&&MANUAL_SOURCES27.includes(v.source)&&lc27(v.verified_by)===me);
    const piece=i.adjustment?'Adjustment':i.revised?`Payment ${i.tranche} of 2`:String(i.label).replace(/\b\w/,c=>c.toUpperCase());
    const ed=(/Earned (\d{4}-\d{2}-\d{2})/.exec(i.reason||'')||[])[1];
    const why=i.adjustment?`${i.adjustment.reason||'Adjustment'} · approved by ${nameOf27(i.adjustment.approver)}`:i.revised&&ed?(i.tranche===1?`First invoice paid ${fmtD27(ed)}`:`Three months after first billing, invoices paid · ${fmtD27(ed)}`)+(handVerified?' · verified by hand':' · Vista receipt'):plainText27(i.reason||'');
    return {agreement_id:i.a.id,agreement:String(i.a.agreement_number||''),customer:i.a.customer_name||'',owner:owner,rep:nameOf27(owner),piece,label:i.label,amount:i.amount,cents:Math.round(i.amount*100),why,flag:handVerified}; });
  return {no,items,total:items.reduce((s,i)=>s+i.cents,0)/100};
}
(function hookPayoutRun27(){
  const orig=window.renderPayoutRun; if(typeof orig!=='function')return;
  window.renderPayoutRun=function(){ orig.apply(this,arguments);
    const el=$('payoutRun27'); if(!el)return;
    if(!isTeam27()){ el.style.display='none'; const lab=$('qByQuarter27'); const mp=$('myPay27'); const host=$('view-quarter'); if(mp){ host.insertBefore(mp,host.firstChild); if(lab) mp.after(lab); } if(lab) lab.textContent='Browse by quarter'; return; }
    el.style.display='';
    const ap=$('pr27approve'); if(ap&&ap.parentElement) ap.parentElement.remove();
    if(!can('approvePayout'))return;
    renderSteps27(); };
})();
function renderSteps27(){
  const host=$('view-quarter'); let el=$('steps27');
  if(!el){ el=document.createElement('div'); el.id='steps27'; el.className='card27'; el.style.marginBottom='16px'; host.insertBefore(el,host.firstChild); }
  const S=payoutState27(), run=S.run, d=S.done;
  const stale=S.printed&&!d&&S.printed!==S.pkt.no;
  const st=(i,title,desc,action)=>`<div class="step27 ${S.steps[i]?'done':(i===S.now?'now':'')}"><span class="n">${S.steps[i]?'✓':i+1}</span><span class="t">${title}</span><span class="d">${desc}</span><span class="a">${action||''}</span></div>`;
  el.innerHTML=`<div class="hd"><h2>Q${run.q} ${run.y} payout · ${d&&d.locked_at?'paid and locked':(d?'approved':'in progress')}</h2><span class="qctx">quarter ended ${fmtD27(run.quarterEnd)} · verify by ${fmtD27(run.cutoff)} · pay by ${fmtD27(run.payBy)} · <button class="lnk27" id="st27adj">Add an adjustment</button>${d&&can('editConfig')?` · <button class="lnk27" id="st27rev">Revert a step…</button>`:''}</span></div>
   <div class="steps27">
    ${st(0,'Import Vista files',`Invoices: ${esc(S.fi.due.label)}<br>Receipts: ${esc(S.fr.due.label)}`,`<button class="lnk27" data-go27="imports">Open imports</button>`)}
    ${st(1,'Verify payments',S.groups['Pending verification'].length?`${S.groups['Pending verification'].length} waiting · ${money27(S.tot('Pending verification'))}${S.pastCut?'<br>Past the cutoff: these move to the next payout.':''}`:'Every payment in this run is verified.',`<button class="lnk27" id="st27wait">See what's waiting</button>`)}
    ${st(2,'Print approval packet',d?`Packet ${esc((d.packet&&d.packet.no)||d.packet_no||'—')} signed.`:!S.pkt.items.length?'Nothing is ready to approve yet. Payments appear here once they are earned and verified.':`${money27(S.pkt.total)} · ${S.pkt.items.length} payment(s)<br>Packet ${esc(S.pkt.no)}${stale?'<br><b style="color:#8a1f1f">The printed packet is out of date — print again.</b>':''}`,d?`<button class="lnk27" id="st27pdf">Reprint signed packet</button>`:`<button class="btn-primary" id="st27print" ${S.pkt.items.length?'':'disabled'} style="padding:8px 12px;font-size:13px">Print packet</button>`)}
    ${st(3,'Record Executive approval',d?`Approved by ${esc(d.approved_by)}${d.signed_on?' on '+fmtD27(d.signed_on):''}.${d.signed_scan_path?' Signed scan on file.':''}`:'An Executive signs the printed packet. Upload the signed scan to unlock the payroll file.',d?(d.signed_scan_path?`<button class="lnk27" id="st27scan">View signed scan</button>`:''):`<button class="btn-primary" id="st27rec" ${S.steps[2]&&S.pkt.items.length?'':'disabled'} style="padding:8px 12px;font-size:13px">Record approval</button>`)}
    ${st(4,'Pay & lock',d&&d.locked_at?`Paid on payroll ${fmtD27(d.paid_date)} · locked.`:(d?'Send the payroll file, then enter the payroll date. Statements become final.':'Unlocks after the approval is recorded.'),d?`<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start"><button class="lnk27" id="st27csv">Download payroll file</button>${d.locked_at?'':`<button class="btn-primary" id="st27paid" style="padding:8px 12px;font-size:13px">Mark paid &amp; lock</button>`}</div>`:'')}
   </div>${(()=>{ const rv=(P27.reversals||[]).filter(x=>x.year===run.y&&x.quarter===run.q).sort((a,b)=>String(b.reverted_at).localeCompare(String(a.reverted_at)));
     return rv.length?`<div style="padding:10px 20px 14px;border-top:1px solid #edf0f5;font-size:12.5px;color:var(--muted);line-height:1.6">${rv.slice(0,3).map(x=>`<div><b style="color:#8a1f1f">Reverted</b> · ${x.step==='unlock_paid'?'paid &amp; lock undone (back to Approved)':'approval undone (back to Print packet)'} · ${esc(fmtD27(x.reverted_at))} by ${esc(nameOf27(x.reverted_by))} — ${esc(x.reason)}</div>`).join('')}</div>`:''; })()}`;
  el.querySelectorAll('[data-go27]').forEach(b=>b.onclick=()=>switchView(b.dataset.go27));
  if($('st27rev')) $('st27rev').onclick=()=>openRevert27(d);
  const w=$('st27wait'); if(w) w.onclick=()=>{ const det=[...document.querySelectorAll('#payoutRun27 details')][1]; if(det){ det.open=true; det.scrollIntoView({behavior:'smooth',block:'start'}); } };
  if($('st27print')) $('st27print').onclick=()=>{ printPacket27(S); LS.set('pkt27:'+run.y+'Q'+run.q,S.pkt.no); audit('Approval packet printed','Payout',S.pkt.no,null,{total:S.pkt.total,items:S.pkt.items.length},null); renderSteps27(); };
  if($('st27pdf')) $('st27pdf').onclick=()=>printPacket27(S,d);
  if($('st27rec')) $('st27rec').onclick=()=>openRecordApproval27(S);
  if($('st27adj')) $('st27adj').onclick=()=>openAdjust27();
  if($('st27scan')) $('st27scan').onclick=async()=>{ const {data,error}=await sb.storage.from(FILE_BUCKET).createSignedUrl(d.signed_scan_path,120); if(error){toast(error.message);return;} window.open(data.signedUrl,'_blank','noopener'); };
  if($('st27csv')) $('st27csv').onclick=()=>downloadPayroll27(d);
  if($('st27paid')) $('st27paid').onclick=()=>openMarkPaid27(d);
}
function printPacket27(S,done){
  if(!window.jspdf||!window.jspdf.jsPDF){ toast('PDF library still loading — try again in a moment'); return; }
  const run=S.run; const pk=done&&done.packet&&done.packet.items?done.packet:S.pkt; const pkNo=pk.no||S.pkt.no;
  const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'pt',format:'letter'}); const W=612, M=54;
  const navy=[34,67,138], ink=[36,36,36], slate=[91,100,120], orange=[242,113,35];
  const header=(title,sub)=>{ try{ doc.addImage(LOGO27.full,'PNG',M,40,154,40); }catch(_){}
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...slate);
    doc.text([`Prepared by ${nameOf27(CURRENT_EMAIL)}`,`${fmtD27(E27.businessToday())}`,`Packet ${pkNo}`],W-M,48,{align:'right'});
    doc.setDrawColor(...orange); doc.setLineWidth(2); doc.line(M,92,W-M,92);
    doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(...ink); doc.text(title,M,122);
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(...slate); doc.text(sub,M,140); };
  const sub=`Q${run.q} ${run.y} · quarter ended ${fmtD27(run.quarterEnd)} · pay by ${fmtD27(run.payBy)}`;
  header('Commission payout approval',sub);
  const moved=S.groups['Pending verification']; const movedTot=moved.reduce((s,i)=>s+i.amount,0);
  const qOpen=P27.worklist.filter(w=>w.type==='rep_question'&&w.status==='open').length, qDone=P27.worklist.filter(w=>w.type==='rep_question'&&w.status==='closed').length;
  const reps=new Set(pk.items.map(i=>i.owner)).size;
  const box=(x,label,val,note)=>{ doc.setDrawColor(201,207,218); doc.setLineWidth(.8); doc.roundedRect(x,156,160,62,6,6);
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...slate); doc.text(label,x+12,174);
    doc.setFont('courier','bold'); doc.setFontSize(16); doc.setTextColor(...ink); doc.text(val,x+12,195);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...slate); doc.text(note,x+12,209); };
  box(M,'TO APPROVE',money27(pk.total),`${pk.items.length} payment(s) · ${reps} rep(s)`);
  box(M+170,'MOVED TO NEXT PAYOUT',money27(movedTot),`not verified by ${fmtD27(run.cutoff)}`);
  box(M+340,'OPEN QUESTIONS',String(qOpen),`${qDone} answered`);
  doc.autoTable({startY:236,margin:{left:M,right:M},head:[['Rep','Agreement','Payment','Earned because','Amount']],
    body:pk.items.map(i=>[i.rep,`#${i.agreement} ${i.customer}`,i.piece,(i.flag?'[!] ':'')+i.why,money27(i.amount)]).concat([[{content:'Total',colSpan:4,styles:{fontStyle:'bold'}},{content:money27(pk.total),styles:{fontStyle:'bold',halign:'right'}}]]),
    styles:{font:'helvetica',fontSize:9,textColor:ink,cellPadding:5,lineColor:[223,228,236],lineWidth:.5},headStyles:{fillColor:navy,textColor:255,fontStyle:'bold'},columnStyles:{0:{cellWidth:86},2:{cellWidth:62},4:{halign:'right',font:'courier',cellWidth:70}},alternateRowStyles:{fillColor:[248,249,252]}});
  let y=doc.lastAutoTable.finalY+18;
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...ink); doc.text('Not in this payout',M,y); y+=14;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...slate);
  const nl=moved.length?moved.map(i=>`${nameOf27(i.a.owner_email)} · #${i.a.agreement_number} ${i.a.customer_name||''} · ${i.label} · ${money27(i.amount)} — ${plainText27(i.reason||'')}`):['Nothing was held back.'];
  nl.forEach(t=>{ const L=doc.splitTextToSize(t,W-2*M); doc.text(L,M,y); y+=L.length*11+2; });
  const flagged=pk.items.filter(i=>i.flag).length;
  const note=`Amounts follow each rep's acknowledged commission plan. ${flagged?`${flagged} payment(s) on deals the preparer is paid on were verified by hand and are marked [!] — check those receipts before signing.`:'Payments on deals the preparer is paid on were verified from Vista receipts, not by hand.'} This packet is numbered ${pkNo}; if anything changes after it is printed, the tracker marks it out of date and a new packet must be signed. Nothing approved here can be edited later — corrections appear as a separate line in a later payout.`;
  y+=6; const NL=doc.splitTextToSize(note,W-2*M-20); doc.setDrawColor(201,207,218); doc.roundedRect(M,y,W-2*M,NL.length*11+16,6,6); doc.setTextColor(...ink); doc.text(NL,M+10,y+14); y+=NL.length*11+34;
  if(y>650){ doc.addPage(); y=80; }
  doc.setDrawColor(...ink); doc.setLineWidth(.8); doc.line(M,y+30,M+230,y+30); doc.line(M+270,y+30,W-M,y+30);
  doc.setFontSize(9); doc.setTextColor(...slate); doc.text('Approved by (Executive) · print name',M,y+44); doc.text('Signature · date',M+270,y+44);
  doc.text(`Packet number on this sheet: ${pkNo}`,M,y+64);
  // one statement per rep behind the cover page
  [...new Set(pk.items.map(i=>i.owner))].forEach(owner=>{ doc.addPage(); header(`Statement · ${nameOf27(owner)}`,sub);
    const mine=pk.items.filter(i=>i.owner===owner); const held=moved.filter(i=>lc27(i.a.owner_email)===owner);
    doc.autoTable({startY:160,margin:{left:M,right:M},head:[['Agreement','Payment','Earned because','Amount']],
      body:mine.map(i=>[`#${i.agreement} ${i.customer}`,i.piece,i.why,money27(i.amount)]).concat([[{content:'Total this payout',colSpan:3,styles:{fontStyle:'bold'}},{content:money27(mine.reduce((s,i)=>s+i.amount,0)),styles:{fontStyle:'bold',halign:'right'}}]]),
      styles:{font:'helvetica',fontSize:9,textColor:ink,cellPadding:5,lineColor:[223,228,236],lineWidth:.5},headStyles:{fillColor:navy,textColor:255},columnStyles:{3:{halign:'right',font:'courier'}}});
    let yy=doc.lastAutoTable.finalY+18; doc.setFontSize(9); doc.setTextColor(...slate);
    if(held.length){ doc.text(doc.splitTextToSize(`Moves to the next payout once the customer payment is verified: ${held.map(i=>`#${i.a.agreement_number} ${i.label} ${money27(i.amount)}`).join('; ')}.`,W-2*M),M,yy); yy+=24; }
    doc.text(`Covered by approval packet ${pkNo}.`,M,yy); });
  const n=doc.internal.getNumberOfPages(); for(let p=1;p<=n;p++){ doc.setPage(p); doc.setFontSize(8); doc.setTextColor(...slate); doc.text('Point 1 · Bonus Tracker · confidential',M,770); doc.text(`Packet ${pkNo} · page ${p} of ${n}`,W-M,770,{align:'right'}); }
  doc.save(`Approval-packet-${pkNo}.pdf`);
}
function drawer27(id,title,kicker,body,foot){
  closeDrawer27(); const sc=document.createElement('div'); sc.className='dscrim27'; sc.id=id+'S';
  const d=document.createElement('aside'); d.className='drawer27'; d.id=id; d.setAttribute('role','dialog'); d.setAttribute('aria-label',title);
  d.innerHTML=`<div class="hd"><div style="display:flex;flex-direction:column;gap:3px">${kicker?`<span style="font-size:12px;font-weight:800;letter-spacing:.06em;color:var(--muted);text-transform:uppercase">${kicker}</span>`:''}<h2>${title}</h2></div><button class="x27" aria-label="Close" data-x27>×</button></div><div class="bd">${body}</div><div class="ft">${foot}</div>`;
  document.body.appendChild(sc); document.body.appendChild(d);
  sc.onclick=closeDrawer27; d.querySelector('[data-x27]').onclick=closeDrawer27; return d;
}
function closeDrawer27(){ document.querySelectorAll('.drawer27,.dscrim27').forEach(x=>x.remove()); }
function executives27(){ return (P27.users||[]).filter(u=>normRole(u.permission_role||u.role)==='Executive'); }
function openRecordApproval27(S){
  const ex=executives27();
  const d=drawer27('rec27','Record Executive approval',`Q${S.run.q} ${S.run.y} · ${money27(S.pkt.total)}`,
    `<div class="note27">Enter what is on the signed packet. The packet number must match the current one — if anything changed after printing, print a new packet and have it signed again.</div>
     <label class="fld27">Approved by (Executive)<select id="ra_by">${ex.length?ex.map(u=>`<option value="${esc(u.email)}">${esc(nameOf27(u.email))} · ${esc(u.email)}</option>`).join(''):'<option value="">No Executive set up — add one in Admin ▸ Employees</option>'}</select></label>
     <label class="fld27">Date signed<input type="date" id="ra_on" value="${E27.businessToday()}"></label>
     <label class="fld27">Packet number on the signed sheet<input id="ra_no" placeholder="${esc(S.pkt.no)}" autocomplete="off"><span class="h">Current packet: <b class="mono">${esc(S.pkt.no)}</b></span></label>
     <div class="fld27"><span>Signed scan <span style="color:#8a1f1f">· required</span></span><div class="file27" id="ra_fbox"><input type="file" id="ra_file" accept=".pdf,.png,.jpg,.jpeg,.heic"></div></div>
     <div id="ra_err" style="color:#8a1f1f;font-size:13px;font-weight:700"></div>`,
    `<button class="btn-primary" id="ra_go" style="padding:12px 16px;font-size:15px" ${ex.length?'':'disabled'}>Record approval &amp; unlock payroll file</button><span class="qctx" style="text-align:center">The approval is permanent. Corrections go in a later payout.</span>`);
  $('ra_file').onchange=()=>$('ra_fbox').classList.toggle('ok',!!$('ra_file').files[0]);
  $('ra_go').onclick=async()=>{ const err=m=>{ $('ra_err').textContent=m; };
    const by=$('ra_by').value, on=$('ra_on').value, no=($('ra_no').value||'').trim().toUpperCase(), f=$('ra_file').files[0];
    if(!by)return err('Choose the Executive who signed.'); if(!on)return err('Enter the date it was signed.');
    if(!no)return err('Type the packet number printed on the signed sheet.');
    const cur=payoutState27(); if(no!==cur.pkt.no.toUpperCase()) return err(`Packet ${no} is out of date — the current packet is ${cur.pkt.no}. Print the new packet and have it signed.`);
    if(!f)return err('Attach the signed scan.');
    $('ra_go').disabled=true; $('ra_go').textContent='Recording…';
    try{ await recordApproval27(cur,{by,on,file:f}); closeDrawer27(); }
    catch(e){ err(/column|schema cache/i.test(e.message||'')?'The database needs the v24 update (migration_v24_payouts.sql) before approvals can be recorded.':(e.message||String(e))); $('ra_go').disabled=false; $('ra_go').textContent='Record approval & unlock payroll file'; } };
}
async function recordApproval27(S,m){
  const run=S.run, ready=S.groups['Ready to pay'], pk=S.pkt;
  const safe=(m.file.name||'scan').replace(/[^\w.\-]+/g,'_').slice(-100);
  const path=`payouts/${run.y}-Q${run.q}/${pk.no}-${safe}`;
  const up=await sb.storage.from(FILE_BUCKET).upload(path,m.file,{contentType:m.file.type||'application/octet-stream',upsert:false}); if(up.error) throw up.error;
  const excluded=S.groups['Pending verification'].concat(S.groups['Excluded from this run']).map(i=>({agreement:i.a.agreement_number,piece:i.label,amount:i.amount,state:i.state,reason:i.reason}));
  const row={year:run.y,quarter:run.q,approved_by:nameOf27(m.by)+' <'+m.by+'>',approved_at:new Date().toISOString(),ready_cents:Math.round(pk.total*100),excluded,export_file:`payroll-${pk.no}.csv`,
    packet_no:pk.no,packet:{no:pk.no,items:pk.items},signed_on:m.on,signed_scan_path:path,recorded_by:CURRENT_EMAIL};
  const {data,error}=await sb.from('rmr_payout_runs').insert(row).select();
  if(error){ try{ await sb.storage.from(FILE_BUCKET).remove([path]); }catch(_){} throw new Error(/duplicate|unique/i.test(error.message)?'This quarter was already approved.':error.message); }
  const runId=data[0].id; const entries=[];
  ready.filter(i=>i.revised).forEach(i=>{ const ev=committedEventsFor(i.a).slice(-1)[0]; if(!ev)return; const t=compute(i.a).tranches; const tt=t&&(i.tranche===1?t.t1:t.t2);
    (ev.snapshot.shares||[]).forEach(s=>entries.push({entry_uid:`${ev.event_uid}|T${i.tranche}|earned|${s.email}`,event_uid:ev.event_uid,tranche:i.tranche,stage:'earned',recipient_email:s.email,amount_cents:Number(i.tranche===1?s.t1Cents:s.t2Cents),earned_date:tt?tt.earnedDate:null,verified_at:new Date().toISOString(),evidence:{conditions:'met',basis:tt&&tt.dateBasis||null},actor:CURRENT_EMAIL}));
    (ev.snapshot.shares||[]).forEach(s=>entries.push({entry_uid:`${ev.event_uid}|T${i.tranche}|payable|${s.email}`,event_uid:ev.event_uid,tranche:i.tranche,stage:'payable',recipient_email:s.email,amount_cents:Number(i.tranche===1?s.t1Cents:s.t2Cents),payout_run_id:runId,approver:m.by,actor:CURRENT_EMAIL})); });
  ready.filter(i=>i.adjustment).forEach(i=>{ const x=i.adjustment; entries.push({entry_uid:String(x.entry_uid).replace('|adjustment|','|payable|'),event_uid:x.event_uid,tranche:null,stage:'payable',recipient_email:x.recipient_email,amount_cents:x.amount_cents,payout_run_id:runId,reason:x.reason,approver:m.by,actor:CURRENT_EMAIL}); });
  if(entries.length){ const r=await sb.from('rmr_ledger_entries').upsert(entries,{onConflict:'entry_uid',ignoreDuplicates:true}); if(r.error) toast('Ledger: '+r.error.message); }
  audit('Payout approved by Executive','Payout',pk.no,null,{approved_by:m.by,signed_on:m.on,total:pk.total,items:pk.items.length,scan:path},null);
  LS.set('pkt27:'+run.y+'Q'+run.q,pk.no);
  await load27(); render(); toast('Approval recorded — the payroll file is unlocked');
}
function downloadPayroll27(d){
  const items=(d.packet&&d.packet.items)||[];
  const csv=['Rep,Rep email,Agreement,Customer,Payment,Amount,Packet,Approved by'].concat(items.map(i=>[i.rep,i.owner,i.agreement,i.customer,i.piece,(i.cents/100).toFixed(2),d.packet_no||'',d.approved_by].map(v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`).join(','))).join('\n');
  const blob=new Blob([csv],{type:'text/csv'}); const u=URL.createObjectURL(blob); const l=document.createElement('a'); l.href=u; l.download=d.export_file||`payroll-Q${d.quarter}-${d.year}.csv`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(()=>URL.revokeObjectURL(u),1000);
  audit('Payroll file downloaded','Payout',d.packet_no||`Q${d.quarter} ${d.year}`,null,{items:items.length},null);
}
function openMarkPaid27(d){
  const items=(d.packet&&d.packet.items)||[];
  drawer27('paid27','Mark paid & lock',`Q${d.quarter} ${d.year} · packet ${esc(d.packet_no||'')}`,
    `<div class="note27">Enter the payroll date these ${items.length} payment(s) went out on. The quarter locks, each payment shows as Paid, and statements become final.</div>
     <label class="fld27">Payroll date<input type="date" id="mp_d" value="${E27.businessToday()}"></label>
     <div style="font-size:13px"><b>${money27(items.reduce((s,i)=>s+i.cents,0)/100)}</b> across ${new Set(items.map(i=>i.owner)).size} rep(s)</div>
     <div id="mp_err" style="color:#8a1f1f;font-size:13px;font-weight:700"></div>`,
    `<button class="btn-primary" id="mp_go" style="padding:12px 16px;font-size:15px">Mark paid &amp; lock the quarter</button>`);
  $('mp_go').onclick=async()=>{ const pd=$('mp_d').value; if(!pd){ $('mp_err').textContent='Enter the payroll date.'; return; }
    $('mp_go').disabled=true; $('mp_go').textContent='Locking…';
    const pay=P27.ledger.filter(x=>x.stage==='payable'&&String(x.payout_run_id)===String(d.id));
    const paid=pay.map(x=>({entry_uid:String(x.entry_uid).replace('|payable|','|paid|'),event_uid:x.event_uid,tranche:x.tranche,stage:'paid',recipient_email:x.recipient_email,amount_cents:x.amount_cents,payout_run_id:d.id,payment_ref:`payroll ${pd}`,approver:x.approver||null,actor:CURRENT_EMAIL}));
    if(paid.length){ const r=await sb.from('rmr_ledger_entries').upsert(paid,{onConflict:'entry_uid',ignoreDuplicates:true}); if(r.error){ $('mp_err').textContent=r.error.message; $('mp_go').disabled=false; return; } }
    for(const i of items){ if(/^Payment \d of 2$/.test(i.piece))continue; const flag=/^initial/i.test(i.label)?'paid_initial':/^immediate/i.test(i.label)?'paid_immediate':/^holdback/i.test(i.label)?'paid_holdback':null;
      if(flag){ const r=await sb.from('rmr_agreements').update({[flag]:true}).eq('id',i.agreement_id); if(!r.error){ const a=AGREEMENTS.find(x=>String(x.id)===String(i.agreement_id)); if(a)a[flag]=true; } } }
    const {error}=await sb.from('rmr_payout_runs').update({paid_date:pd,paid_by:CURRENT_EMAIL,locked_at:new Date().toISOString()}).eq('id',d.id);
    if(error){ $('mp_err').textContent=/column|schema cache/i.test(error.message)?'The database needs the v24 update (migration_v24_payouts.sql).':error.message; $('mp_go').disabled=false; $('mp_go').textContent='Mark paid & lock the quarter'; return; }
    audit('Payout marked paid and locked','Payout',d.packet_no||`Q${d.quarter} ${d.year}`,null,{paid_date:pd,entries:paid.length},null);
    closeDrawer27(); await load27(); render(); toast('Marked paid — the quarter is locked'); };
}

/* ---------------- Guides: role-based, stored privately, opened in a new tab ---------------- */
const GUIDE27={admin:{path:'admin/user-guide.html',title:'Admin & Executive user guide',who:'Administrators, Executives and Managers'},rep:{path:'rep/user-guide.html',title:'Sales rep user guide',who:'Sales reps'}};
const myGuide27=()=>isTeam27()?GUIDE27.admin:GUIDE27.rep;
async function guideInfo27(g){ try{ const dir=g.path.split('/')[0], name=g.path.split('/')[1]; const {data,error}=await sb.storage.from('guides').list(dir); if(error)return {error:error.message}; const f=(data||[]).find(x=>x.name===name); return f?{at:f.updated_at||f.created_at||null,size:(f.metadata&&f.metadata.size)||null}:{missing:true}; }catch(e){ return {error:e.message||String(e)}; } }
async function openUserGuide27(g){
  g=g||myGuide27(); const w=window.open('','_blank');
  if(w){ try{ w.document.write('<!doctype html><title>Opening guide…</title><body style="font-family:system-ui,sans-serif;color:#242424;padding:40px">Opening the guide…</body>'); }catch(_){} }
  const {data,error}=await sb.storage.from('guides').download(g.path);
  if(error||!data){ if(w)w.close(); toast(/not found|404/i.test((error&&error.message)||'')?'That guide hasn\'t been published yet.':((error&&error.message)||'Could not open the guide')); return; }
  const url=URL.createObjectURL(new Blob([await data.text()],{type:'text/html'}));
  if(w){ w.location.href=url; } else { const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(()=>URL.revokeObjectURL(url),120000);
  audit('User guide opened','Guides',g.path,null,null,null);
}
async function renderGuides27(){
  const host=$('guidesHost27'); if(!host)return; const g=myGuide27(); const admin=can('editConfig');
  host.innerHTML=`<div class="row27">
    <div class="card27" style="flex:1 1 380px"><div class="hd"><h2>How to use the tool</h2></div><div class="bd" style="display:flex;flex-direction:column;gap:12px">
      <div style="font-size:15px;font-weight:800">${esc(g.title)}</div>
      <div class="qctx" style="font-size:13.5px;line-height:1.55">${isTeam27()?'Step by step, with screenshots: adding a rep, setting up won deals, Vista imports, the five payout steps, adjustments and reverting a step.':'Step by step, with screenshots: your pipeline, marking a deal won, My pay and your questions.'} Opens in a new tab, with a table of contents, search, and a print button.</div>
      <div id="gd27stat" class="qctx">Checking…</div>
      <div><button class="btn-primary" id="gd27open">Open the guide</button></div></div></div>
    <div class="card27" style="flex:1 1 380px"><div class="hd"><h2>How commissions work</h2></div><div class="bd" style="display:flex;flex-direction:column;gap:12px">
      <div style="font-size:15px;font-weight:800">Commission plan guide</div>
      <div class="qctx" style="font-size:13.5px;line-height:1.55">The plan's multiples, when Payment 1 and Payment 2 are earned, renewals, and a worked example on $100/month.</div>
      <div><button class="btn-ghost" id="gd27plan">Open the plan guide</button></div></div></div>
   </div>
   ${admin?`<div class="card27"><div class="hd"><h2>Publish a guide</h2><span class="qctx">Administrators only · guides are private and shown by role</span></div><div class="bd" style="display:flex;flex-direction:column;gap:12px">
     <div id="gd27list" class="qctx">Loading…</div>
     <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
       <label class="fld27">Guide<select id="gd27which"><option value="admin">${esc(GUIDE27.admin.title)} — ${esc(GUIDE27.admin.who)}</option><option value="rep">${esc(GUIDE27.rep.title)} — ${esc(GUIDE27.rep.who)}</option></select></label>
       <label class="fld27">Guide file (.html)<input type="file" id="gd27file" accept=".html,.htm,text/html"></label>
       <button class="btn-primary" id="gd27up">Publish</button></div>
     <div id="gd27msg" style="font-size:13px;font-weight:700"></div></div></div>`:''}`;
  $('gd27open').onclick=()=>openUserGuide27(g);
  $('gd27plan').onclick=()=>openGuide();
  const st=await guideInfo27(g); if($('gd27stat')) $('gd27stat').textContent=st.missing?'Not published yet.':(st.error?('Unavailable: '+st.error):`Last updated ${fmtD27(st.at)}.`);
  if(st.missing&&$('gd27open')) $('gd27open').disabled=true;
  if(admin){ const rows=[]; for(const k of ['admin','rep']){ const i=await guideInfo27(GUIDE27[k]); rows.push(`<div><b style="color:var(--ink)">${esc(GUIDE27[k].title)}</b> · ${esc(GUIDE27[k].who)} · ${i.missing?'not published yet':(i.error?esc(i.error):'updated '+esc(fmtD27(i.at)))}${!i.missing&&!i.error?` · <button class="lnk27" data-gd27o="${k}">Open</button>`:''}</div>`); }
    if($('gd27list')){ $('gd27list').innerHTML=rows.join(''); $('gd27list').querySelectorAll('[data-gd27o]').forEach(b=>b.onclick=()=>openUserGuide27(GUIDE27[b.dataset.gd27o])); }
    $('gd27up').onclick=async()=>{ const f=$('gd27file').files[0], k=$('gd27which').value, msg=t=>{ $('gd27msg').textContent=t; };
      if(!f)return msg('Choose the guide file first.'); if(!/\.html?$/i.test(f.name))return msg('The guide must be an .html file.');
      $('gd27up').disabled=true; $('gd27msg').style.color='var(--muted)'; msg(`Publishing ${(f.size/1048576).toFixed(1)} MB…`);
      let error=null;
      try{ await sb.auth.getSession(); const r=await Promise.race([sb.storage.from('guides').upload(GUIDE27[k].path,f,{upsert:true,contentType:'text/html'}),new Promise(res=>setTimeout(()=>res({error:{message:'The upload did not finish in 90 seconds. Check your connection and press Publish again.'}}),90000))]); error=r.error||null; }
      catch(e){ error={message:(e&&e.message)||String(e)}; }
      $('gd27up').disabled=false;
      if(error){ $('gd27msg').style.color='#8a1f1f'; return msg(/bucket|not found/i.test(error.message)?'The database needs the v26 update (migration_v26_guides.sql) first.':error.message); }
      audit('User guide published','Guides',GUIDE27[k].path,null,{file:f.name,size:f.size},null); $('gd27msg').style.color='#17603f'; msg(`Published — ${GUIDE27[k].who} now see the new version.`); renderGuides27(); }; }
}

/* ---------------- Administrator: revert one payout step ---------------- */
function openRevert27(d){
  if(!can('editConfig')){ toast('Only an Administrator can revert a payout step.'); return; }
  const unlock=!!d.locked_at; const items=(d.packet&&d.packet.items)||[];
  const what=unlock
    ?`<b>Paid &amp; lock → back to Approved.</b> The ${items.length} payment(s) go back to Approved for payroll, the payroll date ${esc(fmtD27(d.paid_date))} is cleared, and the quarter unlocks so you can mark it paid again. Reps' My pay changes from Paid back to Earned.`
    :`<b>Approved → back to Print packet.</b> The Executive approval by ${esc(d.approved_by)} is removed, the payroll file locks again, and you print a new packet and record the approval again. The signed scan stays on file.`;
  drawer27('rev27','Revert a step',`Q${d.quarter} ${d.year} · packet ${esc(d.packet_no||'')}`,
    `<div class="warn27">${what}</div>
     <div class="note27">Only an Administrator can do this. The reason, your name, the time and a copy of everything removed are kept permanently and show on the Payouts card. If payroll already ran, tell payroll before you change anything.</div>
     <label class="fld27">Reason<textarea id="rv_why" rows="3" placeholder="e.g. Payroll date entered as Jan 30; payroll actually ran Feb 6"></textarea></label>
     <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5"><input type="checkbox" id="rv_ok" style="margin-top:3px"> I understand this undoes the ${unlock?'paid &amp; lock':'approval'} step for the whole quarter.</label>
     <div id="rv_err" style="color:#8a1f1f;font-size:13px;font-weight:700"></div>`,
    `<button class="btn-primary" id="rv_go" style="padding:12px 16px;font-size:15px;background:#8a1f1f">${unlock?'Unlock and revert to Approved':'Undo the approval'}</button>`);
  ['rv_why','rv_ok'].forEach(k=>{ $(k).oninput=()=>$('rv_err').textContent=''; $(k).onchange=()=>$('rv_err').textContent=''; });
  $('rv_go').onclick=async()=>{ const why=($('rv_why').value||'').trim(); const err=t=>$('rv_err').textContent=t;
    if(why.length<10)return err('Give the reason (at least 10 characters).'); if(!$('rv_ok').checked)return err('Tick the box to confirm.');
    $('rv_go').disabled=true; $('rv_go').textContent='Reverting…';
    const {data,error}=await sb.rpc('rmr_revert_payout_step',{p_run:d.id,p_reason:why});
    if(error){ err(/function|schema cache|does not exist/i.test(error.message||'')?'The database needs the v25 update (migration_v25_payout_revert.sql) first.':error.message); $('rv_go').disabled=false; $('rv_go').textContent=unlock?'Unlock and revert to Approved':'Undo the approval'; return; }
    audit(data==='unlock_paid'?'Payout unlocked (paid & lock reverted)':'Payout approval reverted','Payout',d.packet_no||`Q${d.quarter} ${d.year}`,{approved_by:d.approved_by,paid_date:d.paid_date||null},{step:data},why);
    if(data==='undo_approval') LS.del('pkt27:'+d.year+'Q'+d.quarter);
    closeDrawer27(); await load(); await load27(); render(); toast(data==='unlock_paid'?'Unlocked — the quarter is back to Approved':'Approval undone — print and record a new approval'); };
}
(function hookReversals27(){
  const orig=window.load27; if(typeof orig!=='function')return;
  window.load27=async function(){ const r=await orig.apply(this,arguments); try{ const {data,error}=await sb.from('rmr_payout_reversals').select('*'); P27.reversals=error?[]:(data||[]); }catch(_){ P27.reversals=[]; } return r; };
})();

/* ---------------- Adjusting a recorded commission ---------------- */
function openAdjust27(agreementId){
  if(!can('approvePayout')){ toast('Only an Administrator or Executive can adjust a commission.'); return; }
  const recorded=AGREEMENTS.filter(a=>committedEventsFor(a).length).sort((x,y)=>String(x.agreement_number).localeCompare(String(y.agreement_number),undefined,{numeric:true}));
  const ex=executives27();
  drawer27('adj27','Adjust a commission','Separate line in the next payout',
    `<div class="note27">A recorded commission is never edited. An adjustment adds a separate line — positive or negative — that goes in the next approval packet with your reason and the Executive who approved it.</div>
     <label class="fld27">Agreement<select id="aj_ag">${recorded.map(a=>`<option value="${esc(a.id)}" ${String(a.id)===String(agreementId)?'selected':''}>#${esc(a.agreement_number||'—')} · ${esc(a.customer_name||'')}</option>`).join('')||'<option value="">No recorded sales yet</option>'}</select></label>
     <label class="fld27">Paid to<select id="aj_to"></select></label>
     <label class="fld27"><span>Amount <span class="h">· use a minus sign to reduce, e.g. -25.00</span></span><input type="number" step="0.01" id="aj_amt" placeholder="0.00"></label>
     <label class="fld27">Reason<textarea id="aj_why" rows="3" placeholder="e.g. Customer added a second monitoring line on Nov 12 — $25/mo × 1.0 for 36 months"></textarea></label>
     <label class="fld27">Approved by (Executive)<select id="aj_by">${ex.map(u=>`<option value="${esc(u.email)}">${esc(nameOf27(u.email))}</option>`).join('')||'<option value="">No Executive set up</option>'}</select></label>
     <div id="aj_cur" class="qctx"></div><div id="aj_err" style="color:#8a1f1f;font-size:13px;font-weight:700"></div>`,
    `<button class="btn-primary" id="aj_go" style="padding:12px 16px;font-size:15px">Add adjustment</button><span class="qctx" style="text-align:center">Shows on the rep's My pay and in the next packet.</span>`);
  const fill=()=>{ const a=AGREEMENTS.find(x=>String(x.id)===$('aj_ag').value); const ev=a&&committedEventsFor(a).slice(-1)[0]; const sh=(ev&&ev.snapshot&&ev.snapshot.shares)||[{email:a&&a.owner_email}];
    $('aj_to').innerHTML=sh.filter(x=>x.email).map(x=>`<option value="${esc(x.email)}">${esc(nameOf27(x.email))}</option>`).join('');
    $('aj_cur').textContent=ev?`Recorded commission: ${E27.fmtCents(BigInt(ev.total_cents))} (${ev.snapshot.planLabel||''}, ${String(ev.event_date||'').slice(0,10)}).`:''; };
  if(recorded.length){ $('aj_ag').onchange=fill; fill(); }
  $('aj_go').onclick=async()=>{ const err=t=>{ $('aj_err').textContent=t; };
    const a=AGREEMENTS.find(x=>String(x.id)===$('aj_ag').value); const ev=a&&committedEventsFor(a).slice(-1)[0]; if(!ev)return err('Pick an agreement with a recorded sale.');
    const amt=Math.round((+$('aj_amt').value||0)*100), why=($('aj_why').value||'').trim(), by=$('aj_by').value, to=$('aj_to').value;
    if(!amt)return err('Enter the amount.'); if(why.length<8)return err('Explain the reason — it prints on the packet.'); if(!by)return err('Choose the Executive who approved it.');
    const row={entry_uid:`${ev.event_uid}|ADJ${Date.now()}|adjustment|${to}`,event_uid:ev.event_uid,tranche:null,stage:'adjustment',recipient_email:to,amount_cents:amt,earned_date:E27.businessToday(),reason:why,approver:by,actor:CURRENT_EMAIL};
    const {error}=await sb.from('rmr_ledger_entries').insert(row); if(error)return err(error.message);
    audit('Commission adjustment added','Payout',a.agreement_number,null,{to,amount:amt/100,reason:why,approved_by:by},why);
    closeDrawer27(); await load27(); render(); toast(`Adjustment of ${money27(amt/100)} added — it goes in the next payout`); };
}
(function hookAdjustButton27(){
  const orig=window.bindRevisedPreview; if(typeof orig!=='function')return;
  window.bindRevisedPreview=function(row,c){ orig.apply(this,arguments);
    if(!can('approvePayout')||typeof editingId==='undefined'||!editingId)return; const a=AGREEMENTS.find(x=>x.id===editingId); if(!a||!committedEventsFor(a).length)return;
    const box=$('mPreview'); if(!box||$('adjBtn27'))return; const d=document.createElement('div'); d.style.cssText='margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
    d.innerHTML=`<button type="button" class="btn-ghost" id="adjBtn27">Adjust commission…</button><span class="qctx">Adds a separate approved line to the next payout. The recorded commission stays as it is.</span>`; box.appendChild(d);
    $('adjBtn27').onclick=()=>openAdjust27(a.id); };
})();

/* ---------------- Vista imports page ---------------- */
function renderImports27(){
  const host=$('importsHost27'); if(!host)return;
  if(!$('impIntro27')){ host.innerHTML=`<div id="impIntro27"></div><div id="impSlot27"></div>`; }
  if(P27.ready){ const run=E27.payoutCalendar(P27.settings.payout_calendar);
    $('impIntro27').innerHTML=`<div class="kpis27">${['invoices','receipts'].map(f=>{ const h=feedHealth(f); return `<div class="kpi27"><span class="k">${esc(V27.FEEDS[f].label)}</span><span class="v" style="font-size:22px;font-family:inherit;font-weight:800;color:${h.due.state==='ok'?'#17603f':(h.due.state==='overdue'?'#8a1f1f':'var(--ink)')}">${({ok:'Up to date',overdue:'Overdue','due soon':'Due soon',due:'Due','not loaded':'Not loaded'})[h.due.state]||esc(h.due.state)}</span><span class="s">${esc(h.due.label)} · data through ${esc(fmtD27(h.through))}</span></div>`; }).join('')}
      <div class="kpi27"><span class="k">Next deadline</span><span class="v" style="font-size:20px;font-family:inherit;font-weight:800">${fmtD27(run.cutoff)}</span><span class="s">files reaching ${fmtD27(run.quarterEnd)} for the Q${run.q} ${run.y} payout</span></div></div>
      <div class="note27" style="margin-top:14px">Run each report in Vista, export it to Excel, and drop the file on its slot below. Open <b>How do I get this file?</b> on any slot for the exact menu path and settings. Nothing is saved until you check the preview and press Confirm.</div>`; }
  let el=$('vistaPanel27'); const slot=$('impSlot27');
  if(!el){ el=document.createElement('div'); el.id='vistaPanel27'; slot.appendChild(el); } else if(el.parentElement!==slot) slot.appendChild(el);
  renderVistaPanel();
  el.querySelectorAll('details').forEach(dt=>{ const s=dt.querySelector('summary'); if(s){ s.style.fontWeight='700'; s.style.fontSize='13px'; } });
}
(function hookVistaPanel27(){
  const orig=window.renderVistaPanel; if(typeof orig!=='function')return;
  window.renderVistaPanel=function(){ const slot=$('impSlot27'); let el=$('vistaPanel27');
    if(slot&&!el){ el=document.createElement('div'); el.id='vistaPanel27'; slot.appendChild(el); } else if(slot&&el&&el.parentElement!==slot) slot.appendChild(el);
    return orig.apply(this,arguments); };
  if($('importsHost27')) $('importsHost27').innerHTML='<div id="impIntro27"></div><div id="impSlot27"></div>';
})();

/* ---------------- Rep: My pay ---------------- */
function myLines27(){
  const out=[];
  scopedAgreements().forEach(a=>{ let c; try{ c=compute(a); }catch(_){ return; }
    if(c.revised&&c.revisedCalc){ revisedQuarterLines27(a,c).forEach(l=>out.push({a,piece:l.piece,label:`Payment ${l.piece} of 2`,amount:l.amount,qi:l.qi,state:l.rstate==='approved'?'earned':l.rstate,rstate:l.rstate,note:l.rstate==='paid'?'Paid on payroll':l.rstate==='approved'?'Approved — on the next payroll':l.rstate==='earned'?`Earned ${fmtD27(String(l.note).replace(/^earned /,''))} — in the next payout`:l.note})); return; }
    const push=(type,flag,qi)=>{ if(qi==null)return; const f=frozenAmount(a,type); if(!(f.amount>0))return; out.push({a,piece:type,label:type==='holdback'?'Deferred piece':'Initial piece',amount:f.amount,qi,state:a[flag]?'paid':(qi<=CUR_QI?'earned':'expected'),rstate:a[flag]?'paid':'expected',note:a[flag]?'paid':'historical plan'}); };
    if(c.legacyFull) push('initial','paid_initial',c.initialQI); else { push('immediate','paid_immediate',c.initialQI); push('holdback','paid_holdback',c.holdbackQI); }
  });
  const team=isTeam27(), me=lc27(CURRENT_EMAIL);
  P27.ledger.filter(x=>x.stage==='adjustment'&&(team||lc27(x.recipient_email)===me)).forEach(x=>{ const ev=P27.events.find(e=>e.event_uid===x.event_uid); const a=ev&&AGREEMENTS.find(g=>String(g.id)===String(ev.agreement_id)); if(!a)return;
    const paid=P27.ledger.some(y=>y.entry_uid===String(x.entry_uid).replace('|adjustment|','|paid|')); const d=String(x.earned_date||x.created_at||E27.businessToday()).slice(0,10);
    out.push({a,piece:'adj',label:'Adjustment',amount:Number(x.amount_cents)/100,qi:qIndexFromYM(+d.slice(0,4),+d.slice(5,7)-1),state:paid?'paid':'earned',rstate:paid?'paid':'earned',note:(x.reason||'Adjustment')+(paid?' · paid':' · in the next payout')}); });
  return out;
}
function renderMyPay27(){
  const host=$('view-quarter'); if(!host||!P27.ready)return;
  let el=$('myPay27'); if(!el){ el=document.createElement('div'); el.id='myPay27'; el.className='pg27'; el.style.marginBottom='18px'; } host.insertBefore(el,host.firstChild); const lab=$('qByQuarter27'); if(lab){ el.after(lab); lab.textContent='Browse by quarter'; }
  const me=lc27(CURRENT_EMAIL); const run=E27.payoutCalendar(P27.settings.payout_calendar);
  const L=myLines27(); const yr=new Date().getFullYear();
  const sum=f=>L.filter(f).reduce((s,l)=>s+l.amount,0);
  const items=payoutItems(run); const readyNow=items.filter(i=>i.state==='Ready to pay').reduce((s,i)=>s+i.amount,0);
  const earnedOpen=sum(l=>l.state==='earned');
  const nextRun=readyNow>0?run:E27.payoutCalendar(P27.settings.payout_calendar,E27.addDays(run.quarterEnd,100));
  const next=readyNow>0?readyNow:earnedOpen;
  const waiting=sum(l=>l.state==='expected'&&l.piece===1), expected=sum(l=>l.state==='expected'&&l.piece!==1), paidAll=sum(l=>l.state==='paid');
  // chart: two quarters back → four ahead
  const qs=[]; for(let q=CUR_QI-2;q<=CUR_QI+4;q++) qs.push(q);
  const by=qs.map(q=>({q,expected:0,earned:0,paid:0})); L.forEach(l=>{ const b=by.find(x=>x.q===l.qi); if(b) b[l.state]+=l.amount; });
  const max=Math.max(1,...by.map(b=>b.expected+b.earned+b.paid)); const nice=(()=>{ const p=Math.pow(10,Math.floor(Math.log10(max))); return Math.ceil(max/p)*p; })();
  const W=720,H=240,pl=56,pr=12,pt=14,pb=34, cw=(W-pl-pr)/by.length, bw=Math.min(46,cw*0.56);
  const ys=v=>pt+(H-pt-pb)*(1-v/nice);
  let bars=''; by.forEach((b,i)=>{ const x=pl+i*cw+(cw-bw)/2; let base=0; const segs=[['paid',b.paid],['earned',b.earned],['expected',b.expected]].filter(s=>s[1]>0);
    segs.forEach(([k,v],j)=>{ const y0=ys(base), y1=ys(base+v); const h=Math.max(0,y0-y1-(j<segs.length-1?2:0)); const top=j===segs.length-1;
      bars+= top?`<path d="M${x},${y0} V${y1+4} Q${x},${y1} ${x+4},${y1} H${x+bw-4} Q${x+bw},${y1} ${x+bw},${y1+4} V${y0} Z" fill="${RAMP27[k]}" transform="translate(0,${(j>0?-2:0)})"/>`:`<rect x="${x}" y="${y0-h}" width="${bw}" height="${h}" fill="${RAMP27[k]}"/>`;
      base+=v; });
    bars+=`<rect x="${pl+i*cw}" y="${pt}" width="${cw}" height="${H-pt-pb}" fill="transparent" data-tip27="${i}"/>`;
    bars+=`<text x="${x+bw/2}" y="${H-pb+18}" text-anchor="middle" font-size="12" fill="${b.q===CUR_QI?'#242424':'#5B6478'}" font-weight="${b.q===CUR_QI?800:500}">${esc(qLabel(b.q))}</text>`; });
  let grid=''; for(let k=0;k<=4;k++){ const v=nice*k/4, y=ys(v); grid+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="#edf0f5"/><text x="${pl-8}" y="${y+4}" text-anchor="end" font-size="11" fill="#5B6478">${v>=1000?'$'+(v/1000).toFixed(v%1000?1:0)+'k':'$'+Math.round(v)}</text>`; }
  const myQ=P27.worklist.filter(w=>w.type==='rep_question'&&lc27((w.detail||{}).requested_by)===me).sort((x,y)=>y.id-x.id);
  const rows=L.filter(l=>l.state!=='paid'||(l.qi!=null&&l.qi>=CUR_QI-2)).sort((x,y)=>(x.qi??1e9)-(y.qi??1e9));
  const pill=s=>s==='paid'?'<span class="pill27 paid">Paid</span>':s==='earned'?'<span class="pill27 ear">Earned</span>':'<span class="pill27 exp">Expected</span>';
  el.innerHTML=`<div class="kpis27">
     <div class="kpi27 hero"><span class="k">Next commission payment</span><span class="v">${money27(next)}</span><span class="s">${next>0?`Q${nextRun.q} ${nextRun.y} payout · paid by ${fmtD27(nextRun.payBy)} · final once approved`:'Nothing earned yet — see Waiting on payment'}</span></div>
     <div class="kpi27"><span class="k">Waiting on payment</span><span class="v">${money27(waiting)}</span><span class="s">payment 1s, earned when the first invoice is paid</span></div>
     <div class="kpi27"><span class="k">Expected later</span><span class="v">${money27(expected)}</span><span class="s">payment 2s, earned three months after first billing</span></div>
     <div class="kpi27"><span class="k">Paid to date</span><span class="v">${money27(paidAll)}</span><span class="s">on payroll</span></div></div>
   <div class="row27">
    <div class="card27" style="flex:999 1 520px"><div class="hd"><h2>Commission by quarter</h2><div class="legend27"><span><i style="background:${RAMP27.expected}"></i>Expected</span><span><i style="background:${RAMP27.earned}"></i>Earned</span><span><i style="background:${RAMP27.paid}"></i>Paid</span></div></div>
      <div class="bd"><svg class="chart27" viewBox="0 0 ${W} ${H}" role="img" aria-label="Your commission by quarter: expected, earned and paid">${grid}${bars}<line x1="${pl}" x2="${W-pr}" y1="${ys(0)}" y2="${ys(0)}" stroke="#c4ccd9"/></svg></div></div>
    <div class="card27" style="flex:1 1 300px"><div class="hd"><h2>Estimate a deal</h2></div><div class="bd" style="display:flex;flex-direction:column;gap:12px">
      <label class="fld27">Monthly RMR<input type="number" id="es27_m" value="250" min="0"></label>
      <label class="fld27">Term<select id="es27_t">${[12,24,36,48,60].map(t=>`<option value="${t}" ${t===36?'selected':''}>${t} months</option>`).join('')}</select></label>
      <div class="note27" id="es27_out"></div></div></div>
   </div>
   <div class="card27"><div class="hd"><h2>My payments</h2><span class="qctx">Each deal pays in two parts. Question anything that looks wrong.</span></div>
     ${rows.length?`<div style="overflow-x:auto"><table class="tbl27"><thead><tr><th>Deal</th><th>Payment</th><th>Quarter</th><th>Status</th><th>What it's waiting on</th><th class="num">Amount</th><th></th></tr></thead><tbody>${rows.map((l,i)=>`<tr><td><b>#${esc(l.a.agreement_number||'—')}</b> ${esc(l.a.customer_name||'')}</td><td style="white-space:nowrap">${esc(l.label)}</td><td>${l.qi!=null?esc(qLabel(l.qi)):'—'}</td><td>${pill(l.state)}</td><td class="qctx" style="max-width:280px">${esc(plainText27(String(l.note||'')))}</td><td class="num">${money27(l.amount)}</td><td style="text-align:right"><button class="lnk27" data-q27="${i}">Question this</button></td></tr>`).join('')}</tbody></table></div>`
       :`<div class="empty"><b>No payments yet</b>When your admin records a sale, both payments appear here.</div>`}</div>
   <div class="card27"><div class="hd"><h2>My questions</h2><span class="qctx">${myQ.filter(w=>w.status==='open').length} open</span></div>
     ${myQ.length?`<div class="bd" style="display:flex;flex-direction:column;gap:12px">${myQ.map(w=>`<div style="border:1px solid #e3e7ee;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b style="font-size:14px">#${esc((w.detail||{}).agreement||w.record_ref||'')} · ${esc((w.detail||{}).piece_label||'')}</b>${w.status==='open'?'<span class="pill27 exp">Waiting for an answer</span>':'<span class="pill27 ear">Answered</span>'}</div><div style="font-size:13.5px">${esc((w.detail||{}).question||w.title)}</div>${w.status==='closed'?`<div class="note27"><b>Answer from ${esc(nameOf27(w.closed_by))}</b> · ${esc(fmtD27(w.closed_at))}<br>${esc(w.close_basis||'')}</div>`:`<div class="qctx">Asked ${esc(fmtD27(w.created_at))}</div>`}</div>`).join('')}</div>`
       :`<div class="empty" style="padding:28px 20px"><b>No questions</b>Use “Question this” on any payment and your admin's answer shows here.</div>`}</div>`;
  // estimator
  const est=()=>{ const v=liveVersionOf(compFamilyOf(me)||'Hybrid'); const m=+$('es27_m').value||0, t=+$('es27_t').value; const mult=v&&v.config&&v.config.newMult?+v.config.newMult[t]:null;
    $('es27_out').innerHTML=mult==null?'Your plan is not set up yet — ask your admin.':`<span style="font-size:12px;font-weight:800;letter-spacing:.06em;color:var(--muted)">ESTIMATED COMMISSION</span><div class="mono" style="font-size:24px;margin:2px 0">${money27(m*mult)}</div>${money27(m)}/mo × ${mult}× for ${t} months, at a 45%+ margin. Paid in two parts: ${money27(m*mult/2)} when the first invoice is paid, ${money27(m*mult/2)} three months after first billing.`; };
  $('es27_m').oninput=est; $('es27_t').onchange=est; est();
  // hover tooltips
  const tip=$('tip27'); el.querySelectorAll('[data-tip27]').forEach(r=>{ r.onmousemove=e=>{ const b=by[+r.dataset.tip27]; tip.innerHTML=`<b>${esc(qLabel(b.q))}</b><br>Expected ${money27(b.expected)}<br>Earned ${money27(b.earned)}<br>Paid ${money27(b.paid)}`; tip.style.display='block'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+14)+'px'; }; r.onmouseleave=()=>tip.style.display='none'; });
  el.querySelectorAll('[data-q27]').forEach(b=>b.onclick=()=>openQuestion27(rows[+b.dataset.q27]));
}
function openQuestion27(l){
  drawer27('q27','Question this payment',`#${esc(l.a.agreement_number||'')} · ${esc(l.a.customer_name||'')}`,
    `<div class="note27">${esc(l.label)} · <b>${money27(l.amount)}</b> · ${l.qi!=null?esc(qLabel(l.qi)):'no quarter yet'} · ${esc(l.state)}</div>
     <label class="fld27">What looks wrong?<textarea id="q27_t" rows="5" placeholder="e.g. The customer paid the first invoice on Nov 3 — shouldn't payment 1 be earned?"></textarea></label>
     <div id="q27_err" style="color:#8a1f1f;font-size:13px;font-weight:700"></div>`,
    `<button class="btn-primary" id="q27_go" style="padding:12px 16px;font-size:15px">Send to admin</button><span class="qctx" style="text-align:center">The answer appears under My questions.</span>`);
  $('q27_go').onclick=async()=>{ const t=($('q27_t').value||'').trim(); if(t.length<5){ $('q27_err').textContent='Write your question first.'; return; }
    const me=lc27(CURRENT_EMAIL); const owner=(((P27.settings.feed_owners||{}).agreement_terms||{}).owner)||ADMIN_EMAILS[0];
    const it={item_uid:`q:${l.a.id}:${l.piece}:${Date.now()}`,type:'rep_question',record_ref:String(l.a.agreement_number||l.a.id),title:`${nameOf27(me)} asks about #${l.a.agreement_number||''} ${l.label} (${money27(l.amount)}): ${t.slice(0,160)}`,
      detail:{requested_by:me,agreement:l.a.agreement_number,agreement_id:l.a.id,piece:l.piece,piece_label:l.label,amount:l.amount,question:t},owner_email:owner,due_date:E27.addDays(E27.businessToday(),3),status:'open'};
    const {error}=await sb.from('rmr_worklist').insert(it);
    if(error){ $('q27_err').textContent=/check constraint|type_check/i.test(error.message)?'Questions need the v24 database update — ask your admin to run it.':error.message; return; }
    audit('Rep question sent','Worklist',it.record_ref,null,{piece:l.label,question:t},null); closeDrawer27(); P27.worklist=await fetchAll('rmr_worklist','id'); render(); toast('Question sent'); };
}

/* ---------------- Rep: My plan ---------------- */
function renderMyPlan27(){
  const host=$('myplanHost27'); if(!host)return; if(!P27.ready){ host.innerHTML='<div class="card27"><div class="bd">Loading…</div></div>'; return; }
  const me=lc27(CURRENT_EMAIL); const today=E27.businessToday();
  const asg=P27.assignments.filter(x=>lc27(x.email)===me).sort((x,y)=>String(y.effective_from).localeCompare(String(x.effective_from)));
  const cur=asg.find(x=>x.effective_from<=today&&(!x.effective_to||today<x.effective_to))||asg[0]||null;
  const v=cur?versionById(cur.plan_version_id):null; const ack=v?P27.acks.find(k=>lc27(k.email)===me&&String(k.plan_version_id)===String(v.id)):null;
  const run=E27.payoutCalendar(P27.settings.payout_calendar); const c=(v&&v.config)||{}; const m=c.newMult||{};
  host.innerHTML=!v?`<div class="card27"><div class="empty"><b>No plan assigned yet</b>Your admin assigns your commission plan in Admin ▸ Employees.</div></div>`:`
   <div class="kpis27">
    <div class="kpi27 hero"><span class="k">Your plan</span><span class="v" style="font-family:inherit;font-weight:800;font-size:22px">${esc(v.label)}</span><span class="s">effective ${fmtD27(cur.effective_from)}</span></div>
    <div class="kpi27"><span class="k">Acknowledged</span><span class="v" style="font-family:inherit;font-weight:800;font-size:20px">${ack?fmtD27(ack.created_at||ack.acknowledged_at):'Not yet'}</span><span class="s">${ack?'stored with the exact terms shown':'<button class="lnk27" id="mp27ack">Read and acknowledge</button>'}</span></div>
    <div class="kpi27"><span class="k">Paid</span><span class="v" style="font-family:inherit;font-weight:800;font-size:20px">Quarterly</span><span class="s">next pay date ${fmtD27(run.payBy)}</span></div></div>
   <div class="row27">
    <div class="card27" style="flex:1 1 360px"><div class="hd"><h2>How you're paid</h2></div><div class="bd" style="font-size:14px;line-height:1.6;display:flex;flex-direction:column;gap:10px">
      <div><b>Commission = monthly RMR × term multiple</b>, on deals at a ${Math.round((+c.minMargin||0.45)*100)}% margin or better.</div>
      <table class="tbl27" style="font-size:13.5px"><thead><tr><th>Term</th><th class="num">Multiple</th><th class="num">On $100/mo</th></tr></thead><tbody>${[12,24,36,48,60].map(t=>`<tr><td>${t} months</td><td class="num">${m[t]!=null?m[t]+'×':'—'}</td><td class="num">${m[t]!=null?money27(100*m[t]):'—'}</td></tr>`).join('')}</tbody></table>
      <div><b>Payment 1</b> (half) is earned when the customer pays the first invoice. <b>Payment 2</b> (half) is earned three months after first billing, with every invoice due by then paid.</div>
      <div>Earned payments are verified by the 15th after quarter end and paid by the 30th. A payment not verified in time moves to the next quarter.</div>
      <div>Manual renewals pay ${c.renewalMult!=null?c.renewalMult+'×':'—'} the retained monthly RMR.</div>
      <button class="btn-ghost" id="mp27guide" style="align-self:flex-start">Open the full guide</button></div></div>
    <div class="card27" style="flex:1 1 420px"><div class="hd"><h2>The terms you accepted</h2></div><div class="bd"><div style="white-space:pre-wrap;font-size:13px;line-height:1.6;color:#3d4452;max-height:520px;overflow:auto">${esc(ack&&ack.text_shown?ack.text_shown:termsText(v))}</div></div></div>
   </div>`;
  if($('mp27guide')) $('mp27guide').onclick=()=>openGuide();
  if($('mp27ack')) $('mp27ack').onclick=()=>checkAcknowledgement();
}

/* ---------------- Rep: Mark won needs the signed contract ---------------- */
function openMarkWon27(id){
  const o=AGREEMENTS.find(x=>String(x.id)===String(id)); if(!o)return; const me=lc27(CURRENT_EMAIL);
  const v=liveVersionOf(compFamilyOf(me)||'Hybrid'); const nm=(v&&v.config&&v.config.newMult)||{};
  const d=drawer27('mw27',`Mark ${esc(o.customer_name||'this opportunity')} won`,esc(o.opportunity_number||''),
    `<span style="font-size:13px;color:var(--muted)">Your admin sets up the agreement and records the sale from this.</span>
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label class="fld27">Signed date<input type="date" id="mw27_d" value="${E27.businessToday()}"></label>
      <label class="fld27">Final monthly RMR<input type="number" id="mw27_m" min="0" value="${esc(o.est_monthly_rmr||'')}"></label>
      <label class="fld27" style="grid-column:1 / -1">Term<select id="mw27_t">${[12,24,36,48,60].map(t=>`<option value="${t}" ${(+o.contract_term||36)===t?'selected':''}>${t} months</option>`).join('')}</select></label></div>
     <div class="fld27"><span>Signed contract <span style="color:#8a1f1f">· required</span></span><div class="file27" id="mw27_box"><input type="file" id="mw27_f" accept=".pdf,.png,.jpg,.jpeg,.heic,.doc,.docx"></div></div>
     <label class="fld27"><span>Note for your admin <span class="h">· optional</span></span><input id="mw27_n" placeholder="e.g. customer wants install before Feb 1"></label>
     <div class="note27" style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span>Estimated commission, at 45%+ margin</span><b class="mono" style="font-size:18px;font-weight:500" id="mw27_est">—</b></div>
     <div id="mw27_err" style="color:#8a1f1f;font-size:13px;font-weight:700"></div>`,
    `<button class="btn-primary" id="mw27_go" style="padding:12px 16px;font-size:15px" disabled>Send to admin</button><span class="qctx" style="text-align:center" id="mw27_hint">The button stays off until the signed contract is attached.</span>`);
  const upd=()=>{ const m=+$('mw27_m').value||0, t=+$('mw27_t').value, mult=nm[t]!=null?+nm[t]:null; $('mw27_est').textContent=mult!=null&&m>0?money27(m*mult):'—';
    const f=$('mw27_f').files[0]; $('mw27_box').classList.toggle('ok',!!f); $('mw27_go').disabled=!(f&&m>0); $('mw27_hint').textContent=f?(m>0?'Ready to send.':'Enter the final monthly RMR.'):'The button stays off until the signed contract is attached.'; };
  ['mw27_m','mw27_t','mw27_f'].forEach(k=>{ $(k).oninput=upd; $(k).onchange=upd; }); upd();
  $('mw27_go').onclick=async()=>{ const f=$('mw27_f').files[0]; if(!f)return; $('mw27_go').disabled=true; $('mw27_go').textContent='Uploading the contract…';
    try{ await uploadAttachment(o.id,f,'Signed contract'); }
    catch(e){ $('mw27_err').textContent='The contract did not upload: '+(e.message||e); $('mw27_go').disabled=false; $('mw27_go').textContent='Send to admin'; return; }
    await markWon27(o.id,{signed_date:$('mw27_d').value||null,final_mrr:+$('mw27_m').value||null,term:+$('mw27_t').value,note:($('mw27_n').value||'').trim()||null,contract:f.name});
    closeDrawer27(); };
}
(function hookMarkWon27(){
  const orig=window.renderOpportunities; if(typeof orig!=='function')return;
  window.renderOpportunities=function(){ orig.apply(this,arguments);
    if(can('editAgreements'))return; const wrap=$('oppTableWrap'); if(!wrap)return;
    wrap.querySelectorAll('tr').forEach(tr=>{ const ed=tr.querySelector('[data-oppedit]'); if(!ed)return; const id=ed.dataset.oppedit;
      [...tr.querySelectorAll('button.paidbtn')].filter(b=>b.textContent==='Mark won').forEach(b=>{ b.onclick=()=>openMarkWon27(id); }); }); };
})();
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.querySelector('.drawer27')) closeDrawer27(); });
