/* ===================================================================================================
   Spec v2.7 application layer — plan versions, fail-closed routing, evidence, Vista import, Worklist,
   Admin (families · employees · acknowledgement), agreement Commission / Costs / History, payout run.
   Loaded after the legacy script; every legacy screen calls compute(), which routes here.
   =================================================================================================== */
"use strict";
const REVISED_CUTOVER='2026-10-04';      // v2.7 deployment: transactions dated on/after this read only versioned plans (MIG-05, PAY-05)
const SPEC_VERSION='2.7';
const P27={ready:false,missing:null,versions:[],history:[],assignments:[],salaries:[],acks:[],events:[],shares:[],ledger:[],costVersions:[],
  batches:[],invoices:[],receipts:[],verifs:[],worklist:[],settings:{},rules:[],terms:[],costs:[],payoutRuns:[],users:[]};
let EVIDENCE_AGREEMENT=null;
const E27=window.P1E, V27=window.P1V;

/* ---------------- loading ---------------- */
async function fetchAll(table,order){
  let all=[],from=0; for(;;){ let q=sb.from(table).select('*').range(from,from+999); if(order)q=q.order(order); const {data,error}=await q; if(error)throw error; all=all.concat(data||[]); if(!data||data.length<1000)break; from+=1000; } return all;
}
async function load27(){
  try{
    const T=[['versions','rmr_plan_versions','version_no'],['history','rmr_plan_history'],['assignments','rmr_plan_assignments'],['salaries','rmr_salary_records'],
      ['acks','rmr_plan_acknowledgements'],['events','rmr_comm_events','id'],['shares','rmr_credit_shares'],['ledger','rmr_ledger_entries','id'],['costVersions','rmr_cost_versions','id'],
      ['batches','rmr_import_batches','id'],['invoices','rmr_vista_invoices'],['receipts','rmr_vista_receipts'],['verifs','rmr_receipt_verifications','id'],['worklist','rmr_worklist','id'],
      ['rules','rmr_cost_class_rules','id'],['terms','rmr_vista_agreement_terms'],['costs','rmr_vista_costs'],['payoutRuns','rmr_payout_runs','id']];
    const res=await Promise.all(T.map(([k,t,o])=>fetchAll(t,o).then(d=>[k,d])));
    res.forEach(([k,d])=>P27[k]=d);
    const st=await fetchAll('rmr_settings'); P27.settings={}; st.forEach(r=>P27.settings[r.key]=r.value);
    try{ const {data}=await sb.from('rmr_users').select('*'); P27.users=data||[]; }catch(_){ P27.users=[]; }
    P27.ready=true; P27.missing=null;
  }catch(e){ P27.ready=false; P27.missing=e.message||String(e); }
  indexEvidence();
}
(function hookLoad(){ const orig=load; load=async function(){ await orig(); await load27(); render(); setTimeout(checkAcknowledgement,300); }; })();

/* ---------------- evidence indexes (BIL-03, BIL-04, VIS-10) ---------------- */
let INV_BY_NO={}, VERIF_BY_INV={}, RECEIPTS_BY_INV={}, INV_BY_AGR={};
function indexEvidence(){
  INV_BY_NO={}; VERIF_BY_INV={}; RECEIPTS_BY_INV={}; INV_BY_AGR={};
  P27.invoices.forEach(i=>{ INV_BY_NO[i.invoice_number]=i; if(i.agreement_number)(INV_BY_AGR[i.agreement_number]=INV_BY_AGR[i.agreement_number]||[]).push(i); });
  P27.verifs.forEach(v=>{ (VERIF_BY_INV[v.invoice_number]=VERIF_BY_INV[v.invoice_number]||[]).push(v); });
  P27.receipts.forEach(r=>{ if(r.invoice_number)(RECEIPTS_BY_INV[r.invoice_number]=RECEIPTS_BY_INV[r.invoice_number]||[]).push(r); });
}
function collectionEvidence(invNo,amount){
  // Confirmed only on a Vista receipt allocation or a documented verification. A zero balance is "settled", not "collected".
  if(!invNo)return null;
  const rec=RECEIPTS_BY_INV[invNo]||[]; const rsum=rec.reduce((s,r)=>s+(+r.amount||0),0);
  if(rec.length&&rsum>=(+amount||0)-0.005) return {state:'Confirmed',source:'Vista receipt',date:rec.map(r=>r.receipt_date).filter(Boolean).sort().pop()||null,verifiedAt:null};
  const vs=(VERIF_BY_INV[invNo]||[]).slice().sort((a,b)=>String(a.verified_at).localeCompare(String(b.verified_at)));
  const last=vs[vs.length-1];
  if(last){ if(last.evidence_state==='Confirmed'&&(last.total_paid==null||+last.total_paid>=(+amount||+last.total_amount||0)-0.005)) return {state:'Confirmed',source:last.source,date:last.receipt_date||null,verifiedAt:last.verified_at,by:last.verified_by};
    return {state:last.evidence_state==='Confirmed'?'Unverified':last.evidence_state,source:last.source,partial:true,verifiedAt:last.verified_at}; }
  return {state:'Unverified'};
}
function billingRowCollected(e){ if(!e)return false; const ev=collectionEvidence(e.invoice_no,e.amount); return !!(ev&&ev.state==='Confirmed'); }
function billingRowFinancial(e){
  const vi=e.invoice_no?INV_BY_NO[e.invoice_no]:null;
  if(vi) return V27.invoiceStatus(vi);
  if(!e.invoice_no) return (e.status==='paid'||e.status==='unpaid')?'Invoiced':'Scheduled';    // a manual flag without an invoice is not a Vista record
  if(e.status==='paid') return 'Paid';                       // v21 load from zero-balance Vista invoices: settled, cash unverified
  return 'Invoiced';
}
function billingRowStatusHTML(e){
  const fin=billingRowFinancial(e); const ev=e.invoice_no?collectionEvidence(e.invoice_no,e.amount):null; const today=E27.businessToday();
  const past=String(e.date||'').slice(0,10)<=today;
  let finTxt=fin, col='var(--muted)';
  if(fin==='Scheduled'&&past){ finTxt='Awaiting Vista record'; col='var(--orange)'; }
  if(fin==='Invoiced'&&e.status==='unpaid'){ finTxt='Invoiced · overdue'; col='var(--held)'; }
  if(fin==='Paid'||fin==='Settled by credit')col='var(--ink)'; if(fin==='Voided')col='var(--held)';
  const evTxt=ev?(ev.state==='Confirmed'?`<span style="color:var(--payable);font-weight:700">Cash confirmed</span>`:`<span style="color:var(--orange)">${ev.state}</span>`):'';
  const orig=e.status==='auto'?' <span class="qctx" title="Originally auto-marked paid by date only — preserved in rmr_billing_log_audit_v22">(was auto)</span>':'';
  return `<span style="color:${col};font-weight:600">${finTxt}</span>${evTxt?' · '+evTxt:''}${orig}`;
}
function billingRowActionHTML(e,i){
  if(!can('verifyEvidence'))return '';
  const ev=e.invoice_no?collectionEvidence(e.invoice_no,e.amount):null;
  if(ev&&ev.state==='Confirmed')return '<span class="qctx">✓ evidence recorded</span>';
  return `<button type="button" class="iconbtn" data-verify-row="${i}" title="Record collection evidence from the Vista SM Agreements ▸ Invoices tab (VIS-10)">Verify collection</button>`;
}
function openVerifyForm(i){
  const e=EDIT_LOG[i]; if(!e)return; const box=$('blogTableWrap'); if(!box)return;
  let f=$('verifyForm27'); if(f)f.remove();
  f=document.createElement('div'); f.id='verifyForm27'; f.style.cssText='margin-top:8px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:#f7f9fc;font-size:12.5px';
  f.innerHTML=`<b>Record collection evidence</b> — row ${i+1}, ${esc(String(e.date||'').slice(0,10))}, ${fmt2(+e.amount||0)}
   <div class="qctx" style="margin:4px 0 8px">Open Vista ▸ Service Management ▸ SM Agreements ▸ this agreement ▸ Invoices tab. Copy the values for this invoice. A credit settles a balance but is not cash collected. This does not change the earning conditions; it records the evidence.</div>
   <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    Invoice # <input id="vf_inv" class="cfg-in" style="width:110px" value="${esc(e.invoice_no||'')}">
    Invoice date <input id="vf_date" type="date" class="cfg-in" value="${esc(String(e.date||'').slice(0,10))}">
    Total amount <input id="vf_total" type="number" step="0.01" class="cfg-in" style="width:100px" value="${e.amount!=null?e.amount:''}">
    Total paid <input id="vf_paid" type="number" step="0.01" class="cfg-in" style="width:100px">
    Total billed <input id="vf_billed" type="number" step="0.01" class="cfg-in" style="width:100px">
    Status <select id="vf_status" class="cfg-in"><option>Invoiced</option><option>Paid</option><option>Voided</option><option>Pending</option></select>
    Source <select id="vf_src" class="cfg-in"><option value="sm_invoices_tab">Read on SM Agreements Invoices tab</option><option value="export_grid">Export Grid file</option>${can('approvePayout')?'<option value="override">Documented override (VIS-08)</option>':''}</select>
    <input id="vf_appr" class="cfg-in" style="width:150px" placeholder="Approver (override only)">
    Receipt date <input id="vf_rdate" type="date" class="cfg-in" title="Only if Vista shows the true cash date; otherwise the earning date is the date of this confirmation (VIS-10)">
    <input id="vf_note" class="cfg-in" style="min-width:200px" placeholder="Evidence note (e.g. Export Grid file name)">
    <button type="button" class="btn-primary" id="vf_save">Record evidence</button> <button type="button" class="iconbtn" id="vf_cancel">Cancel</button></div>`;
  box.appendChild(f);
  $('vf_cancel').onclick=()=>f.remove();
  $('vf_save').onclick=async()=>{
    const inv=$('vf_inv').value.trim(); if(!inv){toast('Enter the Vista invoice number');return;}
    const paid=$('vf_paid').value===''?null:+$('vf_paid').value, total=+$('vf_total').value||0, st=$('vf_status').value;
    const a=editingId?AGREEMENTS.find(x=>x.id===editingId):null;
    const state=(st==='Voided')?'Disputed':((paid!=null&&paid>=total-0.005&&total>0)?'Confirmed':'Unverified');
    const row={verification_uid:`${inv}|${$('vf_src').value}|${Date.now()}`,agreement_id:a?a.id:null,agreement_number:a?a.agreement_number:null,invoice_number:inv,
      invoice_date:$('vf_date').value||null,total_amount:total,total_paid:paid,total_billed:$('vf_billed').value===''?null:+$('vf_billed').value,vista_status:st,
      evidence_state:state,source:$('vf_src').value,receipt_date:$('vf_rdate').value||null,evidence:$('vf_note').value.trim()||null,verified_by:CURRENT_EMAIL};
    if(row.source==='override'){ row.approver=($('vf_appr').value||'').trim(); row.reason=row.evidence; if(!row.approver||!row.reason){ toast('An override needs an approver, a reason and evidence (VIS-08)'); return; } }
    const {data,error}=await sb.from('rmr_receipt_verifications').insert(row).select(); if(error){toast(error.message);return;}
    P27.verifs.push((data&&data[0])||row); indexEvidence();
    if(!e.invoice_no){ e.invoice_no=inv; }
    audit('Collection evidence recorded','Billing',a?a.agreement_number:null,null,row,null);
    toast(state==='Confirmed'?'Collection confirmed — save the agreement to keep the invoice number on the row':'Recorded — paid amount does not cover the invoice, evidence stays '+state);
    f.remove(); renderBillingLog();
  };
}

/* ---------------- routing: fail-closed plan resolution (CAT-05) ---------------- */
function eventDateOf(a){ return String(a.original_sale_date||a.activation_date||'').slice(0,10)||null; }
function isRevisedTransaction(a){
  if(!a||a.history_only||a.historical_import)return false;
  const d=eventDateOf(a); if(!d)return true;                 // not yet signed → future transaction, versioned plans only
  return d>=REVISED_CUTOVER;
}
function versionById(id){ return P27.versions.find(v=>String(v.id)===String(id))||null; }
function resolveRevised(email,dateIso){
  email=String(email||'').toLowerCase(); const d=dateIso||E27.businessToday();
  if(!P27.ready)return {state:'not_configured',reason:'Plan not configured — the v2.7 plan tables are not available yet (run migration_v22_spec27.sql).'};
  const asg=P27.assignments.filter(x=>String(x.email).toLowerCase()===email&&x.effective_from<=d&&(!x.effective_to||d<x.effective_to));
  if(!asg.length)return {state:'not_configured',reason:`Plan not configured — ${email||'this owner'} has no approved plan assignment covering ${d}.`};
  if(asg.length>1)return {state:'not_configured',reason:'Plan not configured — overlapping assignments (TEC-02); resolve in Admin.'};
  const v=versionById(asg[0].plan_version_id);
  if(!v||v.status!=='published'||(v.config&&v.config.placeholder))return {state:'not_configured',reason:'Plan not configured — the assigned version is not a published, configured plan.'};
  if(v.effective_date>d)return {state:'not_configured',reason:`Plan not configured — ${v.label} is effective from ${v.effective_date}.`};
  const ack=P27.acks.find(k=>String(k.email).toLowerCase()===email&&String(k.plan_version_id)===String(v.id));
  if(!ack)return {state:'ack_required',version:v,reason:`Blocked — ${email} has not acknowledged the written terms of ${v.label} (COM-07).`};
  return {state:'ok',version:v,assignment:asg[0]};
}
function planVersionPlain(v){ return v?{id:v.id,family:v.family,label:v.label,status:v.status,rate_basis:v.rate_basis,config:v.config}:null; }
const SHADOW_CFG=(()=>{ const c=historicalEffectiveConfig({planVersion:'(display only)',basis:'TCV',newPct:{12:0,24:0,36:0,48:0,60:0},renewalPct:{12:0,24:0,36:0,48:0,60:0},autoRenewalPct:{12:0,24:0},
  marginTiers:[{min:0.45,mult:1,label:'Eligible',status:'At or above 45% floor'},{min:0,mult:0,label:'Not eligible',status:'Below 45% floor'}],minMargin:0.45,targetMargin:0.5,immediatePct:0.5,holdbackPct:0.5,releaseMode:'offset',releaseOffsetMonths:3}); c.historical=false; return c; })();
const NULL_COMM={initialCommission:null,immediateCommission:null,holdbackCommission:null,renewalCommission:null,baseCommissionNew:null,baseCommissionRenewal:null,
  standardCommission:null,acceleratorCommission:0,acceleratorHeld:0,acceleratorPieces:[],conversionCommission:0,quotaAccelExtra:0};
function planNotConfiguredResult(a,reason){
  const R=computeLegacy(a,SHADOW_CFG); Object.assign(R,NULL_COMM,{planNotConfigured:true,planReason:reason,planVersion:'Plan not configured',eligible:false,legacyFull:false});
  return R;
}
function compute(a,plan){
  if(plan) return computeLegacy(a,plan);                     // explicit historical plan (snapshots)
  if(isRevisedTransaction(a)) return computeRevised(a);
  return computeLegacy(a);
}
function agreementInvoices(a){
  // Merge Vista invoice records (authoritative financial state) with the agreement's billing rows (schedule).
  const out=[], seen=new Set();
  (INV_BY_AGR[String(a.agreement_number||'')]||[]).forEach(vi=>{ seen.add(vi.invoice_number);
    out.push({number:vi.invoice_number,date:vi.invoice_date,dueDate:vi.due_date||vi.invoice_date,total:+vi.total||+vi.amount||0,status:V27.invoiceStatus(vi),collected:collectionEvidence(vi.invoice_number,+vi.total||+vi.amount||0)}); });
  (Array.isArray(a.billing_log)?a.billing_log:[]).forEach(e=>{ if(e.invoice_no&&seen.has(e.invoice_no))return;
    out.push({number:e.invoice_no||'',date:String(e.date||'').slice(0,10),dueDate:String(e.date||'').slice(0,10),total:+e.amount||0,status:billingRowFinancial(e),collected:e.invoice_no?collectionEvidence(e.invoice_no,e.amount):null}); });
  return out.sort((x,y)=>String(x.date).localeCompare(String(y.date)));
}
function revisedInputs(a){
  const mrrQ=E27.eligibleMrrCentsRational(a), term=+a.contract_term||0;
  const cost=E27.modelledCost(a); const qm=E27.qualificationMargin(mrrQ,term,cost);
  const isSla=a.category==='sla';
  let eventType=isSla?'sla_new':'new_sale', prior=null;
  if(a.transfer_from){ const pred=AGREEMENTS.find(x=>String(x.agreement_number||'')===String(a.transfer_from)&&x.id!==a.id); prior=pred?agreementMrr(pred):0; eventType='expansion'; }
  return {mrrQ,term,cost,qm,isSla,eventType,prior};
}
function committedEventsFor(a){ return P27.events.filter(e=>String(e.agreement_id)===String(a.id)).sort((x,y)=>x.id-y.id); }
function computeRevised(a){
  const res=resolveRevised(a.owner_email,eventDateOf(a)||E27.businessToday());
  const inp=revisedInputs(a);
  const R=computeLegacy(a,SHADOW_CFG);
  const gm=inp.qm.margin?Number(inp.qm.margin.n*1000000n/inp.qm.margin.d)/1000000:null;
  Object.assign(R,{revised:true,grossMargin:gm,costState:inp.cost.state,costNotes:inp.cost.notes,costUnverified:inp.cost.state==='legacy_only',marginReason:inp.qm.reason||null,
    planState:res.state,planReason:res.reason||null});
  const ev=committedEventsFor(a);
  let calc=null, err=null;
  if(ev.length){ const last=ev[ev.length-1]; calc={fromLedger:true,totalCents:BigInt(last.total_cents),tranche1Cents:BigInt(last.snapshot.tranche1Cents),tranche2Cents:BigInt(last.snapshot.tranche2Cents),label:last.snapshot.planLabel,eventType:last.event_type,snapshot:last.snapshot}; }
  else if(res.state==='ok'){
    try{ calc=E27.calculate({plan:planVersionPlain(res.version),eventType:inp.eventType,term:inp.term,category:a.category,newMrr:inp.mrrQ?E27.toDollars(E27.roundHalfUp(inp.mrrQ)):null,
      priorMrr:inp.prior!=null?String(inp.prior):null,slaAnnual:inp.isSla&&inp.mrrQ?E27.toDollars(E27.roundHalfUp(E27.mul(inp.mrrQ,E27.R(12n)))):null,margin:inp.qm.margin,
      shares:[{email:String(a.owner_email||'').toLowerCase(),bp:10000}]}); }
    catch(e){ err=e; }
  }
  if(!calc){
    Object.assign(R,NULL_COMM,{planNotConfigured:res.state!=='ok',planVersion:res.state==='ok'?res.version.label:(res.state==='ack_required'?'Acknowledgement required':'Plan not configured'),
      eligible:false,blockedReason:err?err.message:(res.reason||'Blocked'),blockedField:err?err.field:null,legacyFull:false});
    return R;
  }
  const d=c=>Number(c)/100;
  const tr=E27.evaluateTranches(calc,{activationDate:a.activation_date?String(a.activation_date).slice(0,10):null,ended:isEnded(a),cancelledDate:a.ended_date||null,invoices:agreementInvoices(a),offsetMonths:3});
  const qiOf=iso=>iso?qIndexFromYM(+iso.slice(0,4),+iso.slice(5,7)-1):null;
  const t1q=tr.t1.state==='Earned'?qiOf(tr.t1.earnedDate):R.initialQI, t2date=tr.t2.state==='Earned'?tr.t2.earnedDate:(tr.t2.timeDate||null);
  const renewMrr=agreementMrr(a), renewCents=(!R.noRenewal&&!a.autorenew&&(+a.contract_term>0)&&res.state==='ok')?E27.roundHalfUp(E27.mul(E27.R(E27.cents(String(Math.round(renewMrr*100)/100))),E27.dec(res.version.config.renewalMult||'0.25'))):0n;
  Object.assign(R,{revisedCalc:calc,tranches:tr,planVersion:calc.label||(res.version&&res.version.label),planType:'R',marginMultiplier:calc.gate?Number(calc.gate.mult.n)/Number(calc.gate.mult.d):(calc.totalCents>0n?1:0),
    eligible:calc.totalCents>0n,initialCommission:d(calc.totalCents),baseCommissionNew:d(calc.totalCents),standardCommission:d(calc.totalCents),
    immediateCommission:d(calc.tranche1Cents),holdbackCommission:d(calc.tranche2Cents),immediatePct:0.5,holdbackPct:0.5,releaseMode:'offset',releaseOffsetMonths:3,
    initialQI:t1q,holdbackReleaseDate:t2date?new Date(t2date+'T00:00:00'):null,holdbackQI:qiOf(t2date),acceleratorCommission:0,acceleratorHeld:0,acceleratorPieces:[],conversionCommission:0,
    renewalCommission:d(renewCents),baseCommissionRenewal:d(renewCents),legacyFull:false,stage:calc.fromLedger?'Qualified':'Expected commission'});
  return R;
}
function reconBonusConfig(y){
  const v=P27.versions.find(x=>x.family==='Hybrid'&&x.status==='published');
  if(v&&v.config){ const n=t=>(t||[]).map(r=>({min:+r.min,pct:+r.pct})); return {grrBonus:n(v.config.grrBonus),nrrBonus:n(v.config.nrrBonus)}; }
  const own=resolvePlan({owner_email:CURRENT_EMAIL}); return own?{grrBonus:own.grrBonus||[],nrrBonus:own.nrrBonus||[]}:null;
}
function planStatusTag(){
  const fam=PLAN_FAMILIES.map(f=>{ const vs=P27.versions.filter(v=>v.family===f); const pub=vs.find(v=>v.status==='published'); const dr=vs.find(v=>v.status==='draft');
    return `${f}: ${pub?'live '+esc(pub.label)+' from '+pub.effective_date:(dr?(dr.config&&dr.config.placeholder?'Not configured':'draft'):'—')}`; });
  return `Historical agreements read their own plan · ${fam.join(' · ')}`;
}

