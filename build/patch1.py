# Phase 1-2 edits to the legacy single-file app (spec v2.7). Each replacement must match exactly once.
import re,sys
p='/home/claude/P1-Bonus-TrackerV1/index.html'
s=open(p,encoding='utf-8').read()
def rep(old,new,count=1):
    global s
    n=s.count(old)
    if n!=count: sys.exit(f'MATCH {n}x (want {count}): {old[:90]!r}')
    s=s.replace(old,new)

# ---- money formatting: a missing value is never shown as $0 ----
rep("const fmt=n=>(n<0?'-':'')+'$'+Math.abs(Math.round(n)).toLocaleString('en-US');",
    "const fmt=n=>(n==null||Number.isNaN(+n))?'—':((n<0?'-':'')+'$'+Math.abs(Math.round(n)).toLocaleString('en-US'));")
rep("const fmt2=n=>'$'+(Math.round(n*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});",
    "const fmt2=n=>(n==null||Number.isNaN(+n))?'—':('$'+(Math.round(n*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}));")

# ---- CAT-05 / F-11: fail-closed plan resolution. No DEFAULT_CONFIG terminus, no role fallback. ----
rep("""function defaultPlanConfig(){ const d=PLANS.find(p=>p.is_default); if(d)return d.config; const a=PLANS.find(p=>p.status==='active'); if(a)return a.config; return PLANS.length?PLANS[0].config:CONFIG; }
function planForRole(role){ if(!role)return null; const p=PLANS.find(p=>p.config&&p.config.role===role&&(p.status||'active')==='active'); return p?p.config:null; }
function resolvePlan(a){
  const email=(a&&a.owner_email)?String(a.owner_email).toLowerCase():null;
  const pid=email?USER_PLAN[email]:null;
  return planById(pid)||planForRole(email?USER_ROLE[email]:null)||defaultPlanConfig();
}
function planLabelFor(a){ const cfg=resolvePlan(a); return cfg&&cfg.planVersion?cfg.planVersion:''; }""",
"""/* Spec v2.7 CAT-05: plan resolution FAILS CLOSED. A historical transaction reads only the historical plan recorded
   for its owner (MIG-05); there is no default plan, no role-based fallback and no DEFAULT_CONFIG terminus (F-11).
   Transactions dated on or after the revised-plan cutover resolve through the versioned engine (engine27). */
function defaultPlanConfig(){ return null; }   // retained name for old call sites — there is deliberately no default plan
function planForRole(role){ return null; }      // TEC-06: plan family is no longer inferred from the permission role
function resolvePlan(a){
  const email=(a&&a.owner_email)?String(a.owner_email).toLowerCase():null;
  const pid=email?USER_PLAN[email]:null;
  return planById(pid)||null;
}
function planLabelFor(a){ const cfg=resolvePlan(a); return cfg&&cfg.planVersion?cfg.planVersion:'Plan not configured'; }""")

# COM-06 / F-15: no silent step-down to the next lower bracket for historical percentage maps either
rep("function pctFor(map,term){if(map[term]!=null)return map[term];const ks=Object.keys(map).map(Number).sort((a,b)=>a-b);let v=map[ks[0]];for(const k of ks){if(term>=k)v=map[k];}return v;}",
    "function pctFor(map,term){ if(!map)return null; if(map[term]!=null)return map[term]; if(!(term>0))return map[12]!=null?map[12]:null; const ks=Object.keys(map).map(Number).sort((a,b)=>a-b); if(term>ks[ks.length-1])return map[ks[ks.length-1]]; return null; }   // nonstandard term → null (approved mapping required), never the next lower bracket")
# F-08: unknown margin blocks qualification
rep("function marginMult(gm,plan){const cfg=plan||CONFIG;if(gm==null)return {mult:1.0,label:'—',status:'—'};",
    "function marginMult(gm,plan){const cfg=plan||CONFIG;if(gm==null)return {mult:0,label:'Unknown',status:'Unknown margin — blocked (F-08)'};")
rep("function buildSnapshot(a,type){\n  const plan=resolvePlan(a);\n  const c=compute(a,plan);",
    "function buildSnapshot(a,type){\n  const plan=resolvePlan(a);\n  const c=compute(a,plan);\n  if(!plan||c.planNotConfigured) return {plan_version:'Plan not configured',paid_date:new Date().toISOString().slice(0,10),amount:null,piece:type};")

# ---- BIL-01 / F-01 / F-02: no date-driven auto-payment ----
rep("return {date:d.toISOString().slice(0,10),amount:x.amount,invoice_no:'',status:'auto'}; });",
    "return {date:d.toISOString().slice(0,10),amount:x.amount,invoice_no:'',status:'scheduled'}; });   // BIL-01: generated rows are Scheduled")