/* ---------------- agreement editor: summary, section-7 fields, revised panel, costs, history ---------------- */
function fillAgreement27(a){
  const v=(k)=>a&&a[k]!=null?a[k]:'';
  const set=(id,val)=>{ const el=$(id); if(el){ if(el.type==='checkbox')el.checked=!!val; else el.value=val; } };
  set('f_origsale',a&&a.original_sale_date?String(a.original_sale_date).slice(0,10):''); set('f_revision',v('revision_id')); set('f_vistaref',v('vista_ref'));
  set('f_quoteref',v('quote_ref')); set('f_quoteexp',a&&a.quote_expiration?String(a.quote_expiration).slice(0,10):''); set('f_predreason',v('predecessor_reason'));
  set('f_costzero',a&&a.cost_confirmed_zero); set('f_costowner',v('cost_owner_email')); set('f_costdeadline',a&&a.cost_deadline?String(a.cost_deadline).slice(0,10):'');
  if($('f_termconv')){ const lbl=$('f_termconv').closest('.fld'); if(lbl) lbl.style.display=(a&&!isRevisedTransaction(a)&&a.term_conversion)?'':'none'; }   // F-07: hidden for revised Hybrid
  renderAgSummary27(a); renderCosts27(a); renderCommHist27(a);
  document.querySelectorAll('#agTabs button').forEach(b=>{ if(b.dataset.tab==='hist'&&!b._bound27){ b._bound27=true; b.addEventListener('click',()=>renderCommHist27(editingId?AGREEMENTS.find(x=>x.id===editingId):null)); } });
}
function badge(txt,kind,title){ const c={ok:'c-paid',warn:'c-maturing',bad:'c-held',info:''}[kind]||''; return `<span class="chip ${c}" style="font-size:10px" ${title?`title="${esc(title)}"`:''}>${txt}</span>`; }
function renderAgSummary27(a){
  const box=$('agSummary27'); if(!box)return;
  if(!a){ box.innerHTML=''; return; }
  const c=compute(a), mrr=agreementMrr(a);
  const costB=c.costUnverified?badge('Cost basis unverified','bad','Only the legacy monthly direct cost is populated (CST-10)'):(c.grossMargin==null?badge('Cost missing','bad','Missing costs are never assumed to be zero'):badge('Cost entered (modelled)','ok'));
  const qualB=c.planNotConfigured?badge('Plan not configured','warn',c.planReason||c.blockedReason):(c.revised?(c.eligible?badge('Qualifies','ok'):badge('Not qualified','bad',c.blockedReason||c.marginReason||'')):(c.eligible?badge('Qualifies (historical plan)','ok'):badge('Not qualified (historical plan)','bad',c.marginStatus||'')));
  const inv=agreementInvoices(a); const issued=inv.filter(i=>i.status!=='Scheduled'); const conf=issued.filter(i=>i.collected&&i.collected.state==='Confirmed');
  const payB=!issued.length?badge('Awaiting Vista record','warn'):(conf.length===issued.length?badge('All issued invoices cash-confirmed','ok'):badge(`${issued.length-conf.length} of ${issued.length} invoices unverified`,'warn','Missing receipt evidence'));
  const term=+a.contract_term||0;
  box.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:4px 0 12px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:#fafbfc;font-size:12.5px">
    <b>#${esc(a.agreement_number||'—')}</b><span>${esc(a.customer_name||'')}${a.site_number?' · site '+esc(a.site_number):''}</span>
    <span>${isEnded(a)?'Ended':(isLiveAgreement(a)?'Active':esc(a.stage||''))}</span><span>Owner ${esc(a.owner_email||'—')}</span>
    <span>Term ${term?term+' mo':'M2M'}${a.term_end?' → '+esc(String(a.term_end).slice(0,10)):''}</span><span>MRR <b>${fmt2(mrr)}</b> · ARR ${fmt(mrr*12)}</span>
    <span>${costB} ${qualB} ${payB}</span>
    <span class="qctx">Plan: ${esc(c.planVersion||'')}${c.revised?'':' (historical)'} · event date ${esc(eventDateOf(a)||'—')}</span></div>`;
}
function revisedPreviewHTML(row,c){
  const st=(c.planNotConfigured||c.blockedReason)?`<div style="background:#fff4e8;border:1px solid #f3d4ad;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#8a5a17"><b>${esc(c.planVersion||'Plan not configured')}.</b> ${esc(c.blockedReason||c.planReason||'')}<br>Agreement entry, edits, costs, documents and pipeline work all remain available. Only new commission qualification, earning and payout are blocked — never shown as $0 (CAT-05).${c.blockedField?` <i>See the ${esc(c.blockedField)} field.</i>`:''}</div>`:'';
  const k=c.revisedCalc; const gm=c.grossMargin==null?`<span style="color:var(--held)">Unknown — ${esc(c.marginReason||'cost missing')}</span>`:`${(Math.round(c.grossMargin*100000)/1000).toFixed(3)}%`;
  let rows='';
  if(k&&k.components){ rows=k.components.map(x=>`<tr><td>${esc(x.label)}</td><td class="num mono">${E27.fmtCents(E27.roundHalfUp(x.basis))}</td><td class="num mono">${E27.ratStr(x.mult,4)}×</td><td class="num mono">${E27.fmtCents(E27.roundHalfUp(x.amount))}</td></tr>`).join(''); }
  const tr=c.tranches;
  const tRow=(n,t,amt)=>t?`<tr><td>Tranche ${n}</td><td class="num mono">${E27.fmtCents(amt)}</td><td>${t.state==='Earned'?`<b style="color:var(--payable)">Earned unpaid</b> ${esc(t.earnedDate)}${t.dateBasis?` <span class="qctx">(${esc(t.dateBasis)})</span>`:''}`:(n===2?'Conditional holdback':'Expected commission')}</td><td style="white-space:normal;font-size:11.5px">${t.conditions.map(esc).join('<br>')||'—'}</td></tr>`:'';
  return `<h4 style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">Commission <span style="font-weight:500;font-size:11px;color:var(--muted)">plan ${esc(c.planVersion||'—')} · engine ${E27.FORMULA_VERSION} · ${c.stage||''}</span></h4>
   ${st}
   <div class="pgrid">
    <div><span>Event type</span><b style="font-size:13px">${esc(k?(k.eventType||'').replace('_',' '):revisedInputs(row).eventType.replace('_',' '))}</b></div>
    <div><span>Eligible MRR <span style="color:var(--none)">(${row.custom_billing?'normalised first 12 months ÷ 12':'contractual monthly rate'})</span></span><b style="font-size:14px">${fmt2(agreementMrr(row))}</b></div>
    <div><span>Term</span><b style="font-size:13px">${+row.contract_term||'M2M'} months</b></div>
    <div><span>Qualification margin <span style="color:var(--none)">(modelled direct cost only · floor 45%)</span></span><b style="font-size:14px">${gm}</b></div>
   </div>
   ${rows?`<table class="cfg-table" style="margin-top:8px"><thead><tr><th>Component</th><th class="num">Basis (MRR)</th><th class="num">Multiple</th><th class="num">Amount</th></tr></thead><tbody>${rows}
     <tr class="tot"><td><b>Total commission</b> ${k.gate?`<span class="qctx">× margin gate ${E27.ratStr(k.gate.mult,1)} — ${esc(k.gate.label)}</span>`:''}</td><td></td><td></td><td class="num mono"><b>${E27.fmtCents(k.totalCents)}</b></td></tr></tbody></table>
     ${k.displayTcvPct?`<div class="qctx" style="margin-top:4px">Displayed TCV rate ${E27.pctStr(k.displayTcvPct,4)} — derived for display only; the multiple is authoritative (COM-06).</div>`:''}`:''}
   ${k?`<table class="cfg-table" style="margin-top:8px"><thead><tr><th>Tranche</th><th class="num">Amount</th><th>State</th><th>Conditions</th></tr></thead><tbody>${tRow(1,tr&&tr.t1,k.tranche1Cents)}${tRow(2,tr&&tr.t2,k.tranche2Cents)}</tbody></table>
     <div class="qctx" style="margin-top:4px">Sales credit: ${k.shares?k.shares.map(s=>`${esc(s.email)} ${s.bp/100}%`).join(', '):esc(row.owner_email||'')+' 100%'} · Tranche 1 earns on activation + first invoice fully collected; tranche 2 three calendar months after first actual billing with every invoice due through then collected (PAY-01).</div>`:''}
   ${(k&&!k.fromLedger&&editingId&&can('verifyEvidence'))?`<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b style="font-size:12px">Create commission event:</b>
      <button type="button" class="iconbtn" data-commit27="new_sale">New sale</button><button type="button" class="iconbtn" data-commit27="expansion">Expansion</button><button type="button" class="iconbtn" data-commit27="manual_renewal">Renewal</button>
      ${row.category==='sla'?'<button type="button" class="iconbtn" data-commit27="sla_new">SLA sale</button>':''}<span class="qctx">Saving the agreement never creates a commission (AGR-02). An event locks the plan version, cost version and calculation snapshot.</span></div>`:''}
   ${k&&k.fromLedger?`<div class="qctx" style="margin-top:6px">🔒 Committed event — values are the immutable snapshot. Corrections are separate linked adjustments (LED-05).</div>`:''}
   <div style="margin-top:10px">${c.contractNet!=null?`<span class="qctx">Contribution after allocated overhead (analytical view only): ${fmt(c.contractNet)} over the term · gross margin never includes overhead (CST-03).</span>`:''}</div>`;
}
function bindRevisedPreview(row,c){
  document.querySelectorAll('[data-commit27]').forEach(b=>b.onclick=()=>commitEvent27(b.dataset.commit27));
}
async function commitEvent27(type,aid){
  const _id=aid||editingId; const a=_id?AGREEMENTS.find(x=>x.id===_id):null; if(!a){toast('Save the agreement first');return false;}
  if(!P27.ready){toast('Run migration_v22_spec27.sql first');return;}
  const res=resolveRevised(a.owner_email,eventDateOf(a)); if(res.state!=='ok'){toast(res.reason);return;}
  const inp=revisedInputs(a);
  // CST-12: qualification reads a locked, approved cost version
  const cv=P27.costVersions.filter(x=>String(x.agreement_id)===String(a.id)).sort((x,y)=>y.version_no-x.version_no)[0];
  if(!cv){ toast('Approve and lock a cost version on the Costs tab first (CST-12).'); return; }
  const lockedA=Object.assign({},a,cv.costs);
  const qm=E27.qualificationMargin(E27.eligibleMrrCentsRational(lockedA),+a.contract_term||0,E27.modelledCost(lockedA));
  let calc;
  try{ calc=E27.calculate({plan:planVersionPlain(res.version),eventType:type,term:+a.contract_term||0,category:a.category,newMrr:E27.toDollars(E27.roundHalfUp(inp.mrrQ)),
      priorMrr:inp.prior!=null?String(inp.prior):(type==='manual_renewal'||type==='expansion'?String(agreementMrr(a)):null),slaAnnual:type.startsWith('sla')?E27.toDollars(E27.roundHalfUp(E27.mul(inp.mrrQ,E27.R(12n)))):null,
      margin:qm.margin,shares:[{email:String(a.owner_email||'').toLowerCase(),bp:10000}]}); }
  catch(e){ toast(e.message); return; }
  const date=eventDateOf(a)||E27.businessToday();
  const uid=`${a.id}|${type}|${date}|${a.contract_term||0}`;
  const ser=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?v.toString():(v&&typeof v==='object'&&'n' in v&&'d' in v&&typeof v.n==='bigint')?{n:v.n.toString(),d:v.d.toString(),value:E27.ratStr(v,6)}:v));
  const snap=ser({planLabel:res.version.label,planVersionId:res.version.id,eventType:type,term:+a.contract_term||0,eligibleMrr:E27.ratStr(inp.mrrQ,2),priorMrr:inp.prior,
    margin:qm.margin?E27.ratStr(qm.margin,6):null,marginInputs:cv.costs,costVersion:cv.version_no,components:calc.components,gate:calc.gate,totalCents:calc.totalCents,tranche1Cents:calc.tranche1Cents,tranche2Cents:calc.tranche2Cents,
    shares:calc.shares,earningConditions:'T1: activated + first nonzero invoice fully collected; T2: 3 calendar months after first actual billing, active, all invoices due collected',calculatedAt:new Date().toISOString(),formulaVersion:E27.FORMULA_VERSION,costMode:'modelled'});
  const ev={event_uid:uid,agreement_id:a.id,agreement_number:a.agreement_number,event_type:type==='escalation'?'expansion':type,event_date:date,plan_version_id:res.version.id,cost_version_id:cv.id,
    opportunity_number:a.opportunity_number||null,quote_ref:a.quote_ref||null,snapshot:snap,formula_version:E27.FORMULA_VERSION,cost_mode:'modelled',total_cents:Number(calc.totalCents),created_by:CURRENT_EMAIL};
  const r1=await sb.from('rmr_comm_events').insert(ev).select(); if(r1.error){ toast(/duplicate|unique/i.test(r1.error.message)?'This event already exists — events are unique (LED-04).':r1.error.message); return; }
  const shares=calc.shares.map(s=>({event_uid:uid,recipient_email:s.email,share_bp:s.bp,confirmed:true}));
  await sb.from('rmr_credit_shares').insert(shares);
  const entries=[]; calc.shares.forEach(s=>{ [[1,s.t1Cents],[2,s.t2Cents]].forEach(([t,amt])=>entries.push({entry_uid:`${uid}|T${t}|qualified|${s.email}`,event_uid:uid,tranche:t,stage:'qualified',recipient_email:s.email,amount_cents:Number(amt),actor:CURRENT_EMAIL})); });
  await sb.from('rmr_ledger_entries').insert(entries);
  audit('Commission event created','Ledger',a.agreement_number,null,{event_uid:uid,total:E27.toDollars(calc.totalCents),plan:res.version.label},null);
  await load27(); toast('Sale recorded — '+E27.fmtCents(calc.totalCents)+' commission'); if(!aid){ updatePreview(); renderCommHist27(a); } render(); return true;
}
function renderCosts27(a){
  const box=$('costs27'); if(!box)return;
  if(!a){ box.innerHTML='<div class="file-hint">Save the agreement to approve and lock a cost version.</div>'; return; }
  const c=compute(a), cost=E27.modelledCost(a);
  const vers=P27.costVersions.filter(x=>String(x.agreement_id)===String(a.id)).sort((x,y)=>y.version_no-x.version_no);
  const posted=P27.costs.filter(x=>String(x.agreement_number||'')===String(a.agreement_number||''));
  const buckets={direct_unburdened:0,direct_burdened:0,overhead:0,unresolved:0}; posted.forEach(x=>buckets[x.bucket]=(buckets[x.bucket]||0)+(+x.amount||0));
  const postedTot=Object.values(buckets).reduce((s,v)=>s+v,0);
  const modAnnual=cost.annual?Number(E27.roundHalfUp(E27.mul(cost.annual,E27.R(100n))))/100:null;
  const dates=posted.map(x=>x.post_date).filter(Boolean).sort(); let months=null;
  if(dates.length){ months=Math.max(1,E27.daysBetween(dates[0],dates[dates.length-1])/30.4375+1); }
  const modForPeriod=(modAnnual!=null&&months)?modAnnual*months/12:null;
  const variance=(modForPeriod!=null&&posted.length)?(postedTot-buckets.overhead-modForPeriod):null;
  const vlabel=!posted.length?'No posted cost imported':(buckets.unresolved>0?(variance!=null?'Provisional':'Variance unavailable — classification required'):'Comparable');
  box.innerHTML=`<div class="fieldset-h" style="margin-top:4px">Cost verification &amp; approved version</div>
   <div style="font-size:12.5px;line-height:1.6">Modelled direct cost: <b>${modAnnual!=null?fmt2(modAnnual)+' / yr':'missing'}</b> · state <b>${esc(cost.state)}</b>${cost.notes.length?' — '+cost.notes.map(esc).join(' '):''}
   ${c.costDoubleCountFlag||cost.doubleCountFlag?'<br><span style="color:var(--held)">Legacy monthly direct cost is populated alongside itemised costs — counted once, flagged for review (F-09).</span>':''}</div>
   <div style="margin-top:6px">${vers.length?vers.map(v=>`<div class="file-row"><div class="fr-meta" style="font-size:12px">🔒 Cost version <b>v${v.version_no}</b> · ${fmt2(Number(v.annual_direct_cents)/100)}/yr · approved by ${esc(v.approver)} on ${esc(String(v.approved_at).slice(0,10))}${v.evidence?' · '+esc(v.evidence):''}</div></div>`).join(''):'<div class="file-hint">No approved cost version yet — qualification reads the locked version, never live figures (CST-12).</div>'}</div>
   ${can('verifyEvidence')?`<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="cv27_evid" class="cfg-in" style="min-width:240px" placeholder="Supporting evidence (quote, vendor invoice…)"><button type="button" class="iconbtn" id="cv27_lock" ${cost.state!=='complete'?'disabled title="Complete the cost breakdown first"':''}>Approve &amp; lock current costs</button></div>`:''}
   <div class="fieldset-h" style="margin-top:12px">Posted versus Modelled <span class="hint">reporting only — never feeds qualification (CST-01, CST-07)</span></div>
   <div style="font-size:12.5px;line-height:1.6">${posted.length?`Posted mode (all four buckets): <b>${fmt2(postedTot)}</b> — direct unburdened ${fmt2(buckets.direct_unburdened)} · direct burdened (contains overhead) ${fmt2(buckets.direct_burdened)} · overhead ${fmt2(buckets.overhead)} · <b>unresolved ${fmt2(buckets.unresolved)}</b> (retained in the total)<br>
     Modelled for the same period (${months?months.toFixed(1):'—'} months): <b>${modForPeriod!=null?fmt2(modForPeriod):'—'}</b> · variance excl. posted overhead lump: <b>${variance!=null?fmt2(variance):'—'}</b> · <b>${vlabel}</b><br><span class="qctx">Normalised to matching periods (CST-14). Overhead is identified by description text and is approximate (F-17). Labour burden cannot be split from labour in this export.</span>`:'No posted cost lines are mapped to this agreement yet. Import SM Work Order Profitability Detail on the Reconciliation tab.'}</div>`;
  if($('cv27_lock')) $('cv27_lock').onclick=async()=>{
    const keys=['loaded_labor_rate','labor_schedule','inspection_frequency','hours_per_inspection','material_cost_annual','monitoring_cost_annual','software_cost_annual','subcontractor_annual_cost','other_direct_annual','monthly_direct_cost','cost_confirmed_zero'];
    const live=readForm(); const costs={}; keys.forEach(k=>costs[k]=live[k]!==undefined?live[k]:a[k]);
    const mc=E27.modelledCost(costs); if(mc.state!=='complete'){ toast('Cost breakdown is incomplete: '+mc.notes.join(' ')); return; }
    const row={agreement_id:a.id,version_no:(vers[0]?vers[0].version_no:0)+1,costs,annual_direct_cents:Number(E27.roundHalfUp(E27.mul(mc.annual,E27.R(100n)))),approver:CURRENT_EMAIL,evidence:($('cv27_evid').value||'').trim()||null};
    const {data,error}=await sb.from('rmr_cost_versions').insert(row).select(); if(error){toast(error.message);return;}
    P27.costVersions.push((data&&data[0])||row); audit('Cost version approved and locked','Costs',a.agreement_number,null,row,null); toast('Cost version v'+row.version_no+' locked'); renderCosts27(a); };
}
function renderCommHist27(a){
  const box=$('commHist27'); if(!box)return;
  if(!a){ box.innerHTML='<div class="file-hint">No history for an unsaved agreement.</div>'; return; }
  const evs=committedEventsFor(a);
  const legacy=[]; [['Initial','paid_initial','initial_snapshot'],['Initial 1st piece','paid_immediate','immediate_snapshot'],['Deferred / holdback','paid_holdback','holdback_snapshot'],['Accelerator','paid_accel','accel_snapshot'],['Renewal','renewal_paid','renewal_snapshot']].forEach(([l,p,s])=>{ if(a[p]&&a[s]) legacy.push({l,snap:a[s]}); });
  (LEGACY_PAYOUTS||[]).forEach(L=>(L.lines||[]).forEach(ln=>{ if(String(ln.agreement_number)===String(a.agreement_number)) legacy.push({l:`Paid under 2025 plan (Q${L.quarter} ${L.year})`,snap:{amount:ln.bonus,plan_version:L.plan_label,paid_date:`${L.year} Q${L.quarter}`,basis:ln.basis}}); }));
  const evHtml=evs.map(e=>{ const ents=P27.ledger.filter(x=>x.event_uid===e.event_uid); const sum=st=>ents.filter(x=>x.stage===st).reduce((s,x)=>s+Number(x.amount_cents),0);
    const earned=sum('earned')+sum('adjustment'), paid=sum('paid'), qual=sum('qualified');
    return `<details style="border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-bottom:8px"><summary style="cursor:pointer;font-size:12.5px"><b>${esc(e.event_date)}</b> · ${esc(e.event_type.replace('_',' '))} · ${esc(e.snapshot.planLabel||'')} · recipient ${esc((e.snapshot.shares||[]).map(s=>s.email).join(', '))} · total <b>${E27.fmtCents(BigInt(e.total_cents))}</b> · earned ${E27.fmtCents(BigInt(earned))} · conditional ${E27.fmtCents(BigInt(qual-earned<0?0:qual-earned))} · paid ${E27.fmtCents(BigInt(paid))}</summary>
      <div style="font-size:11.5px;margin-top:6px">Basis: ${esc(e.snapshot.eventType)} on eligible MRR ${esc(e.snapshot.eligibleMrr)} · term ${e.snapshot.term} · margin ${esc(e.snapshot.margin||'—')} · cost version v${e.snapshot.costVersion} · formula ${esc(e.formula_version)} · cost mode ${esc(e.cost_mode)}
      <table class="cfg-table" style="margin-top:6px"><thead><tr><th>Entry</th><th>Tranche</th><th>Stage</th><th class="num">Amount</th><th>Earned</th><th>Verified</th><th>By</th></tr></thead><tbody>${ents.map(x=>`<tr><td class="mono" style="font-size:10px">${esc(x.entry_uid.split('|').slice(-2).join(' '))}</td><td>${x.tranche||''}</td><td>${esc(x.stage)}</td><td class="num mono">${E27.fmtCents(BigInt(x.amount_cents))}</td><td>${esc(x.earned_date||'')}</td><td>${esc(String(x.verified_at||'').slice(0,10))}</td><td>${esc(x.actor)}</td></tr>`).join('')}</tbody></table></div></details>`; }).join('');
  box.innerHTML=`<div class="fieldset-h" style="margin-top:2px">Commission history <span class="hint">append-only ledger · expand an event for inputs, evidence and audit</span></div>
    ${evHtml||'<div class="file-hint">No commission events under the versioned engine.</div>'}
    <div class="fieldset-h" style="margin-top:12px">Historical commission (preserved as recorded)</div>
    ${legacy.length?legacy.map(x=>`<div class="file-row"><div class="fr-meta" style="font-size:12px">🔒 ${esc(x.l)} · ${fmt2(+x.snap.amount||0)} · plan ${esc(x.snap.plan_version||'—')} · ${esc(String(x.snap.paid_date||''))}</div></div>`).join(''):'<div class="file-hint">No paid historical commission on this agreement.</div>'}
    ${a.grandfather_rule?`<div class="qctx" style="margin-top:6px">Grandfathered treatment recorded: ${esc(a.grandfather_rule.rule||'')} · ${esc(a.grandfather_rule.reason||'')} · ${esc(a.grandfather_rule.approval||'')}</div>`:''}`;
}

/* ---------------- Vista import panel (VIS-13, VIS-14, VIS-15, Appendix F) ---------------- */
const APPX_F={
  invoices:{path:"Vista > Service Management > Reports > SM Invoice List — Run SM Invoice List. Change Status from its default of Invoiced to all statuses — the default hides voided and credit-settled invoices, which this tool needs. Add Service Site and Work Order as output columns; Vista holds both per invoice but neither is selected by default. Export to Excel. Note: in the export the data rows sit one column to the right of the headers, so Balance is the twelfth field, not the eleventh.",
    when:"Payout-critical. Every payout run, imported before or with the receipts file, because receipts allocate against invoices. Cover from the last data-through date to the verification cutoff.",tip:"Vista > Service Management > Reports > SM Invoice List (all statuses, + Service Site & Work Order)"},
  receipts:{path:"Vista > Accounts Receivable > Reports > AR Customer Receipt History — Run AR Customer Receipt History for the period from the last data-through date to the current verification cutoff. This report requires access that is not granted to every Vista login; if it is denied, request the authorised accounting export instead rather than working around it. This is the only feed that evidences cash collection — a zero balance on an invoice means settled, which is not the same thing.",
    when:"Payout-critical, and the one that gates earning. Every payout run, by the verification cutoff. If it is late, verification and automated release wait; earning dates already established by evidence do not move (VIS-08).",tip:"Vista > Accounts Receivable > Reports > AR Customer Receipt History"},
  agreement_terms:{path:"Vista > Service Management > Reports > SM Agreement List — Run showing all agreements. Supplies effective, activated, cancelled, terminated and expiration dates, revision and previous revision, total term price and status. This is the source for term, price and renewal detection (VIS-02). Do not substitute the aging report, which contains none of this.",
    when:"Not payout-critical. Monthly, and whenever a renewal or revision is expected, so term and price changes are detected before they affect a calculation.",tip:"Vista > Service Management > Reports > SM Agreement List (all agreements)"},
  invoice_attribution:{path:"Vista > Accounts Receivable > Reports > P1 AR Aging by Customer/Contract w SMWO — Run for Company 2. Set Level of Detail to T for transaction and Credit Notes Shown to A for all. The invoice line carries agreement text such as Agmt 37 Service. Important: this is corroborating evidence only, never the primary mapping (VIS-11). It is an aging report, so it shows open items only — it cannot map an invoice that is already settled and it does not contain agreement history.",
    when:"Not payout-critical. On demand, to help resolve mapping exceptions the invoice feed could not match. Never releases a commission.",tip:"Vista > Accounts Receivable > Reports > P1 AR Aging by Customer/Contract w SMWO (Company 2, detail T, credit notes A)"},
  posted_cost:{path:"Vista > Service Management > Reports > SM Work Order Profitability Detail — Run SM Work Order Profitability Detail grouped by cost type and export to Excel. Two traps. Overhead is not a cost type: the report has four line types — Miscellaneous, Labor, Purchase, Inventory — and overhead appears as description text under Miscellaneous, in at least three spellings, beside freight and card fees. And the file interleaves Totals for Line Type and Totals for Work Order rows with the detail rows; these are discarded on import or every figure is counted twice.",
    when:"Not payout-critical and never gates a payout. Run it on the management reporting cycle, monthly or quarterly, to feed the Posted versus Modelled comparison and the review of future cost estimates.",tip:"Vista > Service Management > Reports > SM Work Order Profitability Detail (by cost type)"}
};
const FEED_ORDER=['invoices','receipts','agreement_terms','posted_cost','invoice_attribution'];
let STAGED27=null;
function feedHealth(feed){
  const b=P27.batches.filter(x=>x.feed===feed&&x.status==='committed').sort((x,y)=>y.id-x.id);
  const last=b[0]||null; const through=b.map(x=>x.data_through).filter(Boolean).sort().pop()||null;
  const unresolved=P27.worklist.filter(w=>w.status==='open'&&(w.detail&&w.detail.feed===feed)).length;
  const run=E27.payoutCalendar(P27.settings.payout_calendar); const due=E27.feedDueState(feed,through,run);
  const failed=P27.batches.filter(x=>x.feed===feed&&(x.status==='failed'||x.status==='held')&&(!last||x.id>last.id)).length;
  return {last,through,unresolved,due,run,failed};
}
function renderVistaPanel(){
  const host=$('rcBody'); if(!host)return;
  let el=$('vistaPanel27'); if(!el){ el=document.createElement('div'); el.id='vistaPanel27'; host.insertBefore(el,host.firstChild); }
  if(!P27.ready){ el.innerHTML=`<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>Vista import</h2></div><div class="admin-body" style="font-size:13px">The import panel needs the v2.7 tables. Run <b>migration_v22_spec27.sql</b> in Supabase ▸ SQL Editor, then reload. <span class="qctx">${esc(P27.missing||'')}</span></div></div>`; return; }
  const run=E27.payoutCalendar(P27.settings.payout_calendar); const owners=P27.settings.feed_owners||{};
  const slot=(f)=>{ const F=V27.FEEDS[f], h=feedHealth(f), ap=APPX_F[f], o=owners[f]||{};
    const col={ok:'var(--payable)',overdue:'var(--held)','due soon':'var(--orange)',due:'var(--ink)','not loaded':'var(--muted)'}[h.due.state]||'var(--muted)';
    return `<div style="border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:#fff">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b title="${esc(ap.tip)}" style="cursor:help">${esc(F.label)}</b>
        ${F.critical?badge('Payout-critical','warn'):badge(F.optional_feed?'Optional · corroborating':'Not payout-critical','info')}
        <span style="margin-left:auto;font-size:12px;color:${col};font-weight:700">${esc(h.due.label)}</span></div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">Last successful import: <b>${h.last?esc(String(h.last.created_at).slice(0,16).replace('T',' '))+' · '+esc(h.last.filename||''):'never'}</b> · data through <b>${esc(h.through||'—')}</b> · unresolved <b>${h.unresolved}</b>${h.failed?` · <span style="color:var(--held)">${h.failed} failed/held</span>`:''}<br>Owner ${esc(o.owner||'not named')} · backup ${esc(o.backup||'not named')} · cadence ${esc(o.cadence||'')}</div>
      ${can('verifyEvidence')?`<div style="margin-top:8px"><input type="file" accept=".xlsx,.xls,.csv" data-feed27="${f}" title="${esc(ap.tip)}" style="font-size:12px"></div>`:''}
      <details style="margin-top:6px"><summary style="cursor:pointer;font-size:12px;color:var(--navy)">How do I get this file?</summary><div style="font-size:12px;line-height:1.55;margin-top:6px">${esc(ap.path)}<div style="margin-top:6px"><b>When to run it:</b> ${esc(ap.when)}</div>${F.critical?`<div style="margin-top:4px"><b>Due:</b> data must reach quarter end ${esc(run.quarterEnd)} by the verification cutoff ${esc(run.cutoff)} for the Q${run.q} ${run.y} run (pay by ${esc(run.payBy)}).</div>`:''}</div></details></div>`; };
  el.innerHTML=`<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>Vista import</h2><span class="qctx">one-way · Vista is the system of record · next run Q${run.q} ${run.y}: cutoff ${run.cutoff}, pay by ${run.payBy}</span></div>
    <div class="admin-body"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px">${FEED_ORDER.map(slot).join('')}</div>
    <div id="stage27" style="margin-top:12px"></div>
    <div class="qctx" style="margin-top:8px">Accepts the native .xlsx and .csv exports. A manual upload always shows its result and waits for Confirm. Scheduled file delivery uses the same endpoint (<span class="mono">P1Import.scheduled(feed, file)</span>) and commits automatically only when the whole file validates. A file in the wrong slot is rejected on its column signature.</div></div></div>`;
  el.querySelectorAll('[data-feed27]').forEach(inp=>inp.onchange=async()=>{ const f=inp.files[0]; if(!f)return; await stageFile(inp.dataset.feed27,f,'manual'); inp.value=''; });
  renderStage27();
}
async function readRows(file){
  const buf=await file.arrayBuffer(); const name=file.name.toLowerCase();
  let sha=''; try{ const h=await crypto.subtle.digest('SHA-256',buf); sha=[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join(''); }catch(_){}
  if(name.endsWith('.csv')){ const txt=new TextDecoder().decode(buf); return {rows:parseCSV(txt),sha}; }
  if(typeof XLSX==='undefined')throw new Error('The spreadsheet reader did not load — check the network and reload.');
  const wb=XLSX.read(buf,{type:'array',cellDates:true}); const ws=wb.Sheets[wb.SheetNames[0]];
  return {rows:XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:false}),sha};
}
function parseCSV(t){ const rows=[]; let row=[],cur='',q=false; for(let i=0;i<t.length;i++){ const ch=t[i]; if(q){ if(ch==='"'){ if(t[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; } else if(ch==='"')q=true; else if(ch===','){row.push(cur);cur='';} else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&t[i+1]==='\n')i++; row.push(cur); rows.push(row); row=[]; cur=''; } else cur+=ch; } if(cur!==''||row.length){row.push(cur);rows.push(row);} return rows.map(r=>r.map(v=>v===''?null:v)); }
function agreementMaps(){
  const byWorkOrder={}, bySite={}, byInvoiceNo={};
  AGREEMENTS.forEach(a=>{ const n=String(a.agreement_number||''); if(!n)return;
    String(a.vista_ref||'').split(/[,;\s]+/).filter(Boolean).forEach(w=>byWorkOrder[w]=n);
    if(a.site_number)(bySite[String(a.site_number)]=bySite[String(a.site_number)]||[]).push(n);
    (Array.isArray(a.billing_log)?a.billing_log:[]).forEach(e=>{ if(e.invoice_no)byInvoiceNo[String(e.invoice_no)]=n; }); });
  return {byWorkOrder,bySite,byInvoiceNo};
}
async function stageFile(feed,file,route){
  let parsed, sha='';
  try{ const r=await readRows(file); sha=r.sha; parsed=V27.parse(feed,r.rows); }
  catch(e){ parsed={ok:false,feed,error:'Could not read the file: '+(e.message||e)}; }
  if(!parsed.ok){
    await sb.from('rmr_import_batches').insert({feed,route,filename:file.name,file_sha256:sha,status:'failed',error:parsed.error,created_by:CURRENT_EMAIL});
    if(route==='scheduled') await openWorkItem({item_uid:`import:${feed}:${sha||Date.now()}`,type:'import_exception',record_ref:file.name,title:`${V27.FEEDS[feed].label} import failed: ${parsed.error}`,detail:{feed},owner_email:((P27.settings.feed_owners||{})[feed]||{}).owner||CURRENT_EMAIL});
    STAGED27={feed,file:file.name,error:parsed.error}; await load27(); renderVistaPanel(); return parsed;
  }
  // classify against what is already stored (idempotency, VIS-05) and against agreements (matching, VIS-11)
  const maps=agreementMaps(); let matched=0, unmatched=0, already=0; const unmatchedRows=[];
  const exists={invoices:x=>INV_BY_NO[x.invoice_number],receipts:x=>P27.receipts.find(r=>r.receipt_key===x.receipt_key),agreement_terms:x=>P27.terms.find(t=>t.term_key===x.term_key),
    posted_cost:x=>P27.costs.find(c=>c.line_key===x.line_key),invoice_attribution:x=>null}[feed];
  parsed.rows.forEach(x=>{
    if(exists(x)) already++;
    if(feed==='invoices'){ const m=V27.mapInvoice(x,maps); x.agreement_number=m.agreement; x.map_method=m.method; if(m.agreement)matched++; else { unmatched++; unmatchedRows.push({key:x.invoice_number,why:m.candidate?`description mentions Agmt ${m.candidate} (corroborating only)`:'no work order, site or billing-row invoice match'}); } }
    else if(feed==='receipts'){ const inv=x.invoice_number&&(INV_BY_NO[x.invoice_number]||parsed.rows.find(()=>false)); if(inv&&inv.agreement_number)matched++; else { unmatched++; unmatchedRows.push({key:x.receipt_key,why:inv?'invoice not mapped to an agreement':'invoice not in the invoice feed — import invoices first'}); } }
    else if(feed==='agreement_terms'){ if(AGREEMENTS.some(a=>String(a.agreement_number)===x.agreement_number))matched++; else { unmatched++; unmatchedRows.push({key:x.term_key,why:'agreement not in the tracker'}); } }
    else if(feed==='posted_cost'){ x.bucket=V27.classifyCost(x,P27.rules); const ag=maps.byWorkOrder[x.work_order]; x.agreement_number=ag||null; if(ag)matched++; else unmatched++; if(x.bucket==='unresolved')unmatchedRows.push({key:x.line_key,why:'cost classification unresolved',kind:'cost_classification'}); }
    else if(feed==='invoice_attribution'){ if(x.agreement_number)matched++; else unmatched++; }
  });
  STAGED27={feed,file:file.name,sha,route,parsed,matched,unmatched,already,unmatchedRows};
  if(route==='scheduled'){ if(!parsed.flags.length||feed!=='invoices') return commitStaged(); await sb.from('rmr_import_batches').insert({feed,route,filename:file.name,file_sha256:sha,status:'held',rows_read:parsed.rows.length,param_echo:parsed.paramEcho,param_flags:parsed.flags,created_by:'scheduled'}); return; }
  renderStage27(); return STAGED27;
}
function renderStage27(){
  const box=$('stage27'); if(!box)return; const s=STAGED27; if(!s){ box.innerHTML=''; return; }
  if(s.error){ box.innerHTML=`<div style="background:#fbeaea;border:1px solid #f3c0c0;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#9a2a2a"><b>${esc(V27.FEEDS[s.feed].label)} — ${esc(s.file)}: nothing was imported.</b><br>${esc(s.error)} <button class="iconbtn" id="st27x" style="margin-left:8px">Dismiss</button></div>`; $('st27x').onclick=()=>{STAGED27=null;renderStage27();}; return; }
  const p=s.parsed;
  box.innerHTML=`<div style="border:2px solid var(--navy);border-radius:10px;padding:12px 14px;font-size:12.5px;background:#f7f9fc"><b>${esc(V27.FEEDS[s.feed].label)} — ${esc(s.file)}</b> · result summary (nothing is written until you confirm)
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:8px 0"><div>Rows read<br><b>${p.rows.length+p.duplicates}</b></div><div>Matched<br><b>${s.matched}</b></div><div>Unmatched<br><b>${s.unmatched}</b></div><div>Duplicates ignored<br><b>${p.duplicates} in file · ${s.already} already stored</b></div><div>Data-through<br><b>${esc(p.dataThrough||'—')}</b></div>${p.statusCounts?`<div>Statuses<br><b>${Object.entries(p.statusCounts).map(([k,v])=>esc(k)+' '+v).join(' · ')}</b></div>`:''}${p.offset?'<div>Column offset<br><b>data rows shifted +1 (handled)</b></div>':''}</div>
    ${p.flags.length?`<div style="background:#fff4e8;border:1px solid #f3d4ad;border-radius:8px;padding:8px 10px;color:#8a5a17;margin-bottom:8px"><b>Flagged:</b><br>${p.flags.map(esc).join('<br>')}</div>`:''}
    <details><summary style="cursor:pointer">Parameter echo (recorded with the batch)</summary><pre style="white-space:pre-wrap;font-size:11px">${esc(p.paramEcho||'(none)')}</pre></details>
    ${s.unmatchedRows.length?`<details><summary style="cursor:pointer">Unmatched / exceptions (${s.unmatchedRows.length}) — go to the Worklist on confirm</summary><div style="max-height:160px;overflow:auto;font-size:11px">${s.unmatchedRows.slice(0,300).map(u=>esc(u.key)+' — '+esc(u.why)).join('<br>')}</div></details>`:''}
    <div style="margin-top:10px;display:flex;gap:8px"><button class="btn-primary" id="st27ok">Confirm import</button><button class="iconbtn" id="st27no">Cancel</button></div></div>`;
  $('st27ok').onclick=async()=>{ $('st27ok').disabled=true; await commitStaged(); };
  $('st27no').onclick=async()=>{ await sb.from('rmr_import_batches').insert({feed:s.feed,route:'manual',filename:s.file,file_sha256:s.sha,status:'cancelled',rows_read:p.rows.length,created_by:CURRENT_EMAIL}); STAGED27=null; renderStage27(); };
}
async function commitStaged(){
  const s=STAGED27; if(!s||!s.parsed)return; const p=s.parsed;
  const {data:bd,error:be}=await sb.from('rmr_import_batches').insert({feed:s.feed,route:s.route,filename:s.file,file_sha256:s.sha,status:'committed',rows_read:p.rows.length+p.duplicates,matched:s.matched,unmatched:s.unmatched,duplicates:p.duplicates+s.already,data_through:p.dataThrough,param_echo:p.paramEcho,param_flags:p.flags,created_by:CURRENT_EMAIL}).select();
  if(be){ toast(be.message); return; }
  const batch=bd[0].id;
  const chunks=(arr,n)=>{const o=[];for(let i=0;i<arr.length;i+=n)o.push(arr.slice(i,i+n));return o;};
  let error=null;
  if(s.feed==='invoices'){ const rows=p.rows.map(x=>({invoice_number:x.invoice_number,status:x.status,customer:x.customer!=null?String(x.customer):null,invoice_date:x.invoice_date,post_month:x.post_month,due_date:x.due_date,amount:x.amount,tax:x.tax,total:x.total,balance:x.balance,service_site:x.service_site,work_order:x.work_order,description:x.description!=null?String(x.description):null,agreement_number:x.agreement_number,map_method:x.map_method,first_batch_id:(INV_BY_NO[x.invoice_number]||{}).first_batch_id||batch,last_batch_id:batch,raw:null,updated_at:new Date().toISOString()}));
    for(const c of chunks(rows,500)){ const r=await sb.from('rmr_vista_invoices').upsert(c,{onConflict:'invoice_number'}); if(r.error){error=r.error;break;} } }
  if(s.feed==='receipts'){ const rows=p.rows.map(x=>({receipt_key:x.receipt_key,receipt_id:x.receipt_id,invoice_number:x.invoice_number,customer:x.customer!=null?String(x.customer):null,amount:x.amount,receipt_date:x.receipt_date,batch_id:batch}));
    for(const c of chunks(rows,500)){ const r=await sb.from('rmr_vista_receipts').upsert(c,{onConflict:'receipt_key',ignoreDuplicates:true}); if(r.error){error=r.error;break;} } }
  if(s.feed==='agreement_terms'){ const rows=p.rows.map(x=>({term_key:x.term_key,agreement_number:x.agreement_number,revision:x.revision,previous_revision:x.previous_revision,status:x.status!=null?String(x.status):null,effective_date:x.effective_date,activated_date:x.activated_date,cancelled_date:x.cancelled_date,terminated_date:x.terminated_date,expiration_date:x.expiration_date,term_price:x.term_price,customer:x.customer!=null?String(x.customer):null,batch_id:batch}));
    for(const c of chunks(rows,500)){ const r=await sb.from('rmr_vista_agreement_terms').upsert(c,{onConflict:'term_key'}); if(r.error){error=r.error;break;} } }
  if(s.feed==='posted_cost'){ const rows=p.rows.map(x=>({line_key:x.line_key,work_order:x.work_order,agreement_number:x.agreement_number,line_type:x.line_type,description:x.description!=null?String(x.description):null,post_date:x.post_date,amount:x.amount,bucket:x.bucket,batch_id:batch}));
    for(const c of chunks(rows,500)){ const r=await sb.from('rmr_vista_costs').upsert(c,{onConflict:'line_key',ignoreDuplicates:true}); if(r.error){error=r.error;break;} } }
  if(s.feed==='invoice_attribution'){ /* corroborating only: backfill candidate mappings into the Worklist; never a primary key, never writes agreement_number */ }
  if(error){ toast('Import stopped: '+error.message); return; }
  // exceptions → Worklist; previously open items resolved by this batch close with the batch as basis (NAV-03)
  const owner=((P27.settings.feed_owners||{})[s.feed]||{}).owner||CURRENT_EMAIL;
  const items=s.unmatchedRows.map(u=>({item_uid:`${u.kind||'unmatched'}:${s.feed}:${u.key}`,type:u.kind||'unmatched_vista',record_ref:u.key,title:`${V27.FEEDS[s.feed].label}: ${u.key} — ${u.why}`,detail:{feed:s.feed,batch},owner_email:owner,due_date:E27.payoutCalendar(P27.settings.payout_calendar).cutoff}));
  for(const c of chunks(items,500)) await sb.from('rmr_worklist').upsert(c,{onConflict:'item_uid',ignoreDuplicates:true});
  const stillOpen=new Set(items.map(i=>i.item_uid));
  const toClose=P27.worklist.filter(w=>w.status==='open'&&w.detail&&w.detail.feed===s.feed&&!stillOpen.has(w.item_uid)&&String(w.item_uid).startsWith('unmatched:'+s.feed+':')&&p.rows.some(x=>(x.invoice_number||x.receipt_key||x.term_key)===w.record_ref));
  for(const w of toClose){ await sb.from('rmr_worklist').update({status:'closed',closed_by:CURRENT_EMAIL,closed_at:new Date().toISOString(),close_basis:`Resolved by import batch #${batch}`}).eq('id',w.id); }
  audit('Vista import committed','Import',String(batch),null,{feed:s.feed,file:s.file,rows:p.rows.length,matched:s.matched,unmatched:s.unmatched,dataThrough:p.dataThrough,flags:p.flags},null);
  toast(`Imported ${p.rows.length} ${V27.FEEDS[s.feed].label.toLowerCase()} rows · batch #${batch}`);
  STAGED27=null; await load27(); render();
}
window.P1Import={ scheduled:(feed,file)=>stageFile(feed,file,'scheduled'), manual:(feed,file)=>stageFile(feed,file,'manual') };