rep("function logEffectivePaid(e){ if(!e)return false; if(e.status==='paid')return true; if(e.status==='unpaid')return false; return String(e.date||'').slice(0,10)<=todayISO(); }  // 'auto' → paid once its date passes",
    "function logEffectivePaid(e){ return (typeof billingRowCollected==='function')?billingRowCollected(e,EVIDENCE_AGREEMENT):false; }  // collected ONLY on confirmed receipt evidence — never because a date passed (F-01)")
rep("""  for(const e of sorted){ if(e.status==='unpaid') continue; cum+=(+e.amount||0); if(cum>=threshold-1e-6) return new Date(String(e.date).slice(0,10)+'T00:00:00'); }""",
    """  for(const e of sorted){ if(!logEffectivePaid(e)) continue; cum+=(+e.amount||0); if(cum>=threshold-1e-6) return new Date(String(e.date).slice(0,10)+'T00:00:00'); }   // F-02: only confirmed collections count; future rows are not assumed paid""")
rep("""        if(d<=now){ if(logEffectivePaid(e)) amt+=(+e.amount||0); }         // past: only actually-collected counts (missed = $0 → delays release)
        else if(e.status!=='unpaid') amt+=(+e.amount||0); } }             // future: assume collected unless explicitly marked unpaid
    if(any) return amt;
    return (mDate>now)?sched:0; };                // no entry: future assume scheduled, past nothing""",
"""        if(logEffectivePaid(e)) amt+=(+e.amount||0); } }                  // F-02: only confirmed collections count — no future assumption
    if(any) return amt;
    return 0; };                                  // no entry: nothing collected""")

# ---- F-09 / CST-10: legacy cost fallback & double count; F-08 null margin ----
rep("""  const legacyDirect=(+a.monthly_direct_cost||0)*12;         // pre-Ch.4 generic field
  if((materialCost+monitoringCost+softwareCost+otherCost)===0 && legacyDirect>0) directCosts+=legacyDirect;""",
"""  const legacyDirect=(+a.monthly_direct_cost||0)*12;         // pre-Ch.4 generic field
  // CST-10 / F-09: the legacy field is used only when NO itemised cost exists (all six categories incl. labour & subcontractor),
  // and then the agreement is marked Cost basis unverified and blocked from new qualification. It is never added on top.
  const costUnverified=(directCosts===0 && legacyDirect>0);
  const costDoubleCountFlag=(directCosts>0 && legacyDirect>0);
  if(costUnverified) directCosts=legacyDirect;
  const costUnknown=(directCosts===0 && !a.cost_confirmed_zero);   // CST-04: missing cost is not a confirmed zero""")
rep("""  const grossMargin=acv>0?grossProfit/acv:null;""",
    """  const grossMargin=(acv>0&&!costUnknown&&!costUnverified)?grossProfit/acv:null;   // CST-01: unknown or unverified cost → unknown margin""")
rep("""  const eligible=grossMargin==null?true:grossMargin>=(cfg.minMargin||0.45)-1e-9;""",
    """  const eligible=grossMargin==null?false:grossMargin>=(cfg.minMargin!=null?cfg.minMargin:0.45)-1e-9;   // F-08: unknown margin is blocked, not qualified at full rate""")

# ---- TEC-08 / F-16: grandfathering is an explicit record, never inferred from a missing date ----
rep("""function isLegacyFull(a){
  if(a.paid_initial) return true;                        // already paid 100% under the old model → leave alone
  const s=a&&a.activation_date; if(!s) return a&&a.legacy_full_pay!==false;
  const d=new Date(String(s).slice(0,10)+'T00:00:00'); if(isNaN(d)) return a.legacy_full_pay!==false;
  return d < HOLDBACK_START;                             // before Q1 2026 → grandfathered; Q1 2026+ → split
}""","""function isLegacyFull(a){
  if(a.paid_initial) return true;                        // already paid 100% under the old model → leave alone
  if(a.grandfather_rule) return true;                    // AGR-03: recorded historical rule version, dates, reason and approval
  return false;                                          // TEC-08: a missing activation date or record never grandfathers
}""")

# ---- compute → computeLegacy (historical rule sets). The router `compute` lives in the engine27 module. ----
rep("function compute(a,plan){\n  const cfg=plan||resolvePlan(a);\n",
    "function computeLegacy(a,plan){\n  const cfg=plan||resolvePlan(a);\n  if(!cfg) return planNotConfiguredResult(a,'No historical plan is recorded for this owner — Plan not configured (CAT-05).');\n")
rep("""          marginMultiplier:mm.mult,marginLabel:mm.label,marginStatus:mm.status,eligible,""",
    """          marginMultiplier:mm.mult,marginLabel:mm.label,marginStatus:mm.status,eligible,costUnverified,costUnknown,costDoubleCountFlag,""")

# ---- TEC-06 / F-06 / F-13: permission role separated from plan family ----
rep("""  catch(e){ CURRENT_ROLE='Hybrid'; }   // table missing → least privilege (Sean still admin via list above)""",
    """  catch(e){ CURRENT_ROLE='Representative'; }   // users table unreachable → Representative (keeps calculate & export, TEC-06)""")
rep("""  try{ const {data,error}=await sb.from('rmr_users').select('role').eq('email',lc).limit(1); if(error)throw error; CURRENT_ROLE=normRole(data&&data[0]&&data[0].role); }""",
    """  try{ let r=await sb.from('rmr_users').select('role,permission_role').eq('email',lc).limit(1); if(r.error&&/permission_role/.test(r.error.message||'')) r=await sb.from('rmr_users').select('role').eq('email',lc).limit(1); if(r.error)throw r.error; const u=r.data&&r.data[0]; CURRENT_ROLE=normRole((u&&u.permission_role)||(u&&u.role)); }""")
rep("""const LEGACY_ROLE_MAP={'Sales Representative':'Hybrid','Sales Manager':'Executive'};
function normRole(r){ r=(r||'').trim(); return LEGACY_ROLE_MAP[r]||r||'Hybrid'; }
const REP_ROLES=['Hunter','Farmer','Hybrid'];
const PERMISSIONS={
  editConfig:['Administrator'],
  viewAudit:['Administrator','Executive'],
  override:['Administrator','Executive'],
  editAgreements:['Administrator','Executive'],
  editOpps:['Administrator','Executive','Hunter','Farmer','Hybrid'],
  deleteOpps:['Administrator','Executive'],
  calculate:['Administrator','Executive','Hunter','Farmer','Hybrid'],
  export:['Administrator','Executive','Hunter','Farmer','Hybrid','Read Only']
};""","""/* TEC-06: permission roles are separate from plan families. Recorded migration mapping (migration_v22, rmr_users.role_migrated_from):
   Hunter / Farmer / Hybrid / Sales Representative → Representative · Sales Manager → Executive. Never inferred the other way. */
const PERMISSION_ROLES=['Administrator','Executive','Manager','Representative','Read Only'];
const LEGACY_ROLE_MAP={'Sales Representative':'Representative','Sales Manager':'Executive','Hunter':'Representative','Farmer':'Representative','Hybrid':'Representative'};
function normRole(r){ r=(r||'').trim(); return LEGACY_ROLE_MAP[r]||(PERMISSION_ROLES.includes(r)?r:'Representative'); }
const REP_ROLES=['Representative'];
const PLAN_FAMILIES=['Hybrid','Hunter','Farmer'];
const PERMISSIONS={
  editConfig:['Administrator'],
  viewAudit:['Administrator','Executive'],
  override:['Administrator','Executive'],
  editAgreements:['Administrator','Executive','Manager'],
  editOpps:['Administrator','Executive','Manager','Representative'],
  deleteOpps:['Administrator','Executive'],
  calculate:['Administrator','Executive','Manager','Representative'],
  export:['Administrator','Executive','Manager','Representative','Read Only'],
  verifyEvidence:['Administrator','Executive','Manager'],
  approvePayout:['Administrator','Executive']
};""")
rep("function canViewAll(){ return ['Administrator','Executive'].includes(CURRENT_ROLE); }",
    "function canViewAll(){ return ['Administrator','Executive','Manager'].includes(CURRENT_ROLE); }")
rep("const ROLE_LIST=['Administrator','Executive','Hunter','Farmer','Hybrid','Read Only'];",
    "const ROLE_LIST=PERMISSION_ROLES;")