/* ---------------- Worklist (NAV-01..03) ---------------- */
let WL_FILTER={owner:'__me',type:'all',age:'all',status:'open'};
const WL_TYPES={unmatched_vista:['Unmatched Vista record','VIS-06','recon'],import_exception:['Import exception / parse failure','VIS-15','recon'],cost_classification:['Unresolved cost classification','CST-05','recon'],
  cost_variance:['Posted vs Modelled variance','CST-07','agreements'],cost_unverified:['Cost basis unverified','CST-13','agreements'],recipient_unresolved:['Historical recipient unresolved','TEC-07','agreements'],
  migration_exception:['Migration reconciliation exception','MIG-09','agreements'],overdue_feed:['Overdue payout-critical feed','VIS-12','recon'],plan_ack_missing:['Plan acknowledgement missing','COM-07','admin'],
  deal_won:['Deal won — set up the agreement','','opportunities'],sale_unrecorded:['Sale not recorded yet','','agreements']};
async function openWorkItem(it){ try{ await sb.from('rmr_worklist').upsert(it,{onConflict:'item_uid',ignoreDuplicates:true}); }catch(_){} }
async function syncDerivedItems(){
  if(!P27.ready||!can('verifyEvidence'))return;
  const run=E27.payoutCalendar(P27.settings.payout_calendar); const want=[];
  ['invoices','receipts'].forEach(f=>{ const h=feedHealth(f); if(h.due.state==='overdue') want.push({item_uid:`overdue:${f}:${run.y}Q${run.q}`,type:'overdue_feed',record_ref:f,title:`${V27.FEEDS[f].label} feed is overdue for the Q${run.q} ${run.y} payout run`,detail:{feed:f,cutoff:run.cutoff},owner_email:((P27.settings.feed_owners||{})[f]||{}).owner||'sean.bithell@point1.com',due_date:run.cutoff}); });
  AGREEMENTS.filter(a=>isLiveAgreement(a)&&!isEnded(a)).forEach(a=>{ const mc=E27.modelledCost(a); if(mc.state==='legacy_only') want.push({item_uid:`costunv:${a.id}`,type:'cost_unverified',record_ref:a.agreement_number,title:`#${a.agreement_number} ${a.customer_name||''}: Cost basis unverified — enter an itemised breakdown`,detail:{agreement_id:a.id},owner_email:a.cost_owner_email||a.owner_email,due_date:a.cost_deadline||E27.addDays(E27.businessToday(),30)}); });
  P27.assignments.forEach(x=>{ const v=versionById(x.plan_version_id); if(v&&v.status==='published'&&!P27.acks.some(k=>String(k.email).toLowerCase()===String(x.email).toLowerCase()&&String(k.plan_version_id)===String(v.id))) want.push({item_uid:`ack:${x.email}:${v.id}`,type:'plan_ack_missing',record_ref:x.email,title:`${x.email} has not acknowledged ${v.label} — no transaction calculates under it until they do`,detail:{plan_version_id:v.id},owner_email:x.email,due_date:v.effective_date}); });
  const setupOwner=(((P27.settings.feed_owners||{}).agreement_terms||{}).owner)||ADMIN_EMAILS[0];
  AGREEMENTS.filter(a=>isLiveAgreement(a)&&!isEnded(a)&&!a.history_only&&isRevisedTransaction(a)&&a.activation_date&&+a.monthly_rmr>0&&!committedEventsFor(a).length).forEach(a=>want.push({item_uid:`sale:${a.id}`,type:'sale_unrecorded',record_ref:a.agreement_number,title:`#${a.agreement_number} ${a.customer_name||''}: agreement saved but the sale isn't recorded — no commission until it is`,detail:{owner:a.owner_email},owner_email:setupOwner,due_date:E27.addDays(E27.businessToday(),7)}));
  const have=new Set(P27.worklist.map(w=>w.item_uid)); const add=want.filter(w=>!have.has(w.item_uid));
  if(add.length){ await sb.from('rmr_worklist').upsert(add,{onConflict:'item_uid',ignoreDuplicates:true}); }
  // derived conditions that no longer hold are closed with that as the recorded basis (never silently)
  const wantSet=new Set(want.map(w=>w.item_uid));
  for(const w of P27.worklist.filter(w=>w.status==='open'&&/^won:/.test(w.item_uid))){ const o=AGREEMENTS.find(x=>String(x.id)===String(w.record_ref)); if(o&&(isLiveAgreement(o)||o.stage==='lost')){ await sb.from('rmr_worklist').update({status:'closed',closed_by:'system',closed_at:new Date().toISOString(),close_basis:o.stage==='lost'?'Opportunity marked lost':'Agreement set up from the opportunity'}).eq('id',w.id); } }
  for(const w of P27.worklist.filter(w=>w.status==='open'&&/^(overdue|costunv|ack|sale):/.test(w.item_uid)&&!wantSet.has(w.item_uid))){
    await sb.from('rmr_worklist').update({status:'closed',closed_by:'system',closed_at:new Date().toISOString(),close_basis:'Underlying condition resolved (feed current / breakdown entered / acknowledgement stored / sale recorded)'}).eq('id',w.id); }
  if(add.length||P27.worklist.some(w=>w.status==='open'&&(/^won:/.test(w.item_uid)||/^(overdue|costunv|ack|sale):/.test(w.item_uid)&&!wantSet.has(w.item_uid)))){ P27.worklist=await fetchAll('rmr_worklist','id'); }
}
async function renderWorklist(){
  const box=$('wlBody'); if(!box)return;
  if(!P27.ready){ box.innerHTML=`<div class="panel"><div class="admin-body">Run <b>migration_v22_spec27.sql</b> to enable the Worklist.</div></div>`; return; }
  await syncDerivedItems();
  const me=(CURRENT_EMAIL||'').toLowerCase(); const today=E27.businessToday();
  const visible=P27.worklist.filter(w=>canViewAll()||String(w.owner_email||'').toLowerCase()===me);
  const owners=[...new Set(visible.map(w=>String(w.owner_email||'(none)').toLowerCase()))].sort();
  let L=visible.filter(w=>WL_FILTER.status==='all'||w.status===WL_FILTER.status);
  if(WL_FILTER.owner==='__me')L=L.filter(w=>String(w.owner_email||'').toLowerCase()===me); else if(WL_FILTER.owner!=='__all')L=L.filter(w=>String(w.owner_email||'(none)').toLowerCase()===WL_FILTER.owner);
  if(WL_FILTER.type!=='all')L=L.filter(w=>w.type===WL_FILTER.type);
  const age=w=>Math.max(0,E27.daysBetween(String(w.created_at).slice(0,10),today));
  if(WL_FILTER.age!=='all'){ const n=+WL_FILTER.age; L=L.filter(w=>age(w)>=n); }
  L.sort((x,y)=>String(x.due_date||'9999').localeCompare(String(y.due_date||'9999'))||age(y)-age(x));
  const sel=(id,opts,val)=>`<select id="${id}" class="cfg-in" style="font-size:12px">${opts.map(([v,l])=>`<option value="${esc(v)}" ${v===val?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  const byType={}; visible.filter(w=>w.status==='open').forEach(w=>byType[w.type]=(byType[w.type]||0)+1);
  const _cards=Object.entries(WL_TYPES).filter(([k])=>byType[k]);
  box.innerHTML=`<div class="cards" style="margin-bottom:12px">${_cards.length?'':'<div class="stat green"><div class="lbl">Open items</div><div class="val">0</div><div class="qctx">Nothing needs anyone right now.</div></div>'}${_cards.map(([k,[l,req]])=>`<div class="stat ${byType[k]?'orange':''}" style="cursor:pointer" data-wltype="${k}"><div class="lbl">${esc(l)} <span class="qctx">${req}</span></div><div class="val">${byType[k]||0}</div></div>`).join('')}</div>
   <div class="panel"><div class="panel-head" style="gap:8px;flex-wrap:wrap"><h2>Worklist</h2>
     ${sel('wlOwner',[['__me','Mine'],['__all','All owners'],...owners.map(o=>[o,o])],WL_FILTER.owner)}
     ${sel('wlType',[['all','All types'],...Object.entries(WL_TYPES).map(([k,v])=>[k,v[0]])],WL_FILTER.type)}
     ${sel('wlAge',[['all','Any age'],['7','7+ days'],['30','30+ days'],['90','90+ days']],WL_FILTER.age)}
     ${sel('wlStatus',[['open','Open'],['closed','Closed'],['all','All']],WL_FILTER.status)}<span class="qctx">${L.length} item${L.length===1?'':'s'}</span></div>
   ${L.length?`<table><thead><tr><th>Type</th><th>Item</th><th>Owner</th><th class="num">Age</th><th>Due</th><th>Resolve in</th><th></th></tr></thead><tbody>${L.slice(0,500).map(w=>{ const T=WL_TYPES[w.type]||[w.type,'',''];
      const overdue=w.status==='open'&&w.due_date&&w.due_date<today;
      return `<tr><td><span class="chip" style="font-size:9px">${esc(T[0])}</span><div class="qctx">${esc(T[1])}</div></td><td style="white-space:normal;font-size:12.5px">${esc(w.title)}${w.status==='closed'?`<div class="qctx">Closed by ${esc(w.closed_by||'')} ${esc(String(w.closed_at||'').slice(0,10))} — ${esc(w.close_basis||'')}</div>`:''}</td><td>${esc(w.owner_email||'—')}</td><td class="num">${age(w)}d</td><td style="color:${overdue?'var(--held)':'inherit'}">${esc(w.due_date||'—')}</td>
       <td><button class="iconbtn" data-wlgo="${esc(T[2])}" data-wltype2="${esc(w.type)}" data-wlref="${esc(w.record_ref||'')}">${w.type==='deal_won'?'Set up deal':w.type==='sale_unrecorded'?'Record sale':'Open '+esc(T[2])}</button></td><td>${w.status==='open'?`<button class="iconbtn" data-wlclose="${w.id}">Close…</button>`:''}</td></tr>`; }).join('')}</tbody></table>`:'<div class="empty">Nothing in this view.</div>'}</div>`;
  [['wlOwner','owner'],['wlType','type'],['wlAge','age'],['wlStatus','status']].forEach(([id,k])=>$(id).onchange=function(){ WL_FILTER[k]=this.value; renderWorklist(); });
  box.querySelectorAll('[data-wltype]').forEach(c=>c.onclick=()=>{ WL_FILTER.type=c.dataset.wltype; WL_FILTER.owner='__all'; renderWorklist(); });
  box.querySelectorAll('[data-wlgo]').forEach(b=>b.onclick=()=>{ const v=b.dataset.wlgo; switchView(v); if(b.dataset.wltype2==='deal_won'&&can('editAgreements')){ openCloseDeal27(b.dataset.wlref); return; } if(v==='agreements'){ const a=AGREEMENTS.find(x=>String(x.agreement_number)===b.dataset.wlref); if(a&&can('editAgreements'))openModal(a.id); } });
  box.querySelectorAll('[data-wlclose]').forEach(b=>b.onclick=()=>{ const tr=b.closest('td'); tr.innerHTML=`<input class="cfg-in" placeholder="Basis for closing (required)" style="width:200px" id="wlb${b.dataset.wlclose}"> <button class="iconbtn" id="wlc${b.dataset.wlclose}">Close</button>`;
    $('wlc'+b.dataset.wlclose).onclick=async()=>{ const basis=($('wlb'+b.dataset.wlclose).value||'').trim(); if(!basis){toast('State the basis for closing');return;}
      const {error}=await sb.from('rmr_worklist').update({status:'closed',closed_by:CURRENT_EMAIL,closed_at:new Date().toISOString(),close_basis:basis}).eq('id',b.dataset.wlclose); if(error){toast(error.message);return;}
      audit('Worklist item closed','Worklist',b.dataset.wlclose,null,{basis},basis); P27.worklist=await fetchAll('rmr_worklist','id'); updateWlBadge(); renderWorklist(); }; });
  updateWlBadge();
}
function updateWlBadge(){ const b=$('wlBadge'); if(!b)return; const me=(CURRENT_EMAIL||'').toLowerCase(); const n=P27.worklist.filter(w=>w.status==='open'&&String(w.owner_email||'').toLowerCase()===me).length; b.style.display=n?'inline-block':'none'; b.textContent=n; }

/* ---------------- Payout run (NAV-04) ---------------- */
function legacyLineReadiness(a,type){
  const inv=agreementInvoices(a).filter(i=>i.status!=='Scheduled'&&i.status!=='Voided'&&i.total>0);
  if(!inv.length)return {verified:false,reason:'Awaiting Vista record — no issued invoice to verify.'};
  if(type==='holdback'){ const c=compute(a); const through=c.holdbackReleaseDate?E27.isoDate(c.holdbackReleaseDate):E27.businessToday(); const due=inv.filter(i=>i.date<=through); const bad=due.filter(i=>!(i.collected&&i.collected.state==='Confirmed')&&i.status!=='Settled by credit');
    return bad.length?{verified:false,reason:`Missing receipt evidence: ${bad.length} invoice(s) through ${through}.`}:{verified:true}; }
  const first=inv[0]; return (first.collected&&first.collected.state==='Confirmed')?{verified:true}:{verified:false,reason:`Missing receipt evidence for first invoice ${first.number||first.date}.`};
}
function payoutItems(run){
  const qi=qIndexFromYM(run.y,(run.q-1)*3); const items=[];
  scopedAgreements().forEach(a=>{ const c=compute(a);
    if(c.revised){ if(!c.revisedCalc||!c.tranches)return; const k=c.revisedCalc;
      [[1,c.tranches.t1,k.tranche1Cents],[2,c.tranches.t2,k.tranche2Cents]].forEach(([n,t,amt])=>{ if(!amt)return; const paid=P27.ledger.some(x=>x.stage==='paid'&&x.tranche===n&&x.event_uid&&String(x.event_uid).startsWith(a.id+'|'));
        const earned=t.state==='Earned', inQ=earned&&t.earnedDate<=run.quarterEnd;
        const cl=paid?{state:'Excluded from this run',reason:'Already paid.'}:(!k.fromLedger?{state:'Excluded from this run',reason:'No committed commission event — Expected commission only.'}:(!earned?{state:'Excluded from this run',reason:t.conditions.join(' ')}:(!inQ?{state:'Excluded from this run',reason:'Earned after quarter end — next run.'}:{state:'Ready to pay',reason:`Earned ${t.earnedDate} on verified evidence.`})));
        items.push({a,label:`Tranche ${n}`,amount:Number(amt)/100,cents:amt,tranche:n,revised:true,...cl}); }); return; }
    const pieces=[]; if(c.legacyFull){ if(c.initialQI===qi)pieces.push(['initial','paid_initial',frozenAmount(a,'initial').amount]); }
    else { if(c.initialQI===qi)pieces.push(['immediate','paid_immediate',frozenAmount(a,'immediate').amount]); if(c.holdbackQI===qi)pieces.push(['holdback','paid_holdback',frozenAmount(a,'holdback').amount]); }
    pieces.forEach(([type,flag,amt])=>{ if(!(amt>0))return; if(a[flag]){ items.push({a,label:type,amount:amt,state:'Excluded from this run',reason:'Already paid.'}); return; }
      const r=legacyLineReadiness(a,type); items.push({a,label:type+' (historical plan)',amount:amt,state:r.verified?'Ready to pay':'Pending verification',reason:r.verified?'Collection verified.':r.reason}); });
  });
  return items;
}
function renderPayoutRun(){
  const host=$('view-quarter'); if(!host||!P27.ready)return;
  let el=$('payoutRun27'); if(!el){ el=document.createElement('div'); el.id='payoutRun27'; el.className='panel'; el.style.marginBottom='8px'; host.insertBefore(el,host.firstChild);
    const lab=document.createElement('div'); lab.id='qByQuarter27'; lab.style.cssText='font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:18px 0 8px'; lab.textContent='Commission by quarter'; el.after(lab); }
  const run=E27.payoutCalendar(P27.settings.payout_calendar); const items=payoutItems(run);
  const groups={'Ready to pay':[],'Pending verification':[],'Excluded from this run':[]}; items.forEach(i=>groups[i.state].push(i));
  const tot=g=>groups[g].reduce((s,i)=>s+i.amount,0);
  const fh=['invoices','receipts'].map(f=>{ const h=feedHealth(f); return `${V27.FEEDS[f].label}: <b style="color:${h.due.state==='ok'?'var(--payable)':(h.due.state==='overdue'?'var(--held)':'var(--orange)')}">${esc(h.due.label)}</b> (data through ${esc(h.through||'—')})`; }).join(' · ');
  const openItems=P27.worklist.filter(w=>w.status==='open'&&['overdue_feed','unmatched_vista','migration_exception'].includes(w.type)).length;
  const done=P27.payoutRuns.find(r=>r.year===run.y&&r.quarter===run.q);
  const tbl=g=>groups[g].length?`<table style="font-size:12.5px"><thead><tr><th>Agr #</th><th>Customer</th><th>Piece</th><th class="num">Amount</th><th>Reason</th></tr></thead><tbody>${groups[g].map(i=>`<tr><td>#${esc(i.a.agreement_number||'')}</td><td>${esc(i.a.customer_name||'')}</td><td>${esc(i.label)}</td><td class="num mono">${fmt2(i.amount)}</td><td style="white-space:normal;font-size:11.5px">${esc(i.reason)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty" style="padding:10px">None.</div>';
  if(!can('approvePayout')){ const mine=g=>groups[g].reduce((s,i)=>s+i.amount,0);
    el.innerHTML=`<div class="panel-head"><h2>Next commission payment — Q${run.q} ${run.y}</h2><span class="qctx">paid by ${run.payBy}</span></div><div class="admin-body" style="font-size:13px;line-height:1.6">
      <b style="color:var(--payable)">${fmt2(mine('Ready to pay'))}</b> ready to pay · <b style="color:var(--orange)">${fmt2(mine('Pending verification'))}</b> waiting on a customer payment to be verified by ${run.cutoff}. Anything not verified by then moves to the next quarter's payment.</div>`; return; }
  el.innerHTML=`<div class="panel-head"><h2>Payout run for Q${run.q} ${run.y} commissions</h2><span class="qctx">quarter end ${run.quarterEnd} · verification cutoff ${run.cutoff} · pay by ${run.payBy}${done?` · <b style="color:var(--payable)">approved ${esc(String(done.approved_at).slice(0,10))} by ${esc(done.approved_by)}</b>`:''}</span></div>
   <div class="admin-body" style="font-size:12.5px"><div>${fh} · open Worklist items bearing on this run: <b>${openItems}</b> <span class="qctx">(blocking is per amount, never per run)</span></div>
   <div class="cards" style="margin:10px 0"><div class="stat green"><div class="lbl">Ready to pay</div><div class="val">${fmt2(tot('Ready to pay'))}</div><div class="qctx">${groups['Ready to pay'].length} amounts</div></div><div class="stat orange"><div class="lbl">Pending verification</div><div class="val">${fmt2(tot('Pending verification'))}</div><div class="qctx">${groups['Pending verification'].length} amounts</div></div><div class="stat"><div class="lbl">Excluded from this run</div><div class="val">${groups['Excluded from this run'].length}</div><div class="qctx">with reasons</div></div></div>
   <details open><summary style="cursor:pointer;font-weight:700">Ready to pay (${groups['Ready to pay'].length})</summary>${tbl('Ready to pay')}</details>
   <details><summary style="cursor:pointer;font-weight:700">Pending verification (${groups['Pending verification'].length})</summary>${tbl('Pending verification')}</details>
   <details><summary style="cursor:pointer;font-weight:700">Excluded from this run (${groups['Excluded from this run'].length})</summary>${tbl('Excluded from this run')}</details>
   ${can('approvePayout')&&!done?`<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn-primary" id="pr27approve" ${groups['Ready to pay'].length?'':'disabled'}>Approve &amp; export ready set (${fmt2(tot('Ready to pay'))})</button><span class="qctx">Exports a payroll CSV and records the excluded amounts and reasons. Pending amounts can use the documented override (approval, reason, evidence) on the agreement's Billing tab.</span></div>`:''}</div>`;
  if($('pr27approve')) $('pr27approve').onclick=()=>approveRun(run,groups);
}
async function approveRun(run,groups){
  const ready=groups['Ready to pay']; const cents=ready.reduce((s,i)=>s+Math.round(i.amount*100),0);
  const csv=['Agreement,Customer,Owner,Piece,Amount,State,Reason'].concat(ready.concat(groups['Pending verification'],groups['Excluded from this run']).map(i=>[i.a.agreement_number,i.a.customer_name,i.a.owner_email,i.label,i.amount.toFixed(2),i.state,i.reason].map(v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`).join(','))).join('\n');
  const excluded=groups['Pending verification'].concat(groups['Excluded from this run']).map(i=>({agreement:i.a.agreement_number,piece:i.label,amount:i.amount,state:i.state,reason:i.reason}));
  const {data,error}=await sb.from('rmr_payout_runs').insert({year:run.y,quarter:run.q,approved_by:CURRENT_EMAIL,ready_cents:cents,excluded,export_file:`payout-Q${run.q}-${run.y}.csv`}).select();
  if(error){ toast(/duplicate|unique/i.test(error.message)?'This quarter was already approved.':error.message); return; }
  const runId=data[0].id; const entries=[];
  ready.filter(i=>i.revised).forEach(i=>{ const ev=committedEventsFor(i.a).slice(-1)[0]; if(!ev)return; const t=compute(i.a).tranches; const tt=t&&(i.tranche===1?t.t1:t.t2);
    (ev.snapshot.shares||[]).forEach(s=>entries.push({entry_uid:`${ev.event_uid}|T${i.tranche}|earned|${s.email}`,event_uid:ev.event_uid,tranche:i.tranche,stage:'earned',recipient_email:s.email,amount_cents:Number(i.tranche===1?s.t1Cents:s.t2Cents),earned_date:tt?tt.earnedDate:null,verified_at:new Date().toISOString(),evidence:{conditions:'met',basis:tt&&tt.dateBasis||null},actor:CURRENT_EMAIL}));
    (ev.snapshot.shares||[]).forEach(s=>entries.push({entry_uid:`${ev.event_uid}|T${i.tranche}|payable|${s.email}`,event_uid:ev.event_uid,tranche:i.tranche,stage:'payable',recipient_email:s.email,amount_cents:Number(i.tranche===1?s.t1Cents:s.t2Cents),payout_run_id:runId,actor:CURRENT_EMAIL})); });
  if(entries.length) await sb.from('rmr_ledger_entries').upsert(entries,{onConflict:'entry_uid',ignoreDuplicates:true});
  const blob=new Blob([csv],{type:'text/csv'}); const u=URL.createObjectURL(blob); const l=document.createElement('a'); l.href=u; l.download=`payout-Q${run.q}-${run.y}.csv`; l.click(); URL.revokeObjectURL(u);
  audit('Payout run approved','Payout',`Q${run.q} ${run.y}`,null,{ready:cents/100,excluded:excluded.length},null);
  await load27(); render(); toast('Payout run approved — payroll file exported');
}

/* ---------------- Acknowledgement (COM-07) ---------------- */
function termsText(v){
  const c=v.config||{}; const m=c.newMult||{}; const sl=c.slaNewMult||{};
  return `${v.label} — written commission terms (effective ${v.effective_date||'on publication'})\n\n`+
  `Commission = eligible MRR × term multiple × margin gate. New sale or expansion: 12 mo ${m[12]}×, 24 mo ${m[24]}×, 36 mo ${m[36]}×, 48 mo ${m[48]}×, 60 mo ${m[60]}× (terms above 60 months are capped at ${c.newMultCapAbove60||m[60]}×). Manual renewal: ${c.renewalMult}× retained MRR; any increase at renewal pays the new-sale multiple on the increase only. Auto-renewals, contractual escalations and term conversions pay nothing.\n`+
  `SLA agreements: annual recurring value ÷ 12, then 12 mo ${sl[12]}×, 24 mo ${sl[24]}×, 36 mo ${sl[36]}×, 48 mo ${sl[48]}×, 60 mo ${sl[60]}×; SLA renewal ${c.slaRenewalMult}× retained.\n`+
  `Margin: gross margin on modelled direct cost over the committed term must be at least ${Math.round((+c.minMargin||0)*100)}% (multiplier 1.0); below it pays 0; unknown margin cannot qualify.\n`+
  `Earning: ${Math.round((+c.tranche1Pct||0)*100)}% is earned when the signed agreement is activated and its first valid nonzero invoice is fully collected; ${Math.round((+c.tranche2Pct||0)*100)}% is earned three calendar months after first actual billing with the account active and every invoice due through that date paid. Earned amounts are paid quarterly within ${(P27.settings.payout_calendar||{}).payWithinDays||30} days of quarter end; collections must be verified within ${(P27.settings.payout_calendar||{}).verifyWithinDays||15} days of quarter end. A transaction signed before this version's effective date keeps its historical plan for both tranches.\n`+
  `Portfolio bonus: highest satisfied tier each of GRR (${(c.grrBonus||[]).map(t=>`${Math.round(t.min*1000)/10}%→${Math.round(t.pct*1000)/10}%`).join(', ')}) and NRR (${(c.nrrBonus||[]).map(t=>`${Math.round(t.min*1000)/10}%→${Math.round(t.pct*1000)/10}%`).join(', ')}) of base salary accrued over the calendar year, paid by February 15.\n`+
  `Cancellation before earning stops the unearned tranche. Refunds, credits, cancellation after earning and separation require a documented adjustment decision; nothing is deducted from salary or clawed back automatically. Approved by ${v.approved_by||'—'}.`;
}
function checkAcknowledgement(){
  if(!P27.ready)return; const me=(CURRENT_EMAIL||'').toLowerCase(); const today=E27.businessToday();
  const asg=P27.assignments.filter(x=>String(x.email).toLowerCase()===me&&(!x.effective_to||today<x.effective_to));
  const need=asg.map(x=>versionById(x.plan_version_id)).filter(v=>v&&v.status==='published'&&!P27.acks.some(k=>String(k.email).toLowerCase()===me&&String(k.plan_version_id)===String(v.id)));
  if(!need.length)return; const v=need[0]; const text=termsText(v);
  let sc=$('ackScrim27'); if(sc)sc.remove(); sc=document.createElement('div'); sc.id='ackScrim27'; sc.className='scrim show';
  sc.innerHTML=`<div class="modal" style="max-width:720px"><div class="modal-head"><h3>Acknowledge your commission plan</h3></div><div class="modal-body"><div style="font-size:12.5px;color:var(--muted);margin-bottom:8px">California Labor Code §2751 requires the method of computing and paying commissions in writing, with a signed receipt. No transaction is calculated under this version until you acknowledge it. The exact text below is stored with a timestamp.</div><pre id="ackText27" style="white-space:pre-wrap;font-size:12.5px;background:#f7f9fc;border:1px solid var(--line);border-radius:8px;padding:12px;max-height:50vh;overflow:auto">${esc(text)}</pre></div>
   <div class="modal-foot"><button class="btn-ghost" id="ack27later">Later</button><div style="margin-left:auto"><button class="btn-primary" id="ack27ok">I have read and acknowledge these terms</button></div></div></div>`;
  document.body.appendChild(sc);
  $('ack27later').onclick=()=>sc.remove();
  $('ack27ok').onclick=async()=>{ const {error}=await sb.from('rmr_plan_acknowledgements').insert({email:me,plan_version_id:v.id,text_shown:text,user_agent:navigator.userAgent.slice(0,300)}); if(error){toast(error.message);return;}
    audit('Plan acknowledged','Admin',me,null,{plan:v.label},null); sc.remove(); await load27(); render(); toast('Acknowledgement stored'); };
}

/* ---------------- Admin (ADM-01..07, NAV-05, CAT-07) ---------------- */
let ADM_FAMILY='Hybrid', ADM_PREVIEW=null, ADM_SHOW_HIST=false;
function latestVersion(f){ const vs=P27.versions.filter(v=>v.family===f).sort((a,b)=>b.version_no-a.version_no); return vs.find(v=>v.status==='draft')||vs.find(v=>v.status==='published')||vs[0]||null; }
function famStatus(f){ const vs=P27.versions.filter(v=>v.family===f); const pub=vs.find(v=>v.status==='published'); const dr=vs.find(v=>v.status==='draft');
  if(dr&&dr.config&&dr.config.placeholder&&!pub)return {txt:'Not configured',kind:'bad'}; if(pub)return {txt:`Live · ${pub.label} from ${pub.effective_date}${dr?' · draft open':''}`,kind:'ok'}; if(dr)return {txt:'Draft',kind:'warn'}; return {txt:'—',kind:'info'}; }
function renderAdmin27(){
  const w=$('adminWrap'); if(!w)return;
  if(!P27.ready){ w.innerHTML=`<div class="panel"><div class="admin-body" style="font-size:13px"><b>Run migration_v22_spec27.sql</b> in Supabase ▸ SQL Editor to enable plan versions, employees and the ledger. <span class="qctx">${esc(P27.missing||'')}</span></div></div>`; return; }
  const v=latestVersion(ADM_FAMILY); const c=(v&&v.config)||{}; const ph=!!c.placeholder; const ed=can('editConfig')&&v&&v.status==='draft';
  const val=x=>x==null?'':esc(String(x)); const terms=[12,24,36,48,60];
  const inp=(id,x,attrs='')=>`<input class="cfg-in" id="${id}" value="${val(x)}" ${ed?'':'disabled'} ${attrs} placeholder="${ph?'Not configured':''}">`;
  const pct=x=>x==null||x===''?'':String(Math.round(+x*100000)/1000);
  const derived=t=>{ try{ return c.newMult&&c.newMult[t]?E27.pctStr(E27.div(E27.dec(c.newMult[t]),E27.R(BigInt(t))),4):'—'; }catch(e){ return '—'; } };
  w.innerHTML=`
   <div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>Plan</h2><span class="qctx">exactly three families · versions live inside a family (CAT-03)</span></div><div class="admin-body">
    <div style="display:flex;gap:8px;flex-wrap:wrap">${PLAN_FAMILIES.map(f=>{ const s=famStatus(f); return `<button class="${f===ADM_FAMILY?'btn-primary':'iconbtn'}" data-fam27="${f}" style="padding:8px 14px">${f} <span style="font-weight:500;font-size:11px;opacity:.85">· ${esc(s.txt)}</span></button>`; }).join('')}
     <button class="iconbtn" id="hist27" style="margin-left:auto" title="Read-only. Historical versions are evidence, not offered plans (CAT-02).">Historical rules ▸</button></div>
    <div style="margin-top:10px;font-size:12.5px">Editing <b>${esc(v?v.label:'—')}</b> · version ${v?v.version_no:'—'} · status <b>${esc(v?v.status:'—')}</b>${v&&v.effective_date?' · effective '+esc(v.effective_date):''}${v&&v.approved_by?' · approved by '+esc(v.approved_by):''} · rate basis <b>${esc(v&&v.rate_basis||'—')}</b>
     ${v&&v.status==='published'&&can('editConfig')?' <button class="iconbtn" id="newdraft27">Edit → opens a new draft version</button>':''}</div>
    ${ph?`<div style="margin-top:10px;background:#fbeaea;border:2px solid #e6a6a6;border-radius:8px;padding:10px 12px;font-size:13px;color:#9a2a2a"><b>NOT CONFIGURED — placeholder.</b> Compensation, allocations, rates, thresholds and earning terms are blank. Authorised editors may save future draft inputs; calculation, employee assignment and activation stay disabled until a complete plan is supplied, validated and approved (ADM-05).</div>`:''}
   </div></div>
   ${ADM_SHOW_HIST?historicalRulesHTML():''}
   <div class="admin-grid">
    <div class="panel"><div class="panel-head"><h2>Role</h2></div><div class="admin-body">
      <label class="cfg-lbl">Hunter / new acquisition allocation</label>${inp('a_hunt',pct(c.allocation&&c.allocation.hunter),'type="number" step="1"')} %
      <label class="cfg-lbl">Farmer / account management allocation</label>${inp('a_farm',pct(c.allocation&&c.allocation.farmer),'type="number" step="1"')} %
      <div class="qctx" style="margin-top:6px">Role emphasis only — not a commission credit split, salary split or payout multiplier. Must total 100%.</div></div></div>
    <div class="panel"><div class="panel-head"><h2>Compensation</h2></div><div class="admin-body">
      <label class="cfg-lbl">Annual base salary assumption</label>${inp('a_sal',c.salaryAssumption,'type="number" step="1000"')} $ <span class="qctx">actual salary is stored per employee with effective dates</span>
      <div style="margin-top:10px;font-size:12.5px;line-height:1.6">Target annual variable compensation <b>$${(c.variableTarget||{}).low!=null?(+c.variableTarget.low).toLocaleString():'—'} – $${(c.variableTarget||{}).high!=null?(+c.variableTarget.high).toLocaleString():'—'}</b> · growth opportunity <b>$${(c.growthOpportunity||{}).low!=null?(+c.growthOpportunity.low).toLocaleString():'—'} – $${(c.growthOpportunity||{}).high!=null?(+c.growthOpportunity.high).toLocaleString():'—'}</b><br><span class="qctx">Planning guidance only — not a guaranteed bonus, minimum, forced result or cap (ADM-04).</span><div id="fcast27" style="margin-top:6px"></div></div></div></div>
    <div class="panel"><div class="panel-head"><h2>Quotas</h2></div><div class="admin-body">
      <label class="cfg-lbl">Monthly new-MRR quota</label>${inp('a_quota',c.quotaMonthlyMrr,'type="number" step="50"')} $/mo <span class="qctx">${c.quotaMonthlyMrr?'annual '+fmt(c.quotaMonthlyMrr*12):''}</span>
      <label class="cfg-lbl">Above-quota accelerator</label>${inp('a_accel',c.accelMultiplier,'type="number" step="0.05"')} × <span class="qctx">1.0 = dormant · no annual cap</span></div></div>
    <div class="panel"><div class="panel-head"><h2>Commission rates</h2><span class="qctx">exact multiples of eligible MRR · % shown is derived</span></div><div class="admin-body">
      <table class="cfg-table"><thead><tr><th>Term</th><th>New sale / expansion</th><th>Displayed TCV %</th><th>New SLA (× MRR equiv.)</th></tr></thead><tbody>${terms.map(t=>`<tr><td>${t} months</td><td>${inp('m_new_'+t,c.newMult&&c.newMult[t],'style="width:80px"')} ×</td><td class="mono">${derived(t)}</td><td>${inp('m_sla_'+t,c.slaNewMult&&c.slaNewMult[t],'style="width:80px"')} ×</td></tr>`).join('')}</tbody></table>
      <div class="cfg-two" style="margin-top:8px"><div><label class="cfg-lbl">Manual renewal (× retained MRR, all terms)</label>${inp('m_ren',c.renewalMult,'style="width:80px"')} ×</div><div><label class="cfg-lbl">SLA renewal (× retained MRR equiv.)</label>${inp('m_slaren',c.slaRenewalMult,'style="width:80px"')} ×</div></div>
      <div class="qctx" style="margin-top:6px">Above 60 months: capped at ${val(c.newMultCapAbove60||'—')}×. Auto-renewal ${val(c.autoRenewalMult||'—')}×, escalation ${val(c.escalatorMult||'—')}×, term conversion ${val(c.termConversionMult||'—')}× (fixed at 0, COM-04). Nonstandard terms below 60 months need an approved mapping. ${c.approvedTermNote48?esc(c.approvedTermNote48):''}</div></div></div>
    <div class="panel"><div class="panel-head"><h2>Margin</h2></div><div class="admin-body">
      <div class="cfg-two"><div><label class="cfg-lbl">Target gross margin</label>${inp('g_target',pct(c.targetMargin),'type="number" step="0.5"')} %</div><div><label class="cfg-lbl">Qualification floor</label>${inp('g_min',pct(c.minMargin),'type="number" step="0.5"')} %</div></div>
      <div class="qctx" style="margin-top:6px">1.0 at or above the floor, 0 below; unknown margin blocks. Measured on modelled direct cost only — overhead never enters (CST-01, CST-03).</div></div></div>
    <div class="panel"><div class="panel-head"><h2>Bonuses</h2><span class="qctx">% of base salary accrued · calendar year · paid by Feb 15</span></div><div class="admin-body"><div class="cfg-two">
      <div><table class="cfg-table"><thead><tr><th>GRR ≥</th><th>Bonus</th></tr></thead><tbody>${[0,1,2,3].map(i=>{const t=(c.grrBonus||[])[i]||{}; return `<tr><td>${inp('b_gmin'+i,pct(t.min),'style="width:70px"')} %</td><td>${inp('b_gpct'+i,pct(t.pct),'style="width:60px"')} %</td></tr>`;}).join('')}</tbody></table></div>
      <div><table class="cfg-table"><thead><tr><th>NRR ≥</th><th>Bonus</th></tr></thead><tbody>${[0,1,2,3].map(i=>{const t=(c.nrrBonus||[])[i]||{}; return `<tr><td>${inp('b_nmin'+i,pct(t.min),'style="width:70px"')} %</td><td>${inp('b_npct'+i,pct(t.pct),'style="width:60px"')} %</td></tr>`;}).join('')}</tbody></table></div></div>
      <div class="qctx" style="margin-top:6px">Highest satisfied tier within each measure; GRR and NRR awards add. Unavailable metric = Unknown, never a $0 final bonus.</div></div></div>
    <div class="panel"><div class="panel-head"><h2>Payment rules</h2></div><div class="admin-body">
      <div class="cfg-two"><div><label class="cfg-lbl">Tranche 1</label>${inp('p_t1',pct(c.tranche1Pct),'type="number" step="1"')} %</div><div><label class="cfg-lbl">Tranche 2</label>${inp('p_t2',pct(c.tranche2Pct),'type="number" step="1"')} %</div></div>
      <label class="cfg-lbl">Tranche 2 time condition</label>${inp('p_off',c.releaseOffsetMonths,'type="number" step="1" style="width:60px"')} calendar months after first actual billing
      <div class="qctx" style="margin-top:6px">Both tranches also require confirmed collection (PAY-01/02). The 25%-collected shortcut and the net-profit release test are off for revised events.</div></div></div>
   </div>
   <div class="admin-actions">
     <button class="btn-primary" id="sv27" ${ed?'':'disabled'}>Save draft</button>
     <button class="iconbtn" id="pv27" ${(v&&!ph)?'':'disabled title="Not configured"'}>Preview calculation</button>
     <button class="iconbtn" id="pb27" ${(can('editConfig')&&v&&v.status==='draft'&&!ph)?'':'disabled'}>Publish version…</button>
     <span id="msg27" style="font-size:12px;color:var(--muted)">Save draft never changes live calculations.</span></div>
   <div id="pvOut27"></div><div id="pubForm27"></div>
   <div class="panel" style="margin-top:16px"><div class="panel-head"><h2>Employees</h2><span class="qctx">permission role · plan family assignment · salary · acknowledgement (NAV-05)</span></div><div id="emp27" class="admin-body">Loading…</div></div>
   <div class="panel" style="margin-top:16px"><div class="panel-head"><h2>Payout calendar &amp; feed owners</h2><span class="qctx">configuration, not constants (VIS-09, VIS-12)</span></div><div id="cal27" class="admin-body"></div></div>
   <div class="panel" style="margin-top:16px"><div class="panel-head"><h2>Data inventory</h2><span class="qctx">MIG-08 · CST-10 · TEC-07</span></div><div id="inv27" class="admin-body"></div></div>
   ${can('viewAudit')?`<div class="panel" style="margin-top:16px"><div class="panel-head"><h2>Audit log</h2><span class="qctx">immutable · most recent first</span></div><div id="auditWrap"><div class="admin-body" style="color:var(--muted);font-size:13px">Loading…</div></div></div>`:''}`;
  w.querySelectorAll('[data-fam27]').forEach(b=>b.onclick=()=>{ ADM_FAMILY=b.dataset.fam27; ADM_PREVIEW=null; renderAdmin27(); });
  $('hist27').onclick=()=>{ ADM_SHOW_HIST=!ADM_SHOW_HIST; renderAdmin27(); };
  if($('newdraft27')) $('newdraft27').onclick=async()=>{ const nv={family:v.family,version_no:Math.max(...P27.versions.filter(x=>x.family===v.family).map(x=>x.version_no))+1,label:`${v.family} v${Math.max(...P27.versions.filter(x=>x.family===v.family).map(x=>x.version_no))+1}`,status:'draft',rate_basis:v.rate_basis,config:v.config,supersedes:v.id,created_by:CURRENT_EMAIL};
    const {error}=await sb.from('rmr_plan_versions').insert(nv); if(error){toast(error.message);return;} audit('Plan draft version opened','Admin',nv.label,null,nv,null); await load27(); renderAdmin27(); };
  $('sv27').onclick=()=>saveDraft27(v);
  $('pv27').onclick=()=>previewDraft27(v);
  $('pb27').onclick=()=>publishForm27(v);
  renderEmployees27(); renderCalendar27(); renderInventory27(); renderForecast27(v);
  if(can('viewAudit')) renderAudit();
}
function readDraft27(v){
  const c=JSON.parse(JSON.stringify(v.config||{})); const g=id=>{ const el=$(id); return el?el.value.trim():''; }; const frac=x=>x===''?null:String(Math.round(+x*1000)/100000);
  const num=x=>x===''?null:+x; const errs=[];
  c.allocation={hunter:frac(g('a_hunt')),farmer:frac(g('a_farm'))}; if(c.allocation.hunter==null&&c.allocation.farmer==null)c.allocation=null;
  c.salaryAssumption=num(g('a_sal')); c.quotaMonthlyMrr=num(g('a_quota')); c.accelMultiplier=g('a_accel')||null;
  const nm={}, sm={}; [12,24,36,48,60].forEach(t=>{ nm[t]=g('m_new_'+t)||null; sm[t]=g('m_sla_'+t)||null; });
  c.newMult=Object.values(nm).some(x=>x!=null)?nm:null; c.slaNewMult=Object.values(sm).some(x=>x!=null)?sm:null;
  c.renewalMult=g('m_ren')||null; c.slaRenewalMult=g('m_slaren')||null; c.targetMargin=frac(g('g_target')); c.minMargin=frac(g('g_min'));
  c.marginGate=c.minMargin!=null?[{min:c.minMargin,mult:'1.0'},{min:'0',mult:'0'}]:null;
  const tiers=(p)=>[0,1,2,3].map(i=>({min:frac(g(`b_${p}min${i}`)),pct:frac(g(`b_${p}pct${i}`))})).filter(t=>t.min!=null&&t.pct!=null);
  c.grrBonus=tiers('g'); c.nrrBonus=tiers('n'); c.tranche1Pct=frac(g('p_t1')); c.tranche2Pct=frac(g('p_t2')); c.releaseOffsetMonths=num(g('p_off'));
  [...Object.values(nm),...Object.values(sm),c.renewalMult,c.slaRenewalMult,c.accelMultiplier].forEach(x=>{ if(x!=null&&!/^\d+(\.\d+)?$/.test(x))errs.push(`"${x}" is not a decimal multiple.`); });
  if(c.accelMultiplier!=null&&+c.accelMultiplier<1)errs.push('Accelerator must be 1.0 or higher.');
  if(!c.placeholder){ c.termConversionMult='0'; c.autoRenewalMult='0'; c.escalatorMult='0'; }
  return {c,errs};
}
async function saveDraft27(v){
  if(!can('editConfig')||v.status!=='draft'){ toast('Only a draft can be edited — open a new draft version'); return; }
  const {c,errs}=readDraft27(v); if(errs.length){ $('msg27').style.color='var(--held)'; $('msg27').textContent=errs[0]; return; }
  const {error}=await sb.from('rmr_plan_versions').update({config:c,preview_checked_at:null}).eq('id',v.id);
  if(error){ $('msg27').style.color='var(--held)'; $('msg27').textContent=error.message; return; }
  audit('Plan draft saved','Admin',v.label,v.config,c,null); await load27(); renderAdmin27(); $('msg27').style.color='var(--payable)'; $('msg27').textContent='✓ Draft saved — live calculations are unchanged.';
}
function previewDraft27(v){
  const {c,errs}=v.status==='draft'&&can('editConfig')?readDraft27(v):{c:v.config,errs:[]};
  const pv={...planVersionPlain(v),config:c}; const out=$('pvOut27');
  const val=E27.validatePlanVersion(pv);
  const samples=[{t:'New 36-mo at $1,000 MRR',i:{eventType:'new_sale',term:36,newMrr:'1000'}},{t:'New 12-mo at $100 MRR',i:{eventType:'new_sale',term:12,newMrr:'100'}},{t:'Manual renewal $1,000→$1,300, 36 mo',i:{eventType:'manual_renewal',term:36,priorMrr:'1000',newMrr:'1300'}},
    {t:'SLA $10,000/yr, 36 mo',i:{eventType:'sla_new',category:'sla',term:36,slaAnnual:'10000'}},{t:'SLA renewal $10,000 retained',i:{eventType:'sla_renewal',category:'sla',term:12,priorSlaAnnual:'10000',slaAnnual:'10000'}},{t:'Margin 44.999%',i:{eventType:'new_sale',term:36,newMrr:'1000',margin:E27.dec('0.44999')}}];
  const run=(i)=>{ try{ const r=E27.calculate(Object.assign({plan:pv,margin:E27.dec('0.5'),shares:[{email:'preview',bp:10000}]},i)); return `${E27.fmtCents(r.totalCents)} <span class="qctx">(${E27.fmtCents(r.tranche1Cents)} + ${E27.fmtCents(r.tranche2Cents)})</span>`; }catch(e){ return `<span style="color:var(--held)">${esc(e.message)}</span>`; } };
  const book=scopedAgreements().filter(a=>!a.history_only).slice(0,25);
  const rows=book.map(a=>{ const before=compute(a); const inp=revisedInputs(a); let after; try{ after=E27.calculate({plan:pv,eventType:inp.eventType,term:inp.term,category:a.category,newMrr:inp.mrrQ?E27.toDollars(E27.roundHalfUp(inp.mrrQ)):null,priorMrr:inp.prior!=null?String(inp.prior):null,slaAnnual:inp.isSla&&inp.mrrQ?E27.toDollars(E27.roundHalfUp(E27.mul(inp.mrrQ,E27.R(12n)))):null,margin:inp.qm.margin,shares:[{email:'preview',bp:10000}]}); after=E27.fmtCents(after.totalCents); }catch(e){ after=`<span style="color:var(--held)">${esc(e.message)}</span>`; }
    return `<tr><td>#${esc(a.agreement_number)}</td><td>${esc(a.customer_name||'')}</td><td>${+a.contract_term||'M2M'} mo</td><td class="num mono">${fmt2(agreementMrr(a))}</td><td class="num mono">${fmt2(before.initialCommission)} <span class="qctx">${esc(before.planVersion||'')}</span></td><td class="num mono">${after}</td></tr>`; }).join('');
  out.innerHTML=`<div class="panel" style="margin-top:12px;border:2px dashed var(--orange)"><div class="panel-head"><h2>Draft preview — does not create earned commissions</h2><span class="qctx">${esc(v.label)} · no ledger, payroll or agreement write (CAT-07)</span></div><div class="admin-body">
    ${val.length?`<div style="color:var(--held);font-size:12.5px;margin-bottom:8px"><b>Not publishable yet:</b><br>${val.map(esc).join('<br>')}</div>`:'<div style="color:var(--payable);font-size:12.5px;margin-bottom:8px">✓ Rules are complete and consistent with rate_basis.</div>'}
    <table class="cfg-table"><thead><tr><th>Reference case (50% margin, 100% credit)</th><th>Result</th></tr></thead><tbody>${samples.map(s=>`<tr><td>${esc(s.t)}</td><td>${run(s.i)}</td></tr>`).join('')}</tbody></table>
    <div class="fieldset-h" style="margin-top:12px">Before → after on 2026+ agreements (modelled; historical events keep their own version)</div>
    <table class="cfg-table"><thead><tr><th>Agr</th><th>Customer</th><th>Term</th><th class="num">MRR</th><th class="num">Today</th><th class="num">Under this draft</th></tr></thead><tbody>${rows||'<tr><td colspan="6">No 2026+ agreements in scope.</td></tr>'}</tbody></table></div></div>`;
  ADM_PREVIEW={id:v.id,at:new Date().toISOString(),valid:!val.length};
  if(can('editConfig')&&v.status==='draft') sb.from('rmr_plan_versions').update({preview_checked_at:ADM_PREVIEW.at}).eq('id',v.id).then(()=>{ v.preview_checked_at=ADM_PREVIEW.at; });
}
function publishForm27(v){
  const box=$('pubForm27'); const val=E27.validatePlanVersion(v);
  if(val.length){ box.innerHTML=`<div class="panel" style="margin-top:12px"><div class="admin-body" style="color:var(--held);font-size:12.5px"><b>Publication rejected:</b><br>${val.map(esc).join('<br>')}</div></div>`; return; }
  if(!v.preview_checked_at&&!(ADM_PREVIEW&&ADM_PREVIEW.id===v.id)){ box.innerHTML=`<div class="panel" style="margin-top:12px"><div class="admin-body" style="color:var(--held)">Run <b>Preview calculation</b> on this draft first (ADM-06).</div></div>`; return; }
  box.innerHTML=`<div class="panel" style="margin-top:12px;border:2px solid var(--navy)"><div class="panel-head"><h2>Publish ${esc(v.label)}</h2><span class="qctx">creates an immutable version · cannot rewrite historical events</span></div><div class="admin-body" style="font-size:12.5px">
    <div class="cfg-two"><div><label class="cfg-lbl">Effective date (not before ${REVISED_CUTOVER})</label><input type="date" class="cfg-in" id="pf_eff" min="${REVISED_CUTOVER}"></div><div><label class="cfg-lbl">Approved by</label><input class="cfg-in wide" id="pf_by" value="Sean Bithell"></div></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="pf_48"> I approve the 48-month multiple of ${esc((v.config.newMult||{})[48]||'—')}× explicitly (carried from the planning workbook — COM-06)</label>
    <label style="display:flex;gap:8px;align-items:center;margin-top:4px"><input type="checkbox" id="pf_terms"> These earning terms match the written compensation agreement (Labor Code §2751)</label>
    <div class="qctx" style="margin-top:6px">Approver and sole representative are the same person at this revision — recorded deliberately; add a second approver when the team grows (COM-07).</div>
    <div style="margin-top:10px"><button class="btn-primary" id="pf_go">Publish version</button> <span id="pf_msg" class="qctx"></span></div></div></div>`;
  $('pf_go').onclick=async()=>{ const eff=$('pf_eff').value, by=$('pf_by').value.trim();
    if(!eff||eff<REVISED_CUTOVER){ $('pf_msg').textContent='Pick an effective date on or after '+REVISED_CUTOVER+' — the plan is not retroactive.'; return; }
    if(!by||!$('pf_48').checked||!$('pf_terms').checked){ $('pf_msg').textContent='Approval, the 48-month confirmation and the written-terms confirmation are all required.'; return; }
    const cfg=JSON.parse(JSON.stringify(v.config)); cfg.approvedTermNote48=`48-month ${cfg.newMult[48]}× approved explicitly by ${by} at publication`;
    const upd1=await sb.from('rmr_plan_versions').update({config:cfg}).eq('id',v.id); if(upd1.error){ $('pf_msg').textContent=upd1.error.message; return; }
    const pv=Object.assign({},v,{config:cfg,effective_date:eff,approved_by:by});
    const {error}=await sb.from('rmr_plan_versions').update({status:'published',effective_date:eff,approved_by:by,approved_at:new Date().toISOString(),preview_checked_at:v.preview_checked_at||(ADM_PREVIEW&&ADM_PREVIEW.at),published_at:new Date().toISOString(),published_by:CURRENT_EMAIL,terms_text:termsText(pv)}).eq('id',v.id);
    if(error){ $('pf_msg').textContent=error.message; return; }
    const prior=P27.versions.filter(x=>x.family===v.family&&x.status==='published'&&x.id!==v.id);
    audit('Plan version published','Admin',v.label,null,{effective:eff,approved_by:by,supersedes:prior.map(p=>p.label)},null);
    await load27(); renderAdmin27(); toast(v.label+' published — assign it to employees below'); };
}
function historicalRulesHTML(){
  const rows=PLANS.map(p=>{ const c=p.config||{}; const users=Object.entries(USER_PLAN).filter(([e,id])=>String(id)===String(p.id)).map(([e])=>e);
    const pm=m=>m?Object.entries(m).map(([t,v])=>`${t}:${Math.round(v*100000)/1000}%`).join(' '):'—';
    return `<tr><td><b>${esc(c.planVersion||p.plan_name)}</b><div class="qctx">${esc(String(p.created_at||'').slice(0,10))} · tcv_percent</div></td><td class="mono" style="font-size:11px">${pm(c.newPct)}</td><td class="mono" style="font-size:11px">${pm(c.renewalPct)}</td><td style="font-size:11px">${Math.round((c.immediatePct||0)*100)}/${Math.round((c.holdbackPct||0)*100)} · ${esc(c.releaseMode||'')}</td><td style="font-size:11px">${users.map(esc).join('<br>')||'—'}</td></tr>`; }).join('');
  return `<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>Historical rules — read-only</h2><span class="qctx">evidence for old transactions · not offered for new assignment (CAT-02)</span></div><div class="admin-body"><table class="cfg-table"><thead><tr><th>Version</th><th>New %</th><th>Renewal %</th><th>Split · release</th><th>Owners whose historical transactions read it</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
/* Comp plan per user: a designation (Hybrid / Hunter / Farmer) kept in rmr_settings.comp_family. It never moves anyone
   onto a plan by itself (ADM-07); it drives a one-click, audited assignment once that family has a published version. */
function compFamilyOf(email){ return ((P27.settings.comp_family)||{})[String(email||'').toLowerCase()]||null; }
function liveVersionOf(fam){ return P27.versions.filter(v=>v.family===fam&&v.status==='published'&&!(v.config&&v.config.placeholder)).sort((a,b)=>b.version_no-a.version_no)[0]||null; }
function compPlanLine27(email,a){
  const em=String(email||'').toLowerCase(); if(!em)return '';
  if(a&&a.id&&!isRevisedTransaction(a))return `Sold before ${REVISED_CUTOVER} — this deal stays on the historical plan it was sold under.`;
  const r=resolveRevised(em,(a&&eventDateOf(a))||E27.businessToday()); const fam=compFamilyOf(em);
  if(r.state==='ok')return `Comp plan: <b>${esc(r.version.label)}</b> ✓`;
  if(r.state==='ack_required')return `Comp plan: <b>${esc(r.version.label)}</b> — <span style="color:var(--held)">waiting on ${esc(em)} to acknowledge the terms</span>`;
  { const d0=(a&&eventDateOf(a))||E27.businessToday(); const up=P27.assignments.filter(x=>String(x.email).toLowerCase()===em&&x.effective_from>d0).sort((x,y)=>String(x.effective_from).localeCompare(String(y.effective_from)))[0];
    if(up){ const uv=versionById(up.plan_version_id); return `Comp plan: <b>${esc(uv?uv.label:'assigned plan')}</b> — starts ${esc(up.effective_from)}. Deals signed from that date are covered.`; } }
  if(fam){ const lv=liveVersionOf(fam); return `Comp plan: <b>${esc(fam)}</b> — ${lv?'not assigned yet (Admin ▸ Employees)':(P27.versions.some(v=>v.family===fam&&!(v.config&&v.config.placeholder))?'draft, not live yet':'numbers not set yet')}. Commission shows <i>Plan not configured</i> until it is.`; }
  return `<span style="color:var(--orange)">No comp plan set for ${esc(em)}</span> — set it in Admin ▸ Employees.`;
}
async function renderEmployees27(){
  const box=$('emp27'); if(!box)return; const users=P27.users||[]; const today=E27.businessToday();
  const pubs=P27.versions.filter(v=>v.status==='published'&&!(v.config&&v.config.placeholder));
  const row=u=>{ const em=String(u.email).toLowerCase(); const asg=P27.assignments.filter(x=>String(x.email).toLowerCase()===em).sort((a,b)=>String(b.effective_from).localeCompare(String(a.effective_from)));
    const cur=asg.find(x=>x.effective_from<=today&&(!x.effective_to||today<x.effective_to)); const cv=cur?versionById(cur.plan_version_id):null;
    const ack=cv?P27.acks.find(k=>String(k.email).toLowerCase()===em&&String(k.plan_version_id)===String(cv.id)):null;
    const sal=P27.salaries.filter(s=>String(s.email).toLowerCase()===em).sort((a,b)=>String(b.effective_from).localeCompare(String(a.effective_from)))[0];
    const hist=USER_PLAN[em]?(PLANS.find(p=>String(p.id)===String(USER_PLAN[em]))||{}).plan_name:null;
    return `<tr><td>${esc(u.email)}${em===(CURRENT_EMAIL||'').toLowerCase()?' <span class="qctx">(you)</span>':''}</td>
      <td>${can('editConfig')?`<select class="cfg-in" data-prole27="${esc(u.email)}">${PERMISSION_ROLES.map(r=>`<option ${normRole(u.permission_role||u.role)===r?'selected':''}>${r}</option>`).join('')}</select>`:esc(normRole(u.permission_role||u.role))}<div class="qctx">${u.role_migrated_from?'migrated from '+esc(u.role_migrated_from):''}</div></td>
      <td>${(()=>{ const fam=compFamilyOf(em); return can('editConfig')?`<select class="cfg-in" data-cf27="${esc(em)}"><option value="">— not set —</option>${['Hybrid','Hunter','Farmer'].map(f=>`<option value="${f}" ${fam===f?'selected':''}>${f} (${esc(famStatus(f).txt.split(' · ')[0])})</option>`).join('')}</select>`:(fam?esc(fam):'—'); })()}</td>
      <td>${cv?`<b>${esc(cv.family)}</b> · ${esc(cv.label)}<div class="qctx">from ${esc(cur.effective_from)}${cur.effective_to?' to '+esc(cur.effective_to):''} · approved ${esc(cur.approved_by)}</div>`:'<span style="color:var(--orange)">Plan not configured</span>'}${hist?`<div class="qctx">historical: ${esc(hist)}</div>`:''}${(()=>{
        const fam=compFamilyOf(em); if(!fam||(cv&&cv.family===fam))return '';
        const up=asg.find(x=>x.effective_from>today); if(up){ const uv=versionById(up.plan_version_id); return `<div class="qctx">${esc(uv?uv.label:'Next plan')} starts ${esc(up.effective_from)}</div>`; }
        const lv=liveVersionOf(fam);
        if(!lv)return `<div class="qctx">${esc(fam)} chosen — ${P27.versions.some(v=>v.family===fam&&!(v.config&&v.config.placeholder))?'assignable once the draft is published':'assignable once its numbers are entered and published'}.</div>`;
        if(!can('editConfig'))return '';
        const from=[today,lv.effective_date||today].sort().pop();
        return `<div style="margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><button class="iconbtn" data-cfgo27="${esc(em)}" data-v="${lv.id}">${cv?'Switch to':'Assign'} ${esc(lv.label)}</button> from <input type="date" class="cfg-in" data-cffrom27="${esc(em)}" value="${from}" min="${lv.effective_date||''}"></div>`; })()}</td>
      <td>${u.must_set_password?'<div class="qctx">Login created — waiting for first sign-in</div>':''}${cv?(ack?`<span style="color:var(--payable)">✓ ${esc(String(ack.acknowledged_at).slice(0,10))}</span>`:'<span style="color:var(--held);font-weight:700">Missing — calculation blocked</span>'):'—'}</td>
      <td>${sal?`${fmt(+sal.annual_salary)} <span class="qctx">from ${esc(sal.effective_from)}</span>`:'<span class="qctx">none</span>'}</td></tr>`; };
  box.innerHTML=`<table class="cfg-table"><thead><tr><th>Employee</th><th>Permission role</th><th>Comp plan</th><th>Plan assignment</th><th>Acknowledgement</th><th>Salary</th></tr></thead><tbody>${users.map(row).join('')}</tbody></table>
   ${can('editConfig')?`<div class="panel" style="margin-top:14px;padding:14px 16px;background:#fafafa"><div style="font-weight:700;margin-bottom:8px">Add an employee</div>
     <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px 12px;font-size:12.5px;align-items:end">
      <label>Work email<input class="cfg-in" id="nu_em" placeholder="name@point1.com" style="width:100%"></label>
      <label>What they can do<select class="cfg-in" id="nu_role" style="width:100%">${PERMISSION_ROLES.map(r=>`<option ${r==='Representative'?'selected':''}>${r}</option>`).join('')}</select></label>
      <label>Comp plan<select class="cfg-in" id="nu_cf" style="width:100%"><option value="">— none (not paid commission) —</option>${['Hybrid','Hunter','Farmer'].map(f=>`<option value="${f}">${f} (${esc(famStatus(f).txt.split(' · ')[0])})</option>`).join('')}</select></label>
      <label>Start date<input type="date" class="cfg-in" id="nu_from" value="${today}" style="width:100%"></label>
      <label>Annual base salary <span class="qctx">optional</span><input type="number" class="cfg-in" id="nu_sal" step="1000" placeholder="e.g. 110000" style="width:100%"></label>
      <label>Temporary password <span class="qctx">creates their login</span><input type="text" class="cfg-in" id="nu_pw" placeholder="leave blank if they already have one" autocomplete="off" style="width:100%"></label>
     </div>
     <div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn-primary" id="nu_go">Add employee</button><span class="qctx">Adds them, sets their comp plan and salary, assigns the plan if it's published, and creates their login. They choose their own password and accept the plan terms at first sign-in.</span></div>
     <div id="nu_out" style="margin-top:8px;font-size:12.5px;line-height:1.6"></div></div>
     <details style="margin-top:10px;font-size:12.5px"><summary style="cursor:pointer;font-weight:600">More: assign a specific plan version or dates · record a salary change</summary>
     <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>Assign plan:</b>
     <select class="cfg-in" id="as_em">${users.map(u=>`<option>${esc(u.email)}</option>`).join('')}</select>
     <select class="cfg-in" id="as_v">${pubs.length?pubs.map(v=>`<option value="${v.id}">${esc(v.family)} · ${esc(v.label)} (from ${esc(v.effective_date)})</option>`).join(''):'<option value="">No published version yet</option>'}</select>
     from <input type="date" class="cfg-in" id="as_from"> to <input type="date" class="cfg-in" id="as_to" title="optional"> <input class="cfg-in" id="as_why" placeholder="Reason"> <button class="iconbtn" id="as_go" ${pubs.length?'':'disabled'}>Approve assignment</button></div>
     <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>Salary record:</b> <select class="cfg-in" id="sl_em">${users.map(u=>`<option>${esc(u.email)}</option>`).join('')}</select> <input type="number" class="cfg-in" id="sl_amt" placeholder="Annual base" step="1000"> from <input type="date" class="cfg-in" id="sl_from"> <button class="iconbtn" id="sl_go">Add</button></div></details>
     <div class="qctx" style="margin-top:8px">Changing someone's comp plan never moves them by itself — the Assign button appears once that plan has a published version, and they accept the terms at their next sign-in. Hunter and Farmer can't be assigned until their numbers are entered and published.</div>`:''}`;
  box.querySelectorAll('[data-cf27]').forEach(s=>s.onchange=async()=>{ const em=s.dataset.cf27; const before=P27.settings.comp_family||{}; const map={...before}; if(s.value)map[em]=s.value; else delete map[em];
    const {error}=await sb.from('rmr_settings').upsert([{key:'comp_family',value:map,updated_by:CURRENT_EMAIL,updated_at:new Date().toISOString()}],{onConflict:'key'}); if(error){toast(error.message);return;}
    audit('Comp plan set','Admin',em,{comp_family:before[em]||null},{comp_family:s.value||null},null); await load27(); renderEmployees27(); toast(s.value?`${em} set to ${s.value}`:'Comp plan cleared'); });
  box.querySelectorAll('[data-cfgo27]').forEach(b=>b.onclick=async()=>{ const em=b.dataset.cfgo27, v=versionById(b.dataset.v); const from=(box.querySelector(`[data-cffrom27="${em}"]`)||{}).value;
    if(!v||!from){toast('Pick a start date');return;} if(v.effective_date&&from<v.effective_date){toast('Cannot start before '+v.effective_date);return;}
    const cur=P27.assignments.find(x=>String(x.email).toLowerCase()===em&&(!x.effective_to||x.effective_to>from)&&x.effective_from<from);
    const clash=P27.assignments.find(x=>String(x.email).toLowerCase()===em&&x.effective_from>=from);
    if(clash){toast('This employee already has an assignment starting on or after that date');return;}
    if(cur){ const {error}=await sb.from('rmr_plan_assignments').update({effective_to:from}).eq('id',cur.id); if(error){toast(error.message);return;} }
    const row={email:em,plan_version_id:v.id,effective_from:from,effective_to:null,approved_by:CURRENT_EMAIL,reason:`Comp plan set to ${v.family}`};
    const {error}=await sb.from('rmr_plan_assignments').insert(row);
    if(error){ if(cur) await sb.from('rmr_plan_assignments').update({effective_to:cur.effective_to||null}).eq('id',cur.id); toast(error.message); return; }
    audit('Plan assignment approved','Admin',em,cur?{plan_version_id:cur.plan_version_id,effective_to:cur.effective_to||null}:null,row,row.reason); await load27(); renderEmployees27(); toast(`${em} assigned to ${v.label} from ${from}`); });
  box.querySelectorAll('[data-prole27]').forEach(s=>s.onchange=async()=>{ const {error}=await sb.from('rmr_users').update({permission_role:s.value}).eq('email',s.dataset.prole27); if(error){toast(error.message);return;} audit('Permission role changed','Admin',s.dataset.prole27,null,{permission_role:s.value},null); toast('Permission role updated'); await load27(); });
  if($('as_go')) $('as_go').onclick=async()=>{ const row={email:$('as_em').value.toLowerCase(),plan_version_id:$('as_v').value,effective_from:$('as_from').value,effective_to:$('as_to').value||null,approved_by:CURRENT_EMAIL,reason:$('as_why').value.trim()||null};
    if(!row.effective_from){toast('Pick the assignment start date');return;} const v=versionById(row.plan_version_id); if(v&&row.effective_from<v.effective_date){toast('Assignment cannot start before the version is effective ('+v.effective_date+')');return;}
    const {error}=await sb.from('rmr_plan_assignments').insert(row); if(error){toast(error.message);return;} audit('Plan assignment approved','Admin',row.email,null,row,row.reason); await load27(); renderEmployees27(); toast('Assignment approved'); };
  if($('sl_go')) $('sl_go').onclick=async()=>{ const row={email:$('sl_em').value.toLowerCase(),annual_salary:+$('sl_amt').value,effective_from:$('sl_from').value,created_by:CURRENT_EMAIL}; if(!(row.annual_salary>0)||!row.effective_from){toast('Enter salary and start date');return;}
    const {error}=await sb.from('rmr_salary_records').insert(row); if(error){toast(error.message);return;} audit('Salary record added','Admin',row.email,null,{effective_from:row.effective_from},null); await load27(); renderEmployees27(); };
  if($('nu_go')) $('nu_go').onclick=async()=>{ const em=($('nu_em').value||'').trim().toLowerCase(); const out=$('nu_out'); const done=[], warn=[];
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){toast('Enter a valid email');return;}
    const r=$('nu_role').value, fam=($('nu_cf')||{}).value||'', from=($('nu_from')||{}).value||today, sal=+(($('nu_sal')||{}).value||0), pw=(($('nu_pw')||{}).value||'');
    if(pw&&pw.length<8){toast('Temporary password: at least 8 characters');return;}
    $('nu_go').disabled=true;
    try{
      let row={email:em,permission_role:r,role:r==='Representative'?'Hybrid':r}; if(pw)row.must_set_password=true;
      let q=await sb.from('rmr_users').upsert(row,{onConflict:'email'}); if(q.error&&/must_set_password/.test(q.error.message||'')){ delete row.must_set_password; q=await sb.from('rmr_users').upsert(row,{onConflict:'email'}); if(!q.error&&pw)warn.push('Run migration_v23_access.sql so new employees are asked to change the temporary password.'); }
      if(q.error)throw q.error; done.push(`added as <b>${esc(r)}</b>`); audit('Employee added','Admin',em,null,{permission_role:r},null);
      if(fam){ const map={...(P27.settings.comp_family||{})}; map[em]=fam; const q2=await sb.from('rmr_settings').upsert([{key:'comp_family',value:map,updated_by:CURRENT_EMAIL,updated_at:new Date().toISOString()}],{onConflict:'key'}); if(q2.error)throw q2.error; done.push(`comp plan <b>${fam}</b>`); audit('Comp plan set','Admin',em,null,{comp_family:fam},null); }
      if(sal>0){ const q3=await sb.from('rmr_salary_records').insert({email:em,annual_salary:sal,effective_from:from,created_by:CURRENT_EMAIL}); if(q3.error)warn.push('Salary not saved: '+q3.error.message); else { done.push(`salary ${fmt(sal)} from ${from}`); audit('Salary record added','Admin',em,null,{effective_from:from},null); } }
      if(fam){ const lv=liveVersionOf(fam); await load27();
        const has=P27.assignments.some(x=>String(x.email).toLowerCase()===em&&(!x.effective_to||x.effective_to>from));
        if(lv&&!has){ const f2=[from,lv.effective_date||from].sort().pop(); const q4=await sb.from('rmr_plan_assignments').insert({email:em,plan_version_id:lv.id,effective_from:f2,effective_to:null,approved_by:CURRENT_EMAIL,reason:`Comp plan set to ${fam} when added`});
          if(q4.error)warn.push('Plan not assigned: '+q4.error.message); else { done.push(`assigned <b>${esc(lv.label)}</b> from ${f2}`); audit('Plan assignment approved','Admin',em,null,{plan_version_id:lv.id,effective_from:f2},'Comp plan set when added'); } }
        else if(!lv) warn.push(`${fam} isn't published yet — use the Assign button on their row once it is.`); }
      if(pw){ const url=(LS.get('rmr_url')||'').trim(), key=(LS.get('rmr_key')||'').trim();
        const c2=supabase.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'p1-invite-'+Date.now()}});
        const su=await c2.auth.signUp({email:em,password:pw,options:{emailRedirectTo:location.origin+location.pathname}});
        if(su.error) warn.push(`Login not created (${esc(su.error.message)}). Create it in Supabase ▸ Authentication ▸ Users ▸ Add user, with "Auto Confirm User" ticked.`);
        else if(su.data&&su.data.user&&Array.isArray(su.data.user.identities)&&!su.data.user.identities.length) warn.push('A login already exists for this email — they can use their existing password (or "Forgot password").');
        else { done.push('login created'); audit('Login created','Admin',em,null,null,null); warn.push(`Next: they get a "Confirm your email" message from Supabase. After confirming, they sign in at <b>${esc(location.origin+location.pathname)}</b> with the temporary password and choose their own.`); } }
      await load27(); await loadUsers(); renderEmployees27();
      const o2=$('nu_out'); if(o2) o2.innerHTML=`<b style="color:var(--payable)">✓ ${esc(em)}</b>: ${done.join(' · ')}${warn.length?'<br>'+warn.join('<br>'):''}`;
      toast(`${em} added`);
    }catch(e){ toast(e.message||'Could not add'); if(out) out.textContent=e.message||''; }
    finally{ if($('nu_go'))$('nu_go').disabled=false; } };
}
function renderCalendar27(){
  const box=$('cal27'); if(!box)return; const pc=P27.settings.payout_calendar||{}; const fo=P27.settings.feed_owners||{}; const ed=can('editConfig'); const run=E27.payoutCalendar(pc);
  box.innerHTML=`<div style="font-size:12.5px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">Quarterly · pay within <input class="cfg-in" id="pc_pay" type="number" style="width:60px" value="${pc.payWithinDays||30}" ${ed?'':'disabled'}> days of quarter end · verify collections within <input class="cfg-in" id="pc_ver" type="number" style="width:60px" value="${pc.verifyWithinDays||15}" ${ed?'':'disabled'}> days · next run Q${run.q} ${run.y}: cutoff <b>${run.cutoff}</b>, pay by <b>${run.payBy}</b></div>
   <table class="cfg-table" style="margin-top:10px"><thead><tr><th>Feed</th><th>Export owner</th><th>Backup</th><th>Cadence</th></tr></thead><tbody>${FEED_ORDER.map(f=>{ const o=fo[f]||{}; return `<tr><td>${esc(V27.FEEDS[f].label)}</td><td><input class="cfg-in" data-fo="${f}|owner" value="${esc(o.owner||'')}" placeholder="name / email" ${ed?'':'disabled'}></td><td><input class="cfg-in" data-fo="${f}|backup" value="${esc(o.backup||'')}" ${ed?'':'disabled'}></td><td><input class="cfg-in" data-fo="${f}|cadence" value="${esc(o.cadence||'')}" style="width:100px" ${ed?'':'disabled'}></td></tr>`; }).join('')}</tbody></table>
   ${ed?'<button class="iconbtn" id="pc_save" style="margin-top:8px">Save calendar &amp; owners</button>':''}`;
  if($('pc_save')) $('pc_save').onclick=async()=>{ const pcn={...pc,frequency:'quarterly',payWithinDays:+$('pc_pay').value||30,verifyWithinDays:+$('pc_ver').value||15,timezone:'America/Los_Angeles'}; const fon=JSON.parse(JSON.stringify(fo));
    box.querySelectorAll('[data-fo]').forEach(i=>{ const [f,k]=i.dataset.fo.split('|'); fon[f]=fon[f]||{}; fon[f][k]=i.value.trim()||null; });
    const r1=await sb.from('rmr_settings').upsert([{key:'payout_calendar',value:pcn,updated_by:CURRENT_EMAIL,updated_at:new Date().toISOString()},{key:'feed_owners',value:fon,updated_by:CURRENT_EMAIL,updated_at:new Date().toISOString()}],{onConflict:'key'});
    if(r1.error){toast(r1.error.message);return;} audit('Payout calendar / feed owners saved','Admin',null,{pc,fo},{pcn,fon},null); await load27(); renderAdmin27(); toast('Saved'); };
}
async function renderInventory27(){
  const box=$('inv27'); if(!box)return;
  const live=AGREEMENTS.filter(isLiveAgreement);
  const legacyOnly=live.filter(a=>E27.modelledCost(a).state==='legacy_only').length, dbl=live.filter(a=>E27.modelledCost(a).doubleCountFlag).length, unknown=live.filter(a=>!isEnded(a)&&E27.modelledCost(a).state==='unknown').length;
  let audits=null; try{ const {data}=await sb.from('rmr_audit_log').select('record_id,new_value,old_value,action').ilike('action','%Agreement%').limit(2000); audits=data||[]; }catch(_){}
  const ownerChanged=new Set(); (audits||[]).forEach(r=>{ try{ const o=r.old_value?JSON.parse(r.old_value):null, n=r.new_value?JSON.parse(r.new_value):null; if(o&&n&&o.owner_email&&n.owner_email&&String(o.owner_email).toLowerCase()!==String(n.owner_email).toLowerCase())ownerChanged.add(r.record_id); }catch(_){} });
  const auditStart=(audits&&audits.length)?'':'';
  const blog=await sb.from('rmr_billing_log_audit_v22').select('auto_past_rows,auto_past_amount'); const autoRows=(blog.data||[]).reduce((s,r)=>s+(+r.auto_past_rows||0),0), autoAmt=(blog.data||[]).reduce((s,r)=>s+(+r.auto_past_amount||0),0);
  box.innerHTML=`<table class="cfg-table"><tbody>
    <tr><td>Billing rows auto-marked paid by date only (MIG-08)</td><td><b>${autoRows}</b> rows · ${fmt2(autoAmt)} — now Scheduled / Unverified; originals preserved. Commission paid on the strength of them: <b>$0.00</b> (clean fix).</td></tr>
    <tr><td>Cost basis from legacy field only (CST-10)</td><td><b>${legacyOnly}</b> agreements</td></tr>
    <tr><td>Legacy cost double-counted on itemised cost (F-09)</td><td><b>${dbl}</b> agreements — corrected: counted once</td></tr>
    <tr><td>Live agreements with no cost data (blocked as unknown margin)</td><td><b>${unknown}</b></td></tr>
    <tr><td>Agreements whose owner changed (TEC-07)</td><td><b>${ownerChanged.size}</b> found in the audit log · count before the audit log began is <b>unknown</b> (history incomplete — not assumed unchanged)</td></tr>
    <tr><td>Draw records (NAV-07)</td><td>preserved in rmr_draws; not read by any calculation, payout or export</td></tr></tbody></table>`;
}
function renderForecast27(v){
  const box=$('fcast27'); if(!box||!v||!v.config||v.config.placeholder)return;
  // ADM-04: transaction-derived forecast beside the targets, with its assumptions stated
  const y=new Date().getFullYear(); let newC=0n;
  scopedAgreements().filter(a=>!a.history_only&&String(eventDateOf(a)||'').slice(0,4)===String(y)).forEach(a=>{ const inp=revisedInputs(a); try{ const r=E27.calculate({plan:planVersionPlain(v),eventType:inp.eventType,term:inp.term,category:a.category,newMrr:inp.mrrQ?E27.toDollars(E27.roundHalfUp(inp.mrrQ)):null,priorMrr:inp.prior!=null?String(inp.prior):null,slaAnnual:inp.isSla&&inp.mrrQ?E27.toDollars(E27.roundHalfUp(E27.mul(inp.mrrQ,E27.R(12n)))):null,margin:inp.qm.margin,shares:[{email:'f',bp:10000}]}); newC+=r.totalCents; }catch(_){} });
  box.innerHTML=`Transaction-derived forecast (this draft applied to ${y} sales as entered): <b>${E27.fmtCents(newC)}</b> new-sale commission. <span class="qctx">Assumptions: renewal volume, expansion volume, term mix and retention are not yet stated (open business input) — renewal, expansion and portfolio bonus are therefore not included.</span>`;
}