# ---- CAT-06 / F-12: normalizeConfig no longer reinstates superseded values; explicit nulls survive ----
rep("""function normalizeConfig(j){ j=j||{}; if(j.targetMargin==null)j.targetMargin=0.50; if(j.minMargin==null)j.minMargin=0.45; if(!j.planVersion)j.planVersion='2026 v1.0'; if(!j.basis)j.basis='TCV'; if(!j.autoRenewalPct)j.autoRenewalPct={12:0.02,24:0.025}; if(j.immediatePct==null)j.immediatePct=0.75; if(j.holdbackPct==null)j.holdbackPct=0.25; if(j.holdbackThresholdPct==null)j.holdbackThresholdPct=0.25; if(j.accelReleasePct==null)j.accelReleasePct=0.50; if(j.overheadPct==null)j.overheadPct=0.28; if(!j.planType)j.planType='A'; if(j.rmrMultiple==null)j.rmrMultiple=2.00; if(j.newInitialPct==null)j.newInitialPct=0.50; if(j.newDeferredPct==null)j.newDeferredPct=0.50; if(j.renInitialPct==null)j.renInitialPct=0.50; if(j.renDeferredPct==null)j.renDeferredPct=0.50; if(j.bManualRenewalPct==null)j.bManualRenewalPct=0.04; if(j.bAutoRenewalPct==null)j.bAutoRenewalPct=0.01;
  if(j.role==null)j.role=''; if(j.quotaMonthlyRmr==null)j.quotaMonthlyRmr=0; if(j.accelMultiplier==null)j.accelMultiplier=1; if(!j.releaseMode)j.releaseMode='revenue'; if(j.releaseOffsetMonths==null)j.releaseOffsetMonths=3;
  if(j.termConversionMult==null)j.termConversionMult=0; if(j.termConversionMinTerm==null)j.termConversionMinTerm=36; if(j.portfolioBonus==null)j.portfolioBonus=false;
  if(j.slaNewMult==null)j.slaNewMult=0; if(j.slaRenewMult==null)j.slaRenewMult=0; if(j.slaCap==null)j.slaCap=0;
  if(!j.amendMode)j.amendMode='new'; if(j.amendEscalatorPays==null)j.amendEscalatorPays=true;
  if(!Array.isArray(j.grrBonus)||!j.grrBonus.length)j.grrBonus=JSON.parse(JSON.stringify(DEFAULT_CONFIG.grrBonus)); if(!Array.isArray(j.nrrBonus)||!j.nrrBonus.length)j.nrrBonus=JSON.parse(JSON.stringify(DEFAULT_CONFIG.nrrBonus));
  return j; }""","""/* CAT-06 / F-12: the loader no longer fills superseded rate defaults (2–2.5% auto-renewals, 75/25 split, 2× RMR,
   4% manual renewal, escalators paying, 2/4/6/8% bonus tables …). A historical version reads exactly what it stored;
   an explicit null stays null (Not configured). Only structural, rate-free defaults are applied. */
function normalizeConfig(j){ j=j||{};
  if(!j.planVersion)j.planVersion='(unnamed historical plan)'; if(!j.basis)j.basis='TCV'; if(!j.planType)j.planType='A';
  if(j.role==null)j.role=''; if(!j.releaseMode)j.releaseMode='revenue';
  if(j.termConversionMult==null)j.termConversionMult=0;           // correct under the revised plan (COM-04)
  if(j.overheadPct===undefined)j.overheadPct=0.28;                 // analytical view only (FIN-03); never enters gross margin
  return j; }""")
rep("""  if(role==='Farmer') Object.assign(base,{planVersion:'Farmer 2026',quotaMonthlyRmr:0,accelMultiplier:1,renewalPct:{...WB_REN_PCT},termConversionMult:1.5,termConversionMinTerm:36,portfolioBonus:true});
  if(role==='Hybrid') Object.assign(base,{planVersion:'Hybrid 2026',quotaMonthlyRmr:1250,accelMultiplier:1,renewalPct:{...WB_REN_PCT},termConversionMult:1.5,termConversionMinTerm:36,portfolioBonus:true});""",
"""  if(role==='Farmer') Object.assign(base,{planVersion:'Farmer 2026',quotaMonthlyRmr:0,accelMultiplier:1,renewalPct:{...WB_REN_PCT},termConversionMult:0,termConversionMinTerm:36,portfolioBonus:true});   // CAT-04: term conversion 0
  if(role==='Hybrid') Object.assign(base,{planVersion:'Hybrid 2026',quotaMonthlyRmr:1250,accelMultiplier:1,renewalPct:{...WB_REN_PCT},termConversionMult:0,termConversionMinTerm:36,portfolioBonus:true});   // CAT-04: term conversion 0 (the revised Hybrid v1 is a separate versioned plan — engine27)""")
# loadPlans: never seed a plan from DEFAULT_CONFIG; archived presets stay readable for history
rep("""    } else {
      await savePlan();     // no plan rows yet → seed one from the current (local/default) CONFIG, then re-read
      try{ const {data:d2}=await sb.from('rmr_commission_plans').select('*').order('modified_at',{ascending:false});
        PLANS=(d2||[]).filter(p=>p&&p.config).map(p=>({...p,config:normalizeConfig(p.config)}));
        if(PLANS.length){ EDIT_PLAN_ID=PLANS[0].id; ACTIVE_PLAN_ID=PLANS[0].id; } }catch(_){}
    }""","""    }   // CAT-04/CAT-05: an empty catalog is NOT seeded from DEFAULT_CONFIG — it stays Plan not configured""")

# ---- NAV-07: draws retired from the interface and from every calculation; rows preserved ----
rep("""  try{ const {data,error}=await sb.from('rmr_draws').select('*').order('paid_date'); DRAWS=error?[]:(data||[]); }catch(e){ DRAWS=[]; }""",
    """  DRAWS=[];   // NAV-07: draws are handled outside the tool. rmr_draws rows are preserved in the database and never read by a calculation, payout or export.""")
rep("""function planYears(){ const ys=new Set([new Date().getFullYear()]); LEGACY_PAYOUTS.forEach(l=>ys.add(+l.year)); DRAWS.forEach(d=>ys.add(+d.plan_year)); return [...ys].sort((a,b)=>b-a); }""",
    """function planYears(){ const ys=new Set([new Date().getFullYear()]); LEGACY_PAYOUTS.forEach(l=>ys.add(+l.year)); return [...ys].sort((a,b)=>b-a); }""")
rep("""    const pm=portfolioMetrics(y,book); const pcfg=defaultPlanConfig()||CONFIG;""",
    """    const pm=portfolioMetrics(y,book); const pcfg=(typeof reconBonusConfig==='function'?reconBonusConfig(y):null)||{grrBonus:[],nrrBonus:[]};""")
rep("""    // draws
    const dr=scopeRowsByOwner(DRAWS).filter(d=>+d.plan_year===y), drawTot=dr.reduce((s,d)=>s+(+d.amount||0),0);
    const recov=dr.filter(d=>d.recoverable!=='non-recoverable').reduce((s,d)=>s+(+d.amount||0),0);
    const earnedNow=earnedDue+renDue+amdDue, balRecov=earnedNow-paidComm-recov, balNon=earnedNow-paidComm;""",
"""    const earnedNow=earnedDue+renDue+amdDue, balNon=earnedNow-paidComm;   // NAV-07: no draw reconciliation""")
rep("""      <div class="stat blue"><div class="lbl">Draws paid ${y}</div><div class="val">${money(drawTot)}</div><div class="qctx">${dr.map(d=>d.recoverable).join(', ')||'none'}</div></div>
      <div class="stat orange"><div class="lbl">Balance owed now</div><div class="val">${money(dr.some(d=>d.recoverable==='undecided')||!dr.length?balRecov:(recov?balRecov:balNon))}</div><div class="qctx">${dr.some(d=>d.recoverable==='undecided')?`if the draw is recoverable · ${money(balNon)} if it isn't`:'earned so far − commissions paid − recoverable draws'}</div></div>""",
"""      <div class="stat orange"><div class="lbl">Expected less paid</div><div class="val">${money(balNon)}</div><div class="qctx">expected commission so far − commissions paid · draws are handled outside the tool</div></div>""")
rep("""<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>New-sale commission — agreements started in ${y}</h2><span class="qctx">plan: ${esc((defaultPlanConfig()||CONFIG).planVersion||'')} · initial / deferred</span></div>""",
    """<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>New-sale commission — agreements started in ${y}</h2><span class="qctx">each agreement reads its own plan version · initial / deferred</span></div>""")
i=s.index("""    <div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>Draws — ${y}</h2>""")
j=s.index("""  }
  $('rcCtx').textContent=y>=2026?""",i)
s=s[:i]+"`;\n"+s[j:]
i=s.index("""  document.querySelectorAll('[data-drawrec]').forEach(""")
j=s.index("""}

/* ===================== Increases on current accounts (v22) ===================== */""",i)
s=s[:i]+"  if(typeof renderVistaPanel==='function') renderVistaPanel();\n"+s[j:]
rep("""const p=cfg||defaultPlanConfig()||CONFIG; return (pctFor(p.renewalPct,t)""","""const p=cfg; if(!p)return 0; return (pctFor(p.renewalPct,t)""")

# ---- BIL-06: no manual paid toggle on billing rows; status shows evidence ----
rep("""    const paid=logEffectivePaid(e);
    const st = e.status==='unpaid'?'<span style="color:var(--held);font-weight:600">Missed</span>' : (paid?`<span style="color:var(--payable);font-weight:600">Paid${e.status!=='paid'?' · auto':''}</span>`:'<span style="color:var(--muted)">Scheduled</span>');""",
"""    const st = billingRowStatusHTML(e);   // BIL-03: financial status and evidence status shown separately""")
rep("""      <td style="white-space:nowrap"><button type="button" class="blog-pay iconbtn" data-i="${i}">${paid?'Mark unpaid':'Mark paid'}</button>${e.status!=='auto'?` <button type="button" class="blog-auto iconbtn" data-i="${i}" title="follow schedule" style="color:var(--muted)">auto</button>`:''}</td>""",
"""      <td style="white-space:nowrap">${billingRowActionHTML(e,i)}</td>""")
rep("""  wrap.querySelectorAll('.blog-pay').forEach(b=>b.onclick=()=>{const e=EDIT_LOG[+b.dataset.i];e.status=logEffectivePaid(e)?'unpaid':'paid';renderBillingLog();});
  wrap.querySelectorAll('.blog-auto').forEach(b=>b.onclick=()=>{EDIT_LOG[+b.dataset.i].status='auto';renderBillingLog();});""",
"""  wrap.querySelectorAll('[data-verify-row]').forEach(b=>b.onclick=()=>openVerifyForm(+b.dataset.verifyRow));   // VIS-10 documented evidence route (no paid toggle, BIL-06)""")
rep("""<th>Invoice #</th><th>Status</th><th></th></tr>""","""<th>Invoice #</th><th>Financial · evidence</th><th></th></tr>""")
rep("""Expected invoices from the first-billing date &amp; schedule. Each auto-marks <b>paid</b> once its date passes; un-mark any the customer didn't actually pay. <b>Collected</b> invoices (not the schedule) drive the holdback &amp; accelerator release.""",
    """Expected invoices from the first-billing date &amp; schedule are <b>Scheduled</b>. A date passing never marks an invoice paid. A row reaches <b>Invoiced</b> only on a matched Vista invoice and counts as <b>collected</b> only on confirmed receipt evidence (Vista receipt, or verification against the SM Agreements Invoices tab). <b>Rebuild</b> replaces only unissued future rows.""")