/* ---------------- In-app guide (ADM-03 "remove conflicting preset help text", AGR-04) ----------------
   Every number is read from the plan VERSION's stored config, never from a preset or default.
   Hunter / Farmer render the same structure with "Not set" wherever their config is empty, so the
   guide fills in by itself once an administrator enters and publishes their numbers.            */
let GUIDE_FAMILY=null;
const GUIDE_FAMS=['Hybrid','Hunter','Farmer'];
function guideStyles27(){
  if(document.getElementById('guide27css'))return; const st=document.createElement('style'); st.id='guide27css';
  st.textContent=`.gd27-fams{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.gd27-fams button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px;font-size:12.5px;cursor:pointer;color:var(--ink)}
  .gd27-fams button.on{background:var(--orange);border-color:var(--orange);color:#fff;font-weight:600}.gd27-fams small{opacity:.8;font-weight:400;margin-left:4px}
  .gd27-unset{display:inline-block;white-space:nowrap;background:#f3f4f6;color:#6b7280;border:1px dashed #cbd5e1;border-radius:4px;padding:0 6px;font-size:12px;font-weight:600}
  .gd27-banner{border-radius:8px;padding:10px 13px;font-size:13px;margin:0 0 14px;line-height:1.5}.gd27-banner.ok{background:#ecfdf5;border:1px solid #a7f3d0}.gd27-banner.warn{background:#fffbeb;border:1px solid #fde68a}.gd27-banner.bad{background:#f8fafc;border:1px solid #cbd5e1}
  .gd27-hist{margin-top:26px;border-top:1px solid var(--line);padding-top:12px}.gd27-hist>summary{cursor:pointer;font-weight:700;font-size:13.5px;color:var(--ink)}.gd27-hist[open]>summary{margin-bottom:10px}
  .gd27-note{font-size:12.5px;color:var(--muted)}`;
  document.head.appendChild(st);
}
function guideVersionFor27(fam){
  const me=String(CURRENT_EMAIL||'').toLowerCase(), today=E27.businessToday();
  const mine=P27.assignments.filter(x=>String(x.email).toLowerCase()===me&&(!x.effective_to||today<x.effective_to)).map(x=>versionById(x.plan_version_id)).filter(v=>v&&v.family===fam);
  if(mine.length)return {v:mine[0],mine:true};
  const vs=P27.versions.filter(v=>v.family===fam).sort((a,b)=>b.version_no-a.version_no);
  const live=vs.filter(v=>v.status==='published'&&(!v.effective_date||v.effective_date<=today));
  return {v:live[0]||vs.find(v=>v.status==='published')||vs.find(v=>v.status==='draft')||vs[0]||null,mine:false};
}
function guide27HTML(fam){
  const {v,mine}=guideVersionFor27(fam); const c=(v&&v.config)||{}; const ph=!v||!!c.placeholder;
  const U='<span class="gd27-unset">Not set</span>';
  const num=x=>(x===null||x===undefined||x===''||isNaN(+x))?null:+x;
  const xm=x=>num(x)==null?U:`<b>${+(+x).toFixed(4)}×</b>`;
  const pc=(x,dp=2)=>num(x)==null?U:`<b>${+(+x*100).toFixed(dp)}%</b>`;
  const usd=n=>'$'+(Math.round(n*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const $$=x=>num(x)==null?U:`<b>${usd(+x)}</b>`;
  const terms=[12,24,36,48,60], nm=c.newMult||{}, sl=c.slaNewMult||{};
  const t1=num(c.tranche1Pct), t2=num(c.tranche2Pct), floor=num(c.minMargin), target=num(c.targetMargin), ren=num(c.renewalMult), slaRen=num(c.slaRenewalMult);
  const pcal=P27.settings.payout_calendar||{}, run=E27.payoutCalendar(pcal);
  const off=num(c.releaseOffsetMonths);
  // ---- banner
  let banner, kind;
  if(!v){ kind='bad'; banner=`<b>${fam}</b> has no plan version yet.`; }
  else if(ph){ kind='bad'; banner=`<b>${fam}</b> — the structure is set up, but the numbers <b>haven't been entered yet</b>. Anything marked ${U} is waiting on your administrator. Nothing calculates under ${fam} until a complete version is published, assigned and acknowledged.`; }
  else if(v.status==='published'){ const r=resolveRevised(CURRENT_EMAIL); kind='ok';
    banner=`<b>${esc(v.label)}</b> · live from <b>${esc(v.effective_date||'—')}</b>${v.approved_by?` · approved by ${esc(v.approved_by)}`:''}.`+
      (mine?(r.state==='ok'?' You are assigned to this plan and have acknowledged it.':r.state==='ack_required'?' You are assigned to this plan — <b>acknowledge its terms</b> before anything calculates.':''):''); }
  else { kind='warn'; banner=`<b>${esc(v.label)}</b> is a <b>draft</b> — these are the proposed numbers. Nothing is calculated under it until it is published, assigned to you, and you acknowledge it. Deals before ${REVISED_CUTOVER.replace(/^(\d{4})-(\d\d)-(\d\d)$/,(m,y,mo,d)=>`${+mo}/${+d}/${y}`)} stay on the historical rules below.`; }
  const famBtns=`<div class="gd27-fams">${GUIDE_FAMS.map(f=>{ const s=famStatus(f); return `<button data-gdfam="${f}" class="${f===fam?'on':''}">${f}<small>${esc(s.txt.split(' · ')[0])}</small></button>`; }).join('')}</div>`;
  const intro={Hybrid:`Hybrid is the combined role: ${num(c.allocation&&c.allocation.hunter)==null?U:pc(c.allocation.hunter,0)} new-customer acquisition and ${num(c.allocation&&c.allocation.farmer)==null?U:pc(c.allocation.farmer,0)} managing existing accounts.`,
    Hunter:`Hunter is the new-customer acquisition role.${c.allocation?` Role split: ${pc(c.allocation.hunter,0)} acquisition, ${pc(c.allocation.farmer,0)} account management.`:''}`,
    Farmer:`Farmer is the account-management role — renewing and growing existing customers.${c.allocation?` Role split: ${pc(c.allocation.hunter,0)} acquisition, ${pc(c.allocation.farmer,0)} account management.`:''}`}[fam];
  // ---- examples (display only; the engine computes the authoritative amounts in exact decimals)
  const m36=num(nm[36]);
  const ex1=m36==null?`A $100/mo, 36-month deal at or above the margin floor earns $100 × ${U} = ${U}.`
    :`A <b>$100/mo, 36-month</b> deal at or above the margin floor earns $100 × ${xm(m36)} = <b>${usd(100*m36)}</b>${t1!=null&&t2!=null?` — <b>${usd(100*m36*t1)}</b> first tranche and <b>${usd(100*m36-100*m36*t1)}</b> second tranche`:''}.`+
     `<br><span class="gd27-note">Same $100/mo on other terms: ${[12,24,48,60].map(t=>`${t} mo ${num(nm[t])==null?U:usd(100*+nm[t])}`).join(' · ')}.</span>`;
  const ex2=(m36==null||ren==null)?`Renewing $100/mo up to $130/mo for 36 months pays the renewal multiple (${U}) on the retained $100 plus the new-sale multiple on the added $30.`
    :`Renewing <b>$100/mo → $130/mo</b> for 36 months: ${usd(100)} retained × ${xm(ren)} = ${usd(100*ren)}, plus the ${usd(30)} increase × ${xm(m36)} = ${usd(30*m36)} → <b>${usd(100*ren+30*m36)}</b> total. No conversion bonus.`;
  const s36=num(sl[36]);
  const ex3=s36==null?`A $1,200/yr SLA on 36 months: $1,200 ÷ 12 = $100/mo equivalent × ${U}.`
    :`A <b>$1,200/yr SLA</b> on 36 months: $1,200 ÷ 12 = $100/mo equivalent × ${xm(s36)} = <b>${usd(100*s36)}</b>.`;
  const sal=num(c.salaryAssumption), grr=c.grrBonus||null, nrr=c.nrrBonus||null;
  const tierPct=(tiers,val)=>{ if(!tiers)return null; let p=0; tiers.forEach(t=>{ if(val>=+t.min)p=Math.max(p,+t.pct); }); return p; };
  const gP=tierPct(grr,0.98), nP=tierPct(nrr,1.05);
  const ex4=(sal==null||gP==null||nP==null)?`Bonus example: a full year at ${sal==null?U:usd(sal)} salary with 98% GRR and 105% NRR — tiers ${U}.`
    :`A full year at <b>${usd(sal)}</b> with <b>98% GRR</b> and <b>105% NRR</b>: ${usd(sal*gP)} + ${usd(sal*nP)} = <b>${usd(sal*gP+sal*nP)}</b>.`;
  const tierRows=(tiers,label)=>tiers&&tiers.length?tiers.map(t=>`<tr><td>${label} ≥ ${+(+t.min*100).toFixed(1)}%</td><td>${pc(t.pct,1)} of salary</td></tr>`).join(''):`<tr><td>${label} tiers</td><td>${U}</td></tr>`;
  return famBtns+`<div class="gd27-banner ${kind}">${banner}</div>
  <h3>The big idea</h3>
  <p>${intro} Your commission is a <b>multiple of the monthly recurring revenue (MRR)</b> you sell, set by the contract term. It is earned in two pieces once the customer is actually paying, and paid quarterly.</p>
  <div class="guide-callout"><b>Commission = eligible MRR × term multiple × margin gate.</b> The percentages of contract value shown below are for reference only — the multiple is what's paid.</div>
  <h3>Term multiples</h3>
  <table class="guide-table"><thead><tr><th>Term</th><th>New sale or expansion</th><th>Manual renewal</th><th>Same as % of TCV</th></tr></thead><tbody>
  ${terms.map(t=>`<tr><td>${t} months</td><td>${xm(nm[t])} MRR</td><td>${xm(c.renewalMult)} retained MRR</td><td>${num(nm[t])==null?U:(+nm[t]/t*100).toFixed(4)+'%'}</td></tr>`).join('')}
  </tbody></table>
  <p class="gd27-note">Terms over 60 months are capped at ${xm(c.newMultCapAbove60!=null?c.newMultCapAbove60:nm[60])}. Other non-standard terms (for example 30 months) need an approved term mapping — they are never rounded down to the next bracket.</p>
  <h3>Margin gate</h3>
  <p>Gross margin is measured on direct cost only, over the committed term. At or above ${pc(floor,0)} the deal qualifies at <b>1.0×</b>; below it pays <b>$0</b>. ${target==null?'':`The target is ${pc(target,0)}.`} If margin is <b>unknown</b> — costs not entered or not verified — the deal can't qualify until they are. It shows <i>Missing cost verification</i>, never a silent $0.</p>
  <h3>Example — a new sale</h3>
  <div class="guide-callout">${ex1}</div>
  <h3>Renewals and expansions</h3>
  <p>A <b>manual renewal</b> pays ${xm(ren)} on the MRR you keep. Any <b>increase</b> pays the new-sale multiple on the increase only — never both on the same dollars. An expansion without a renewal is the new-sale multiple on the added MRR.</p>
  <div class="guide-callout">${ex2}</div>
  <p class="gd27-note">Auto-renewals pay ${xm(c.autoRenewalMult)}, automatic price escalators ${xm(c.escalatorMult)} and term conversions ${xm(c.termConversionMult)}. A win-back of a cancelled agreement counts as a new sale. Saving an agreement never creates commission — use the <b>New sale</b>, <b>Expansion</b>, <b>Renewal</b> or <b>SLA</b> buttons on the agreement.</p>
  <h3>SLA agreements</h3>
  <p>SLAs use the same engine: annual value ÷ 12 gives an MRR equivalent, then the SLA multiple for the term.</p>
  <table class="guide-table"><thead><tr><th>Term</th><th>New SLA</th><th>≈ % of annual value</th></tr></thead><tbody>
  ${terms.map(t=>`<tr><td>${t} months</td><td>${xm(sl[t])}</td><td>${num(sl[t])==null?U:(+sl[t]/12*100).toFixed(2)+'%'}</td></tr>`).join('')}
  <tr><td>Renewal, any term</td><td>${xm(slaRen)} retained</td><td>${slaRen==null?U:(slaRen/12*100).toFixed(2)+'%'}</td></tr></tbody></table>
  <div class="guide-callout">${ex3}</div>
  <h3>When it's earned — two tranches</h3>
  <table class="guide-table"><thead><tr><th>Piece</th><th>Share</th><th>Earned when</th></tr></thead><tbody>
  <tr><td><b>First tranche</b></td><td>${pc(t1,0)}</td><td>The signed agreement is activated <b>and</b> its first real, non-zero invoice is fully collected.</td></tr>
  <tr><td><b>Second tranche</b></td><td>${pc(t2,0)}</td><td>${off==null?U:`<b>${off} calendar months</b>`} after the first actual invoice, with the account still active <b>and</b> every invoice due by then paid.</td></tr>
  </tbody></table>
  <p class="gd27-note">Both conditions are required for the second tranche — time alone never releases it. The second tranche is the total less the first, so the two always add up to the cent.</p>
  <h3>What counts as "collected"</h3>
  <p>Only <b>real cash</b>: a Vista receipt, or a collection verified on the agreement's Billing tab against Vista's SM Agreements ▸ Invoices tab. A billing row that's just <b>Scheduled</b> counts for nothing, a date passing never marks anything paid, and a <b>zero balance is not the same as collected</b> — an invoice voided or settled by a credit note doesn't trigger commission.</p>
  <h3>When you get paid</h3>
  <p>Earned amounts are paid <b>quarterly</b>, within <b>${+pcal.payWithinDays||30} days</b> after quarter end. Collections must be verified within <b>${+pcal.verifyWithinDays||15} days</b> after quarter end to make that quarter's run. Next run: <b>Q${run.q} ${run.y}</b> — verification cutoff <b>${run.cutoff}</b>, pay by <b>${run.payBy}</b>. Anything not verified by the cutoff rolls to the next run; it isn't lost.</p>
  <h3>Quota and accelerator</h3>
  <p>New-MRR quota: ${$$(c.quotaMonthlyMrr)} per month${num(c.quotaMonthlyMrr)==null?'':` (${usd(+c.quotaMonthlyMrr*12)} a year)`}. Above quota the accelerator is ${xm(c.accelMultiplier)}${num(c.accelMultiplier)===1?' — currently dormant, so commission above quota is paid at the normal rate':''}. There is no annual cap.</p>
  <h3>Portfolio bonus — retention</h3>
  <p>Paid on the calendar year${c.bonusPayBy?`, by ${esc(c.bonusPayBy.replace(/^(\d\d)-(\d\d)$/,(m,mo,d)=>['','January','February','March','April','May','June','July','August','September','October','November','December'][+mo]+' '+(+d)))}`:''}. Use the highest tier you reach on each measure and add the two together. <b>GRR</b> = your opening customers' MRR kept (after churn and downgrades). <b>NRR</b> adds growth from those same customers. New customers don't count in either.</p>
  <table class="guide-table"><thead><tr><th>Measure</th><th>Bonus</th></tr></thead><tbody>${tierRows(grr,'GRR')}${tierRows(nrr,'NRR')}</tbody></table>
  <p class="gd27-note">Based on base salary actually paid over the year${sal==null?'':` (planning assumption ${usd(sal)})`}. If a measure can't be calculated it shows <i>Unknown</i>, never 0%.</p>
  <div class="guide-callout">${ex4}</div>
  <h3>Cancellations and corrections</h3>
  <p>If an agreement cancels <b>before</b> a tranche is earned, that tranche stops. Anything after that — refunds, credits, cancellation after earning, leaving the company — needs a documented decision under the written plan. Nothing is ever deducted from salary or clawed back automatically, and earned money is never silently forfeited. Corrections are added as new, linked entries; the original record is kept.</p>
  <h3>What the statuses mean</h3>
  <table class="guide-table"><tbody>
  <tr><td><b>Expected commission</b></td><td>Calculated, but not earned yet.</td></tr>
  <tr><td><b>Conditional holdback</b></td><td>The second tranche, waiting on its time and collection conditions.</td></tr>
  <tr><td><b>Pending verification</b></td><td>Earned on paper, but the collection hasn't been verified for this run.</td></tr>
  <tr><td><b>Earned unpaid</b></td><td>Earned and owed — waiting for the next payout run.</td></tr>
  <tr><td><b>Ready to pay / Excluded</b></td><td>How each amount sits in the quarter's payout run; excluded amounts show the reason.</td></tr>
  <tr><td><b>Plan not configured</b></td><td>No published, assigned plan covers the deal. Shown instead of a misleading $0.</td></tr>
  <tr><td><b>Blocked — acknowledgement</b></td><td>You haven't acknowledged the plan's written terms yet.</td></tr>
  </tbody></table>
  <h3>Where to see your money</h3>
  <table class="guide-table"><tbody>
  <tr><td><b>Quarter view</b></td><td>The payout run: Ready to pay, Pending verification, Excluded — with reasons.</td></tr>
  <tr><td><b>Agreement ▸ Commission history</b></td><td>Every event and tranche on that agreement, with dates and evidence.</td></tr>
  <tr><td><b>Worklist</b></td><td>Anything waiting on a person: collections to verify, costs to approve, import issues.</td></tr>
  </tbody></table>`;
}
(function installGuide27(){
  const legacyRender=window.renderGuide;
  window.renderGuide=function(){
    const body=document.querySelector('#guideScrim .guide-body'); if(!body)return;
    guideStyles27();
    if(!document.getElementById('guide27')){
      const hist=document.createElement('details'); hist.className='gd27-hist'; hist.id='guideHist27';
      hist.innerHTML=`<summary>Historical rules — deals before ${REVISED_CUTOVER.replace(/^(\d{4})-(\d\d)-(\d\d)$/,(m,y,mo,d)=>`${+mo}/${+d}/${y}`)}</summary><p class="gd27-note">Agreements signed before the revised plan took effect keep the plan that applied when they were sold, for both pieces. This is how those older plans work.</p>`;
      while(body.firstChild)hist.appendChild(body.firstChild);
      const g=document.createElement('div'); g.id='guide27'; body.appendChild(g); body.appendChild(hist);
      body.addEventListener('click',e=>{ const b=e.target.closest('[data-gdfam]'); if(b){ GUIDE_FAMILY=b.dataset.gdfam; window.renderGuide(); } });
    }
    try{ if(typeof legacyRender==='function')legacyRender(); }catch(_){}
    const g=document.getElementById('guide27');
    if(!P27.ready){ g.innerHTML='<div class="gd27-banner bad">The revised plan tables aren\'t available, so only the historical rules are shown.</div>'; document.getElementById('guideHist27').open=true; return; }
    if(!GUIDE_FAMILY){ const me=String(CURRENT_EMAIL||'').toLowerCase(); const a=P27.assignments.find(x=>String(x.email).toLowerCase()===me&&(!x.effective_to||E27.businessToday()<x.effective_to)); const v=a&&versionById(a.plan_version_id); GUIDE_FAMILY=(v&&v.family)||compFamilyOf(me)||'Hybrid'; }
    g.innerHTML=guide27HTML(GUIDE_FAMILY);
    const sub=document.querySelector('#guideScrim .guide-head .sub'); if(sub)sub.textContent='Read straight from the plan settings in Admin — no finance background needed.';
  };
})();

/* Agreement ▸ Deal: show the selected owner's comp plan under "Assigned to" (AGR-04: changing the owner never moves
   commission that was already earned — earned entries live in the ledger against the employee who earned them). */
(function installOwnerPlan27(){
  const orig=window.openModal; if(typeof orig!=='function')return;
  const paint=a=>{ const sel=$('f_owner'), fld=$('ownerFld'); if(!sel||!fld)return; let d=$('ownerPlan27');
    if(!d){ d=document.createElement('div'); d.id='ownerPlan27'; d.className='qctx'; d.style.cssText='margin-top:4px;font-size:11.5px;line-height:1.4'; fld.appendChild(d); }
    const upd=()=>{ d.innerHTML=compPlanLine27(sel.value,a)+(a&&a.owner_email&&String(a.owner_email).toLowerCase()!==String(sel.value).toLowerCase()?'<br>Changing the owner applies to commission not yet earned; anything already earned stays with the original owner.':''); };
    sel.onchange=upd; upd(); };
  window.openModal=function(id,promote){ const r=orig.apply(this,arguments); try{ if(P27.ready)paint(AGREEMENTS.find(x=>x.id===id)||null); }catch(_){} return r; };
})();

/* =====================================================================================================
   Usability pass (P1RMR-57): close-the-deal screen, rep "Mark won", rep read-only agreements, payment-state
   Quarter view, one-step onboarding, rep tab set, plain-language screens.
   ===================================================================================================== */
window.todayISO=function(){ return E27.businessToday(); };
(function css27(){ const st=document.createElement('style'); st.id='cd27css'; st.textContent='.cd27grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px}.cd27grid .fld.full{grid-column:1/-1}.cd27grid .fld{margin:0}#emp27 select.cfg-in{min-width:128px}@media(max-width:720px){.cd27grid{grid-template-columns:1fr}#cdScrim27 .modal-body{grid-template-columns:1fr!important}}'; document.head.appendChild(st); })();              // dates default to the Pacific business day, not UTC
const BUILTIN_CONNECTION=false;                                          // flipped on once migration_v23_access.sql is applied
const BUILTIN_URL='https://kjzugbyudhswdmhgnstp.supabase.co', BUILTIN_KEY='';
if(BUILTIN_CONNECTION&&BUILTIN_KEY&&!(LS.get('rmr_url')||'').trim()){ LS.set('rmr_url',BUILTIN_URL); LS.set('rmr_key',BUILTIN_KEY); }

const REQ_CODE='\\b(?:ADM|AGR|BIL|BON|CAT|COM|CST|LED|MIG|NAV|PAY|REL|TEC|UX|VIS|F)-\\d{2}';
function plainText27(s){ if(!s)return s; return String(s)
  .replace(new RegExp(`\\s*\\((?:${REQ_CODE})(?:\\s*[,/;·&]\\s*(?:${REQ_CODE}|and\\s+${REQ_CODE}))*\\)`,'g'),'')
  .replace(new RegExp(`^\\s*${REQ_CODE}(?:\\s*[·,/]\\s*${REQ_CODE})*\\s*$`),''); }

function friendlyCond27(t){ t=plainText27(String(t||'')); let m;
  if(/no issued first invoice yet/.test(t))return "The first invoice hasn't been issued yet.";
  if(/no first actual billing/.test(t))return 'Starts counting from the first invoice.';
  if((m=t.match(/Missing receipt evidence for first invoice (\S+?)\.?$/)))return `Waiting for invoice ${m[1]} to be paid and verified.`;
  if((m=t.match(/Time condition not met — (\d{4}-\d{2}-\d{2})/)))return `Earliest date: ${m[1]} (three months after the first invoice).`;
  if((m=t.match(/^(\d+) invoice\(s\) due through (\S+) without confirmed collection: (.*)$/)))return `${m[1]} invoice${m[1]==='1'?'':'s'} due by ${m[2]} not yet paid: ${m[3]}`;
  if(/Agreement is not activated/.test(t))return "The agreement isn't activated yet.";
  if(/settled by credit/.test(t))return 'The first invoice was settled by a credit, which is not a payment.';
  if(/Cancelled before earning/.test(t))return 'Cancelled before it was earned — this payment stops.';
  return t; }
/* ---- Quarter view lines for revised deals: payment 1 / payment 2 with their real state ---- */
function revisedQuarterLines27(a,c){
  const calc=c.revisedCalc; if(!calc)return [];
  const tr=c.tranches||{t1:{conditions:[]},t2:{conditions:[]}}; const ev=committedEventsFor(a).slice(-1)[0];
  const led=ev?P27.ledger.filter(x=>x.event_uid===ev.event_uid):[];
  const qiOf=iso=>iso?qIndexFromYM(+iso.slice(0,4),+iso.slice(5,7)-1):null;
  const fb=a.first_billing_date?String(a.first_billing_date).slice(0,10):null, act=a.activation_date?String(a.activation_date).slice(0,10):null;
  const out=[];
  [[1,calc.tranche1Cents,tr.t1],[2,calc.tranche2Cents,tr.t2]].forEach(([n,cents,t])=>{
    const amount=Number(cents)/100; if(!(amount>0))return; t=t||{conditions:[]};
    const has=st=>led.some(x=>+x.tranche===n&&x.stage===st);
    const rstate=has('paid')?'paid':has('payable')?'approved':(t.state==='Earned'?'earned':'expected');
    let date=t.earnedDate||null, note;
    if(rstate==='paid')note='paid'; else if(rstate==='approved')note='approved for payroll'; else if(rstate==='earned')note=`earned ${t.earnedDate}`;
    else { note=!ev?'Sale not recorded yet.':friendlyCond27((t.conditions||[])[0]||'Conditions not met yet.');
      if(n===1)date=fb||act; else date=t.timeDate||(fb?E27.addMonthsClamp(fb,3):(act?E27.addMonthsClamp(act,3):null)); }
    out.push({a,c,type:'rev'+n,piece:n,amount,rstate,paid:rstate==='paid',note,qi:qiOf(date),frozen:false});
  });
  return out;
}
const RSTATE27={expected:['c-maturing','Expected'],earned:['c-payable','Earned'],approved:['c-payable','Approved for payroll'],paid:['c-paid','Paid']};
function revisedPieceRow27(l){
  const m=RSTATE27[l.rstate]||RSTATE27.expected;
  return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;flex-wrap:wrap;border-top:1px dashed var(--line)">
    <span style="min-width:118px"><span class="type-tag" style="background:#eef1f6;color:var(--navy)">Payment ${l.piece} of 2</span></span>
    <b class="mono" style="min-width:72px;text-align:right">${fmt2(l.amount)}</b>
    <span style="flex:1;min-width:130px;color:var(--muted);font-size:12px">${esc(l.note)}</span>
    <span class="chip ${m[0]}" style="font-size:9px">${m[1]}</span></div>`;
}
function revisedGroupMeta27(items){ const st=items.map(l=>l.rstate);
  if(st.every(s=>s==='paid'))return {cls:'c-paid',label:'Paid'}; if(st.some(s=>s==='earned'||s==='approved'))return {cls:'c-payable',label:'Earned'}; return {cls:'c-maturing',label:'Expected'}; }

/* ---- Close the deal: one screen behind Win ---- */
function cdRow27(){ const v=id=>($(id)||{}).value, n=id=>{ const x=v(id); return x===''||x==null?0:+x; };
  const hrs=n('cd_hrs');
  return { agreement_number:(v('cd_num')||'').trim(), customer_name:(v('cd_cust')||'').trim(), owner_email:v('cd_owner')||null,
    category:v('cd_cat')||'rmr', agreement_type:v('cd_type')||'manual', autorenew:v('cd_type')==='auto',
    monthly_rmr:n('cd_rmr'), contract_term:n('cd_term'), activation_date:v('cd_date')||null, first_billing_date:v('cd_bill')||null,
    loaded_labor_rate:n('cd_rate'), labor_schedule:hrs>0?{repeat:true,rows:[{month:12,hours:hrs,label:'Annual service'}]}:{repeat:true,rows:[]},
    inspection_frequency:hrs>0?1:0, hours_per_inspection:hrs,
    material_cost_annual:n('cd_mat'), monitoring_cost_annual:n('cd_mon'), software_cost_annual:n('cd_soft'), subcontractor_annual_cost:n('cd_sub'), other_direct_annual:n('cd_other'),
    cost_confirmed_zero:!!($('cd_zero')&&$('cd_zero').checked), stage:'won' }; }
function cdEvaluate27(opp){
  const row=cdRow27(); const a2=Object.assign({},opp||{},row); const out={row,a2,errors:[],blockers:[],calc:null,margin:null,cost:null,res:null};
  if(!row.agreement_number)out.errors.push('Agreement # is required.'); if(!row.customer_name)out.errors.push('Customer is required.');
  if(!(row.monthly_rmr>0))out.errors.push('Monthly RMR must be more than $0.'); if(![12,24,36,48,60].includes(row.contract_term))out.errors.push('Pick a term.');
  if(!row.activation_date)out.errors.push('Signed / activation date is required.'); if(!row.owner_email)out.errors.push('Pick who the deal is assigned to.');
  const dup=AGREEMENTS.find(x=>x.id!==(opp&&opp.id)&&String(x.agreement_number||'').trim()===row.agreement_number&&row.agreement_number); if(dup)out.errors.push(`Agreement #${row.agreement_number} already exists (${dup.customer_name||'—'}).`);
  out.cost=E27.modelledCost(a2); if(out.cost.state!=='complete')out.blockers.push(row.cost_confirmed_zero?'':'Enter the direct costs, or tick "No direct costs".');
  out.res=resolveRevised(row.owner_email,row.activation_date||E27.businessToday());
  if(out.res.state!=='ok')out.blockers.push(plainText27(out.res.reason).replace(/^Plan not configured — /,'').replace(/^Blocked — /,''));
  if(!out.errors.length&&out.cost.state==='complete'){
    const mrrQ=E27.eligibleMrrCentsRational(a2); const qm=E27.qualificationMargin(mrrQ,row.contract_term,out.cost); out.margin=qm.margin;
    const fam=compFamilyOf(row.owner_email)||'Hybrid'; const plan=out.res.state==='ok'?out.res.version:(out.res.version||liveVersionOf(fam)||latestVersion(fam));
    if(plan&&!(plan.config&&plan.config.placeholder)){ try{ out.calc=E27.calculate({plan:planVersionPlain(plan),eventType:row.category==='sla'?'sla_new':'new_sale',term:row.contract_term,category:row.category,
      newMrr:E27.toDollars(E27.roundHalfUp(mrrQ)),priorMrr:null,slaAnnual:row.category==='sla'?E27.toDollars(E27.roundHalfUp(E27.mul(mrrQ,E27.R(12n)))):null,margin:qm.margin,shares:[{email:String(row.owner_email).toLowerCase(),bp:10000}]}); out.planLabel=plan.label; }
      catch(e){ out.blockers.push(plainText27(e.message)); } }
  }
  out.blockers=out.blockers.filter(Boolean); return out;
}
function openCloseDeal27(oppId){
  if(!can('editAgreements')){ toast('Only a manager, executive or admin can set up a won deal.'); return; }
  const opp=AGREEMENTS.find(x=>String(x.id)===String(oppId)); if(!opp){ toast('Opportunity not found'); return; }
  const req=P27.worklist.find(w=>w.item_uid===`won:${opp.id}`&&w.status==='open'); const rd=(req&&req.detail)||{};
  const rates=AGREEMENTS.filter(x=>+x.loaded_labor_rate>0).sort((x,y)=>String(y.updated_at||'').localeCompare(String(x.updated_at||''))); const rate0=rates[0]?+rates[0].loaded_labor_rate:'';
  const owners=[...new Set([...(KNOWN_USERS||[]),opp.owner_email].filter(Boolean))].sort();
  let sc=$('cdScrim27'); if(sc)sc.remove(); sc=document.createElement('div'); sc.id='cdScrim27'; sc.className='scrim show';
  const fld=(lab,html,hint)=>`<div class="fld"><label>${lab}${hint?` <span class="hint">${hint}</span>`:''}</label>${html}</div>`;
  const num=(id,val,ph)=>`<input id="${id}" type="number" step="0.01" min="0" value="${val??''}" placeholder="${ph||''}">`;
  sc.innerHTML=`<div class="modal" style="max-width:860px"><div class="modal-head"><div><h3 style="margin:0">Close the deal — ${esc(opp.customer_name||'')}</h3>
    <div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(opp.opportunity_number||'')}${opp.estimate_ref?' · estimate '+esc(opp.estimate_ref):''}${opp.est_monthly_rmr?' · est. '+fmt(+opp.est_monthly_rmr)+'/mo':''}${req?` · marked won by ${esc(rd.requested_by||'')}${rd.signed_date?' (signed '+esc(rd.signed_date)+')':''}${rd.note?' — '+esc(rd.note):''}`:''}</div></div><button class="x" id="cdClose27">×</button></div>
   <div class="modal-body" style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:18px">
    <div>
     <div class="fieldset-h" style="margin-top:0">1 · The agreement</div>
     <div class="cd27grid">
      ${fld('Agreement #',`<input id="cd_num" value="${esc(opp.agreement_number||nextAgreementNumber())}">`)}
      ${fld('Assigned to',`<select id="cd_owner">${owners.map(e=>`<option ${String(e).toLowerCase()===String(opp.owner_email||'').toLowerCase()?'selected':''}>${esc(e)}</option>`).join('')}</select>`)}
      <div class="fld full"><label>Customer</label><input id="cd_cust" value="${esc(opp.customer_name||'')}"></div>
      ${fld('Monthly RMR',num('cd_rmr',rd.final_mrr||(+opp.monthly_rmr>0?opp.monthly_rmr:(opp.est_monthly_rmr||'')),'0.00'),'$ / month')}
      ${fld('Term',`<select id="cd_term"><option value="">Pick…</option>${[12,24,36,48,60].map(t=>`<option value="${t}" ${+opp.contract_term===t?'selected':''}>${t} months</option>`).join('')}</select>`)}
      ${fld('Signed / activation date',`<input id="cd_date" type="date" value="${esc(rd.signed_date||(opp.activation_date?String(opp.activation_date).slice(0,10):E27.businessToday()))}">`)}
      ${fld('First billing date',`<input id="cd_bill" type="date" value="${esc(opp.first_billing_date?String(opp.first_billing_date).slice(0,10):'')}">`,'optional')}
      ${fld('Type',`<select id="cd_cat"><option value="rmr">RMR</option><option value="sla" ${opp.category==='sla'?'selected':''}>SLA (enter annual ÷ 12)</option></select>`)}
      ${fld('Renewal',`<select id="cd_type"><option value="manual">Manual renewal</option><option value="auto" ${opp.agreement_type==='auto'?'selected':''}>Auto-renewal</option></select>`)}
     </div>
     <div class="fieldset-h">2 · Direct costs <span class="hint">per year — drives the margin check</span></div>
     <div class="cd27grid">
      ${fld('Labour hours / year',num('cd_hrs',opp.hours_per_inspection&&opp.inspection_frequency?(+opp.hours_per_inspection*+opp.inspection_frequency):'','e.g. 8'))}
      ${fld('Loaded labour rate',num('cd_rate',+opp.loaded_labor_rate>0?opp.loaded_labor_rate:rate0,'$/hr'),'$ / hour')}
      ${fld('Materials',num('cd_mat',opp.material_cost_annual||''))}${fld('Monitoring',num('cd_mon',opp.monitoring_cost_annual||''))}
      ${fld('Software',num('cd_soft',opp.software_cost_annual||''))}${fld('Subcontractor',num('cd_sub',opp.subcontractor_annual_cost||''))}
      ${fld('Other direct',num('cd_other',opp.other_direct_annual||''))}
      <div class="fld" style="align-self:end"><label style="display:flex;gap:6px;align-items:center;font-weight:500"><input type="checkbox" id="cd_zero" style="width:auto"> No direct costs on this deal</label></div>
      <div class="fld full"><label>Cost evidence <span class="hint">optional — quote, vendor invoice…</span></label><input id="cd_evid" placeholder="e.g. SSE-014-26 cost sheet"></div>
     </div>
    </div>
    <div><div class="fieldset-h" style="margin-top:0">3 · Commission</div><div id="cdPrev27" style="font-size:13px;line-height:1.55"></div></div>
   </div>
   <div class="modal-foot" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn-ghost" id="cdCancel27">Cancel</button><button class="btn-ghost" id="cdFull27" title="Open the full agreement editor with every field">Full editor…</button>
    <div style="margin-left:auto;display:flex;gap:8px"><button class="btn-ghost" id="cdSave27">Save without recording</button><button class="btn-primary" id="cdGo27">Approve &amp; record sale</button></div></div></div>`;
  document.body.appendChild(sc);
  const close=()=>sc.remove();
  const paint=()=>{ const r=cdEvaluate27(opp); const box=$('cdPrev27'); const c=r.calc;
    const pct=r.margin?(Number(r.margin.n*10000n/r.margin.d)/100).toFixed(1)+'%':'—';
    box.innerHTML=`<div style="background:#f7f7f8;border:1px solid var(--line);border-radius:10px;padding:12px 14px">
      <div class="qctx">${esc(r.planLabel||'')}${r.res&&r.res.state==='ok'?'':' · preview'}</div>
      <div style="display:flex;justify-content:space-between;margin-top:6px"><span>Margin</span><b>${pct}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Commission</span><b style="font-size:20px">${c?E27.fmtCents(c.totalCents):'—'}</b></div>
      ${c?`<div style="border-top:1px dashed var(--line);margin-top:8px;padding-top:8px"><div style="display:flex;justify-content:space-between"><span>Payment 1 — when the first invoice is paid</span><b>${E27.fmtCents(c.tranche1Cents)}</b></div>
       <div style="display:flex;justify-content:space-between"><span>Payment 2 — 3 months after first billing, account current</span><b>${E27.fmtCents(c.tranche2Cents)}</b></div></div>`:''}
      ${c&&c.totalCents===0n?'<div style="color:var(--held);margin-top:6px">Below the margin floor — this sale pays $0.</div>':''}</div>
      ${r.errors.length?`<div style="margin-top:10px;color:var(--held);font-size:12.5px">${r.errors.map(esc).join('<br>')}</div>`:''}
      ${r.blockers.length?`<div style="margin-top:10px;font-size:12.5px;color:var(--orange)"><b>Can't record the sale yet:</b><br>${r.blockers.map(esc).join('<br>')}<div class="qctx" style="margin-top:4px">You can still save the agreement now; it goes on the Worklist as "Sale not recorded yet".</div></div>`:''}`;
    $('cdGo27').disabled=!!(r.errors.length||r.blockers.length||!c); $('cdSave27').disabled=!!r.errors.length; return r; };
  sc.querySelectorAll('input,select').forEach(el=>{ el.addEventListener('input',paint); el.addEventListener('change',paint); });
  $('cdClose27').onclick=close; $('cdCancel27').onclick=close; sc.onclick=e=>{ if(e.target===sc)close(); };
  $('cdFull27').onclick=()=>{ close(); _origOpenModal27(opp.id,true); };
  const save=async(record)=>{ const r=paint(); if(r.errors.length)return;
    const btn=record?$('cdGo27'):$('cdSave27'); btn.disabled=true; btn.textContent=record?'Recording…':'Saving…';
    try{ await upsert(Object.assign({id:opp.id},r.row)); }catch(e){ toast(e.message||'Save failed'); btn.disabled=false; btn.textContent=record?'Approve & record sale':'Save without recording'; return; }
    audit('Agreement created from opportunity','Agreements',r.row.agreement_number,{stage:opp.stage},{agreement_number:r.row.agreement_number,customer:r.row.customer_name,mrr:r.row.monthly_rmr,term:r.row.contract_term,owner:r.row.owner_email},null);
    await load(); let ok=true;
    if(record){ const a=AGREEMENTS.find(x=>String(x.id)===String(opp.id));
      const keys=['loaded_labor_rate','labor_schedule','inspection_frequency','hours_per_inspection','material_cost_annual','monitoring_cost_annual','software_cost_annual','subcontractor_annual_cost','other_direct_annual','monthly_direct_cost','cost_confirmed_zero'];
      const costs={}; keys.forEach(k=>costs[k]=a[k]!==undefined?a[k]:r.row[k]); const mc=E27.modelledCost(costs);
      const prev=P27.costVersions.filter(x=>String(x.agreement_id)===String(a.id)).sort((x,y)=>y.version_no-x.version_no)[0];
      const cv={agreement_id:a.id,version_no:(prev?prev.version_no:0)+1,costs,annual_direct_cents:Number(E27.roundHalfUp(E27.mul(mc.annual,E27.R(100n)))),approver:CURRENT_EMAIL,evidence:($('cd_evid').value||'').trim()||null};
      const {data,error}=await sb.from('rmr_cost_versions').insert(cv).select(); if(error){ toast(error.message); ok=false; }
      else { P27.costVersions.push((data&&data[0])||cv); audit('Cost version approved and locked','Costs',a.agreement_number,null,cv,null); ok=!!(await commitEvent27(a.category==='sla'?'sla_new':'new_sale',a.id)); } }
    if(req){ await sb.from('rmr_worklist').update({status:'closed',closed_by:CURRENT_EMAIL,closed_at:new Date().toISOString(),close_basis:record&&ok?'Agreement set up and sale recorded':'Agreement set up'}).eq('id',req.id); }
    await load27(); render(); close(); if(!record)toast(`Agreement #${r.row.agreement_number} saved — record the sale when ready`); };
  $('cdSave27').onclick=()=>save(false); $('cdGo27').onclick=()=>save(true);
  paint();
}
const _origOpenModal27=window.openModal;
window.winOpp=function(id){ openCloseDeal27(id); };

/* ---- Reps: Mark won (goes to the admin's Worklist) and see its status ---- */
function wonRequest27(oppId){ return P27.worklist.find(w=>w.item_uid===`won:${oppId}`)||null; }
async function markWon27(oppId,detail){
  const o=AGREEMENTS.find(x=>String(x.id)===String(oppId)); if(!o)return;
  const owner=(((P27.settings.feed_owners||{}).agreement_terms||{}).owner)||ADMIN_EMAILS[0];
  const it={item_uid:`won:${o.id}`,type:'deal_won',record_ref:String(o.id),title:`${o.opportunity_number||''} ${o.customer_name||''}: marked won by ${CURRENT_EMAIL} — set up the agreement and record the sale`,
    detail:Object.assign({requested_by:CURRENT_EMAIL,opportunity:o.opportunity_number,estimate:o.estimate_ref,est_rmr:o.est_monthly_rmr},detail),owner_email:owner,due_date:E27.addDays(E27.businessToday(),2),status:'open'};
  const {error}=await sb.from('rmr_worklist').upsert(it,{onConflict:'item_uid',ignoreDuplicates:true}); if(error){ toast(error.message); return; }
  audit('Opportunity marked won','Opportunities',o.opportunity_number,null,it.detail,null); P27.worklist=await fetchAll('rmr_worklist','id'); renderOpportunities(); toast('Sent — your admin will set up the agreement');
}
(function hookOpportunities27(){
  const orig=window.renderOpportunities; if(typeof orig!=='function')return;
  window.renderOpportunities=function(){ orig.apply(this,arguments);
    const intro=$('oppIntro27'); if(intro&&!can('editAgreements')) intro.innerHTML='Your pipeline. Add an <b style="color:var(--ink)">opportunity</b> for each quote; when the customer signs, click <b style="color:var(--ink)">Mark won</b> and your admin sets up the agreement and records the sale. Opportunities never count toward commission until then.';
    if(!P27.ready)return;
    const wrap=$('oppTableWrap'); if(!wrap)return;
    wrap.querySelectorAll('tr').forEach(tr=>{ const ed=tr.querySelector('[data-oppedit]'); const win=tr.querySelector('[data-oppwin]'); const id=(ed&&ed.dataset.oppedit)||(win&&win.dataset.oppwin); if(!id)return;
      const req=wonRequest27(id); const stageCell=tr.children[2];
      if(req&&req.status==='open'&&stageCell) stageCell.insertAdjacentHTML('beforeend',' <span class="chip c-payable" style="font-size:9px">Won — awaiting setup</span>');
      if(can('editAgreements')){ if(win){ win.textContent=req&&req.status==='open'?'Set up deal':'Win'; if(req&&req.status==='open')win.style.fontWeight='700'; } }
      else if(ed&&!(req&&req.status==='open')){ const b=document.createElement('button'); b.className='paidbtn'; b.textContent='Mark won'; b.style.marginLeft='6px';
        b.onclick=()=>{ const cell=b.parentElement; cell.innerHTML=`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><input type="date" class="cfg-in" id="mw_d_${id}" value="${E27.businessToday()}" title="Signed date"><input type="number" class="cfg-in" id="mw_m_${id}" placeholder="Final $/mo" style="width:100px"><input class="cfg-in" id="mw_n_${id}" placeholder="Note (optional)" style="width:140px"><button class="btn-primary" id="mw_go_${id}" style="padding:5px 10px">Send</button></div>`;
          $('mw_go_'+id).onclick=()=>markWon27(id,{signed_date:$('mw_d_'+id).value||null,final_mrr:+$('mw_m_'+id).value||null,note:($('mw_n_'+id).value||'').trim()||null}); };
        ed.after(b); }
    }); };
  const oo=window.openOpp; if(typeof oo==='function') window.openOpp=function(){ const r=oo.apply(this,arguments); const s=$('oppSub27'); if(s) s.textContent=can('editAgreements')?'A lightweight stub. Click Win on the list when the customer signs to set up the agreement.':'When the customer signs, click Mark won on the list — your admin sets up the agreement and records the sale.'; return r; };
})();

/* ---- Reps: read-only agreement view ---- */
function viewAgreement27(id){
  const a=AGREEMENTS.find(x=>String(x.id)===String(id)); if(!a)return; const c=compute(a);
  let sc=$('vwScrim27'); if(sc)sc.remove(); sc=document.createElement('div'); sc.id='vwScrim27'; sc.className='scrim show';
  const d=x=>x?esc(String(x).slice(0,10)):'—'; const row=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px dashed var(--line)"><span style="color:var(--muted)">${k}</span><b style="text-align:right">${v}</b></div>`;
  let comm='';
  if(c.revised&&c.revisedCalc){ const ls=revisedQuarterLines27(a,c); const tr=c.tranches||{};
    comm=`<div style="display:flex;justify-content:space-between;align-items:baseline"><span>Total commission</span><b style="font-size:20px">${fmt2(Number(c.revisedCalc.totalCents)/100)}</b></div>
     <table style="width:100%;font-size:12.5px;margin-top:8px"><thead><tr><th style="text-align:left">Payment</th><th class="num">Amount</th><th>Status</th><th style="text-align:left">What it's waiting on</th></tr></thead><tbody>
     ${ls.map(l=>{ const t=l.piece===1?tr.t1:tr.t2; const m=RSTATE27[l.rstate]; const waits=l.rstate==='expected'?((t&&t.conditions)||[]).map(friendlyCond27).map(esc).join('<br>')||esc(l.note):esc(l.note);
       return `<tr><td style="white-space:nowrap">Payment ${l.piece} of 2</td><td class="num mono">${fmt2(l.amount)}</td><td><span class="chip ${m[0]}" style="font-size:9px">${m[1]}</span></td><td style="white-space:normal">${waits}</td></tr>`; }).join('')}</tbody></table>
     <div class="qctx" style="margin-top:6px">Payment 1 is earned when the first invoice is paid. Payment 2 is earned three months after first billing, with the account active and every invoice due by then paid.</div>`;
  } else if(c.planNotConfigured||c.blockedReason){ comm=`<div style="color:var(--orange)">${esc(plainText27(c.blockedReason||c.planReason||'Plan not configured'))}</div>`; }
  else { comm=`${row('Initial commission',fmt2(c.initialCommission||0))}${c.holdbackCommission?row('Deferred piece',fmt2(c.holdbackCommission)+(c.holdbackQI!=null?' · '+qLabel(c.holdbackQI):'')):''}${c.renewalCommission?row('Renewal commission',fmt2(c.renewalCommission)):''}<div class="qctx" style="margin-top:6px">Sold before the revised plan — paid under the plan it was sold on.</div>`; }
  const evs=committedEventsFor(a);
  sc.innerHTML=`<div class="modal" style="max-width:640px"><div class="modal-head"><div><h3 style="margin:0">#${esc(a.agreement_number||'—')} · ${esc(a.customer_name||'')}</h3><div style="font-size:12px;color:var(--muted);margin-top:2px">View only · ${esc(c.planVersion||'')}</div></div><button class="x" id="vwClose27">×</button></div>
    <div class="modal-body" style="font-size:13px">
     ${row('Monthly RMR',fmt2(+a.monthly_rmr||0)+(a.category==='sla'?' (SLA)':''))}${row('Term',a.contract_term?a.contract_term+' months':'—')}${row('Signed / activated',d(a.activation_date))}${row('First billing',d(a.first_billing_date))}
     ${row('Renewal',a.autorenew?'Auto-renewal':'Manual renewal')}${typeof nextDueDate==='function'&&nextDueDate(a)?row('Next renewal',fmtDate(nextDueDate(a))):''}
     <div class="fieldset-h">Your commission</div>${comm}
     ${evs.length?`<div class="fieldset-h">Recorded</div>${evs.map(e=>row(esc(String(e.event_date||'').slice(0,10))+' · '+esc(String(e.event_type).replace(/_/g,' ')),fmt2(+e.total_cents/100))).join('')}`:''}
    </div><div class="modal-foot"><button class="btn-primary" id="vwOk27" style="margin-left:auto">Close</button></div></div>`;
  document.body.appendChild(sc); const close=()=>sc.remove(); $('vwClose27').onclick=close; $('vwOk27').onclick=close; sc.onclick=e=>{ if(e.target===sc)close(); };
}
(function hookOpenModalForReps27(){ const prev=window.openModal; window.openModal=function(id,promote){ if(!can('editAgreements')){ if(id)viewAgreement27(id); return; } return prev.apply(this,arguments); }; })();

/* ---- Tabs and first-sign-in checks ---- */
const REP_HIDDEN_TABS=['tabForecast','tabRecon','tabReports','tabWorklist'];
(function hookPermissions27(){
  const orig=window.applyPermissions;
  const labels={tabQuarter:['Quarter view','My pay'],tabAgreements:['Agreements','My agreements'],tabHistory:['Commission History','Payment history']};
  window.applyPermissions=function(){ orig.apply(this,arguments);
    const rep=!canViewAll();
    REP_HIDDEN_TABS.forEach(id=>{ const t=$(id); if(t) t.style.display=rep?'none':''; });
    Object.entries(labels).forEach(([id,[a,b]])=>{ const t=$(id); if(t) t.textContent=rep?b:a; });
    setTimeout(firstSignInChecks27,0); };
})();
async function firstSignInChecks27(){
  if(!P27.ready||!CURRENT_EMAIL)return; const me=CURRENT_EMAIL.toLowerCase();
  let mine=(P27.users||[]).find(u=>String(u.email).toLowerCase()===me);
  if(!mine&&!ADMIN_EMAILS.includes(me)){ const q=await sb.from('rmr_users').select('*').eq('email',me).limit(1); if(q.error)return; mine=(q.data||[])[0]; }
  if(!mine&&!ADMIN_EMAILS.includes(me)){
    let sc=$('notSetUp27'); if(sc)return; sc=document.createElement('div'); sc.id='notSetUp27'; sc.className='scrim show'; sc.style.zIndex='1000';
    sc.innerHTML=`<div class="modal" style="max-width:460px"><div class="modal-head"><h3 style="margin:0">Your account isn't set up yet</h3></div><div class="modal-body" style="font-size:13.5px;line-height:1.6">You're signed in as <b>${esc(me)}</b>, but you haven't been added to the Bonus Tracker. Ask your administrator to add you in Admin ▸ Employees, then sign in again.</div><div class="modal-foot"><button class="btn-primary" id="nsu27" style="margin-left:auto">Sign out</button></div></div>`;
    document.body.appendChild(sc); $('nsu27').onclick=()=>{ sc.remove(); doSignOut(); }; return; }
  if(mine&&mine.must_set_password&&!$('pwScrim27')){
    const sc=document.createElement('div'); sc.id='pwScrim27'; sc.className='scrim show'; sc.style.zIndex='1001';
    sc.innerHTML=`<div class="modal" style="max-width:440px"><div class="modal-head"><h3 style="margin:0">Choose your password</h3></div><div class="modal-body" style="font-size:13px;line-height:1.6">Welcome to the Bonus Tracker. Replace the temporary password you were given with one only you know.
      <div class="fld" style="margin-top:10px"><label>New password <span class="hint">at least 8 characters</span></label><input type="password" id="pw1_27" autocomplete="new-password"></div><div class="fld"><label>Confirm</label><input type="password" id="pw2_27" autocomplete="new-password"></div><div id="pwErr27" style="color:var(--held)"></div></div>
      <div class="modal-foot"><button class="btn-primary" id="pwGo27" style="margin-left:auto">Save password</button></div></div>`;
    document.body.appendChild(sc);
    $('pwGo27').onclick=async()=>{ const p1=$('pw1_27').value, p2=$('pw2_27').value; if(p1.length<8){ $('pwErr27').textContent='Use at least 8 characters.'; return; } if(p1!==p2){ $('pwErr27').textContent="The two entries don't match."; return; }
      const {error}=await sb.auth.updateUser({password:p1}); if(error){ $('pwErr27').textContent=error.message; return; }
      await sb.rpc('rmr_password_set'); mine.must_set_password=false; audit('Password set at first sign-in','Admin',me,null,null,null); sc.remove(); toast('Password saved'); };
  }
}

/* ---- Plain-language screens: requirement codes stay in the spec and audit trail, not on screen ---- */
(function stripCodes27(){
  const re=new RegExp(REQ_CODE); const skip=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT']);
  const fix=node=>{ if(node.nodeType===3){ if(re.test(node.nodeValue)){ const v=plainText27(node.nodeValue); if(v!==node.nodeValue)node.nodeValue=v; } return; }
    if(node.nodeType!==1||skip.has(node.nodeName))return;
    if(node.title&&re.test(node.title))node.title=plainText27(node.title);
    const w=document.createTreeWalker(node,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT); let n;
    while((n=w.nextNode())){ if(n.nodeType===3){ if(re.test(n.nodeValue)&&!(n.parentNode&&skip.has(n.parentNode.nodeName))){ const v=plainText27(n.nodeValue); if(v!==n.nodeValue)n.nodeValue=v; } } else if(n.title&&re.test(n.title)) n.title=plainText27(n.title); } };
  const mo=new MutationObserver(ms=>{ ms.forEach(m=>{ if(m.type==='characterData')fix(m.target); else m.addedNodes.forEach(fix); }); });
  const start=()=>{ fix(document.body); mo.observe(document.body,{childList:true,subtree:true,characterData:true}); };
  if(document.body)start(); else document.addEventListener('DOMContentLoaded',start);
})();