# ---- FIN-03: Net profit → Contribution after allocated overhead (analytical view) ----
rep("""      {label:'Net profit',note:`after costs · commission · overhead`,amount:vNet,kind:'total',rule:true}
    ])}
    ${floorHit?""","""      {label:'Contribution after allocated overhead',note:`analytical view only · overhead never enters gross margin`,amount:vNet,kind:'total',rule:true}
    ])}
    ${floorHit?""")
rep("""      {label:'Net profit',note:`after costs · commission · overhead`,amount:vNet,kind:'total',rule:true}
    ])}
    ${alert}""","""      {label:'Contribution after allocated overhead',note:`analytical view only · overhead never enters gross margin`,amount:vNet,kind:'total',rule:true}
    ])}
    ${alert}""")
rep("""{label:'Overhead',note:`${Math.round(c.overheadPct*100)}% of ${B} ${fmt(vRev)}`,amount:vOH,kind:'minus'},
      {label:'Contribution after allocated overhead',note:`analytical view only · overhead never enters gross margin`,amount:vNet,kind:'total',rule:true}
    ])}
    ${alert}""","""{label:'Allocated overhead',note:`${Math.round(c.overheadPct*100)}% of ${B} ${fmt(vRev)} · analytical`,amount:vOH,kind:'minus'},
      {label:'Contribution after allocated overhead',note:`analytical view only · overhead never enters gross margin`,amount:vNet,kind:'total',rule:true}
    ])}
    ${alert}""")
rep("""function updatePreview(){
  const row=readForm();const c=compute(row);
  $('mPreview').innerHTML=calcPanelHTML(c, PREVIEW_BASIS, row, 'pvACV','pvTCV');""","""function updatePreview(){
  const row=readForm();const c=compute(row);
  if(c.revised||c.planNotConfigured){ $('mPreview').innerHTML=revisedPreviewHTML(row,c); if(typeof bindRevisedPreview==='function') bindRevisedPreview(row,c); return; }
  $('mPreview').innerHTML=calcPanelHTML(c, PREVIEW_BASIS, row, 'pvACV','pvTCV');""")

# ---- readForm: section 7 fields (dormant quote expiration, continuity, identity, cost confirmations) ----
rep("""  legacy_full_pay: (editingId ? (((AGREEMENTS.find(a=>a.id===editingId)||{}).legacy_full_pay)!==false) : false),
  billing_log: (EDIT_LOG&&EDIT_LOG.length)?EDIT_LOG:null};}""","""  legacy_full_pay: (editingId ? (((AGREEMENTS.find(a=>a.id===editingId)||{}).legacy_full_pay)!==false) : false),
  original_sale_date:($('f_origsale')&&$('f_origsale').value)||null, revision_id:($('f_revision')&&$('f_revision').value.trim())||null,
  vista_ref:($('f_vistaref')&&$('f_vistaref').value.trim())||null, quote_ref:($('f_quoteref')&&$('f_quoteref').value.trim())||null,
  quote_expiration:($('f_quoteexp')&&$('f_quoteexp').value)||null, predecessor_reason:($('f_predreason')&&$('f_predreason').value)||null,
  cost_confirmed_zero:!!($('f_costzero')&&$('f_costzero').checked), cost_owner_email:($('f_costowner')&&$('f_costowner').value.trim())||null, cost_deadline:($('f_costdeadline')&&$('f_costdeadline').value)||null,
  grandfather_rule: editingId ? ((AGREEMENTS.find(a=>a.id===editingId)||{}).grandfather_rule||null) : null,
  billing_log: (EDIT_LOG&&EDIT_LOG.length)?EDIT_LOG:null};}""")
rep("""    if(/customer_number|site_number|owner_email|converted_to_manual|conversion_|renewal_date|renewal_credit_month|prerenewal_state|stage|opportunity_number|estimate_ref|est_monthly_rmr|expected_close|lost_reason|agreement_type|legacy_full_pay|first_billing_date|billing_log|accel_paid|term_conversion|column/i.test(e.message||'')){ const {customer_number,site_number,owner_email,converted_to_manual,conversion_date,conversion_notes,conversion_ref,renewal_date,renewal_credit_month,prerenewal_state,stage,opportunity_number,estimate_ref,est_monthly_rmr,expected_close,lost_reason,agreement_type,legacy_full_pay,first_billing_date,billing_log,accel_paid,term_conversion,...rest}=payload; await go(rest); }""",
"""    if(/original_sale_date|revision_id|vista_ref|quote_ref|quote_expiration|predecessor_reason|cost_confirmed_zero|cost_owner_email|cost_deadline|grandfather_rule/i.test(e.message||'')){ const {original_sale_date,revision_id,vista_ref,quote_ref,quote_expiration,predecessor_reason,cost_confirmed_zero,cost_owner_email,cost_deadline,grandfather_rule,...rest}=payload; try{ await go(rest); toast('Saved — run migration_v22_spec27.sql to store the new agreement fields'); return; }catch(e2){ e=e2; } }
    if(/customer_number|site_number|owner_email|converted_to_manual|conversion_|renewal_date|renewal_credit_month|prerenewal_state|stage|opportunity_number|estimate_ref|est_monthly_rmr|expected_close|lost_reason|agreement_type|legacy_full_pay|first_billing_date|billing_log|accel_paid|term_conversion|column/i.test(e.message||'')){ const {customer_number,site_number,owner_email,converted_to_manual,conversion_date,conversion_notes,conversion_ref,renewal_date,renewal_credit_month,prerenewal_state,stage,opportunity_number,estimate_ref,est_monthly_rmr,expected_close,lost_reason,agreement_type,legacy_full_pay,first_billing_date,billing_log,accel_paid,term_conversion,...rest}=payload; await go(rest); }""")

# ---- navigation: Worklist tab (NAV-01) and Commission history agreement tab (LED-01) ----
rep("""  <button data-view="admin" id="tabAdmin" title="Admin tools: manage users and roles, commission plans, and build/verify the commission ledger. Restricted to administrators.">⚙ Admin</button>""",
"""  <button data-view="worklist" id="tabWorklist" title="One queue of every item that needs a person: unmatched Vista records, import exceptions, cost classification and variance, unverified cost basis, unresolved recipients, migration exceptions and overdue payout feeds. Filter by owner, type and age.">Worklist <span id="wlBadge" class="chip c-held" style="display:none;font-size:9px;padding:1px 6px;margin-left:4px"></span></button>
  <button data-view="admin" id="tabAdmin" title="Admin: the three plan families (Hybrid, Hunter, Farmer) with draft, preview and publish; employees with permission role, plan assignment, salary and plan acknowledgement; payout calendar and feed owners; historical rules (read-only); audit log.">⚙ Admin</button>""")
rep("""  <section id="view-admin" style="display:none">""","""  <section id="view-worklist" style="display:none">
    <div class="qbar" style="flex-wrap:wrap;gap:10px">
      <div style="font-size:13px;color:var(--muted)">Every item that needs a person, in one queue. Each has a type, an owner, an age and a link to where it is resolved. Closing an item records who closed it, when and why.</div>
    </div>
    <div id="wlBody"></div>
  </section>

  <section id="view-admin" style="display:none">""")
rep("""      <div style="font-size:13px;color:var(--muted)">Edit the active commission plan. Changes apply <b style="color:var(--ink)">immediately</b> to unpaid calculations. Paid commissions are frozen and never recalculated (§5.6).</div>""",
    """      <div style="font-size:13px;color:var(--muted)">Plan families, versions and employees. <b style="color:var(--ink)">Save draft</b> never changes a live calculation; only <b style="color:var(--ink)">Publish version</b> (complete rules, effective date, approval and a preview) creates a version that can be assigned. Historical events always read their own version.</div>""")
rep("""        <button data-tab="bill">Billing &amp; Files</button>
      </div>""","""        <button data-tab="bill">Billing &amp; Files</button>
        <button data-tab="hist">Commission history</button>
      </div>
      <div id="agSummary27"></div>""")
rep("""      <div class="preview" id="mPreview"></div>""","""      <div class="grid agpane" data-pane="hist" style="display:none"><div class="fld full" id="commHist27"><div class="file-hint">Loading…</div></div></div>

      <div class="preview" id="mPreview"></div>""")
rep("""        <div class="fld"><label>Signing / sale date <span class="hint">when it's sold — sets the initial commission quarter & renewal timing</span></label><input id="f_date" type="date"></div>""",
"""        <div class="fld"><label>Current term start / activation <span class="hint">activation of the current term — sets renewal timing</span></label><input id="f_date" type="date"></div>
        <div class="fld"><label>Original sale / signature date <span class="hint">kept separate from the latest renewal and from the first imported invoice (AGR-01)</span></label><input id="f_origsale" type="date"></div>
        <div class="fld"><label>Revision # <span class="hint">Vista agreement revision</span></label><input id="f_revision" placeholder="optional"></div>
        <div class="fld"><label>Vista source reference <span class="hint">agreement / work order / site</span></label><input id="f_vistaref" placeholder="optional"></div>
        <div class="fld"><label>Quote reference <span class="hint">recorded on the commission event (COM-08)</span></label><input id="f_quoteref" placeholder="optional"></div>
        <div class="fld"><label>Quote expiration <span class="hint">dormant — not evaluated in this version (COM-08)</span></label><input id="f_quoteexp" type="date"></div>""")
rep("""        <div class="fld full"><label>Continues agreement # <span class="hint">""","""        <div class="fld"><label>Continuity reason <span class="hint">for the predecessor below</span></label><select id="f_predreason"><option value="">—</option><option value="renewal">Renewal</option><option value="transfer">Transfer</option><option value="consolidation">Consolidation</option><option value="replacement">Replacement</option></select></div>
        <div class="fld full"><label>Continues agreement # <span class="hint">""")
rep("""        <div class="fld"><label>Target margin <span class="hint">% — optional, overrides the program target on this deal</span></label><input id="f_target" type="number" step="1" placeholder="(use program target)"></div>
      </div>""","""        <div class="fld"><label>Target margin <span class="hint">% — optional, overrides the program target on this deal</span></label><input id="f_target" type="number" step="1" placeholder="(use program target)"></div>
        <div class="fld full"><label class="bill-toggle"><input type="checkbox" id="f_costzero"> Direct cost is confirmed <b>$0</b> <span class="hint">an explicit confirmed zero — otherwise blank costs are treated as missing, never as zero (CST-04)</span></label></div>
        <div class="fld"><label>Cost verification owner <span class="hint">named owner while Cost basis unverified (CST-13)</span></label><input id="f_costowner" placeholder="email"></div>
        <div class="fld"><label>Resolution deadline</label><input id="f_costdeadline" type="date"></div>
        <div class="fld full" id="costs27"></div>
      </div>""")
rep("""  view=v;['quarter','opportunities','agreements','renewals','forecast','recon','history','reports','admin'].forEach(""",
    """  view=v;['quarter','opportunities','agreements','renewals','forecast','recon','history','reports','worklist','admin'].forEach(""")
rep("""if(view==='reports')renderReports(); if(view==='admin'){renderAdmin(); const lp=$('ledgerPanel'); if(lp){ if(can('editConfig')){ lp.style.display=''; renderLedgerRecon(); } else lp.style.display='none'; } }""",
    """if(view==='reports')renderReports(); if(view==='worklist'&&typeof renderWorklist==='function')renderWorklist(); if(view==='admin'){ (typeof renderAdmin27==='function'?renderAdmin27:renderAdmin)(); const lp=$('ledgerPanel'); if(lp) lp.style.display='none'; }""")
rep("""function renderLegend(){
  const items=[['c-payable','Payable — owed to you'],['c-paid','Paid — collected'],['c-maturing','Manual renewal needed'],['c-held','Urgent — renewal due / overdue']];
  const dcfg=defaultPlanConfig();
  const planTag=PLANS.length>1?`Default plan ${esc(dcfg.planVersion)} · per-rep plans apply`:`Plan ${esc(dcfg.planVersion)} · ${dcfg.basis} basis · margin-multiplied`;""",
"""function renderLegend(){
  const items=[['c-payable','Payable — owed to you'],['c-paid','Paid — collected'],['c-maturing','Manual renewal needed'],['c-held','Urgent — renewal due / overdue']];
  const planTag=(typeof planStatusTag==='function')?planStatusTag():'Each agreement reads its own plan version';""")
# Quarter view → payout run panel (NAV-04)
rep("""  setTimeout(()=>renderLegacyQuarterNote(selQI),0);""","""  setTimeout(()=>{ renderLegacyQuarterNote(selQI); if(typeof renderPayoutRun==='function') renderPayoutRun(); },0);""")
# opening the agreement: populate section-7 fields, summary badges, costs and history
rep("""  PREVIEW_BASIS='ACV';
  updatePreview();
  renderAttachments('agFiles', editingId, can('editAgreements'));""","""  if(typeof fillAgreement27==='function') fillAgreement27(a);
  PREVIEW_BASIS='ACV';
  updatePreview();
  renderAttachments('agFiles', editingId, can('editAgreements'));""")
rep("""<label style="color:var(--muted)">Commission = commissionable value (TCV = MRR × term months) × the term rate × the margin multiplier. New: 6 / 7 / 8 / 8.5 / 9%. Renewal: 4 / 5 / 5.5 / 5.75 / 6%.</label>""",
    """<label style="color:var(--muted)">Each agreement calculates under its own plan version, shown below. Revised Hybrid: commission = eligible MRR × term multiple × margin gate (rates in Admin); historical agreements keep the rules recorded for them.</label>""")
open(p,'w',encoding='utf-8').write(s)
print('patch1 ok')
