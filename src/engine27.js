/* ===================================================================================================
   P1 Commission Engine v2.7 — the single versioned calculation engine (spec v2.7, TEC-03)
   Preview, Admin draft preview, the agreement Commission tab, the ledger and the payroll export all
   call these functions. Pure functions only: no DOM, no network — so they run identically in the
   browser and in the automated acceptance tests (tests/acceptance.test.js).

   Money:  integer cents as BigInt. Rates: exact decimal strings parsed to rationals (BigInt n/d).
           No floating point anywhere in the calculation path (TEC-01). Currency totals are rounded
           to the cent ONCE, half-up, after the exact commission is known; then split.
   Margin: CST-01 — qualification margin is computed SOLELY from Tracker-held modelled direct costs
           over the committed term. Imported Vista cost never feeds it. Unknown margin BLOCKS
           qualification (it no longer receives the 1.0 multiplier — F-08).
   =================================================================================================== */
(function(root){
"use strict";
const FORMULA_VERSION='engine27-1.0';

/* ---------- exact rationals ---------- */
function gcd(a,b){ a=a<0n?-a:a; b=b<0n?-b:b; while(b){ [a,b]=[b,a%b]; } return a||1n; }
function R(n,d){ if(d===undefined)d=1n; n=BigInt(n); d=BigInt(d); if(d===0n)throw new Error('division by zero'); if(d<0n){n=-n;d=-d;} const g=gcd(n,d); return {n:n/g,d:d/g}; }
function dec(x){            // "1.125" | 1.125 | "0.5" → exact rational. Numbers are converted through their shortest decimal string.
  if(x&&typeof x==='object'&&'n' in x)return x;
  if(x===null||x===undefined||x==='')return null;
  let s=String(x).trim(); if(!/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s))throw new Error('Not a decimal: '+x);
  let exp=0; const em=s.match(/e(-?\d+)$/i); if(em){ exp=+em[1]; s=s.replace(/e-?\d+$/i,''); }
  const neg=s.startsWith('-'); if(neg)s=s.slice(1);
  const [ip,fp='']=s.split('.'); let n=BigInt(ip+fp), d=10n**BigInt(fp.length);
  if(exp>0)n*=10n**BigInt(exp); if(exp<0)d*=10n**BigInt(-exp);
  return R(neg?-n:n,d);
}
const add=(a,b)=>R(a.n*b.d+b.n*a.d,a.d*b.d), sub=(a,b)=>R(a.n*b.d-b.n*a.d,a.d*b.d), mul=(a,b)=>R(a.n*b.n,a.d*b.d), div=(a,b)=>R(a.n*b.d,a.d*b.n);
const cmp=(a,b)=>{ const l=a.n*b.d, r=b.n*a.d; return l<r?-1:l>r?1:0; };
const ZERO=R(0n), ONE=R(1n);
function roundHalfUp(q){    // rational → BigInt (half away from zero, documented rule TEC-01)
  const neg=q.n<0n, n=neg?-q.n:q.n; let i=n/q.d; const rem=n%q.d; if(rem*2n>=q.d)i+=1n; return neg?-i:i;
}
function cents(x){ if(typeof x==='bigint')return x; const q=dec(x); return roundHalfUp(mul(q,R(100n))); }   // dollars → cents
function toDollars(c){ c=BigInt(c); const neg=c<0n; const a=neg?-c:c; return (neg?'-':'')+(a/100n).toString()+'.'+(a%100n).toString().padStart(2,'0'); }
function fmtCents(c){ if(c==null)return '—'; const s=toDollars(c); const [i,f]=s.replace('-','').split('.'); return (s.startsWith('-')?'-':'')+'$'+i.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+f; }
function ratStr(q,dp=4){ if(q==null)return '—'; const m=10n**BigInt(dp); const v=roundHalfUp(mul(q,R(m))); const neg=v<0n,a=neg?-v:v; return (neg?'-':'')+(a/m)+'.'+(a%m).toString().padStart(dp,'0'); }
function pctStr(q,dp=4){ return q==null?'—':ratStr(mul(q,R(100n)),dp)+'%'; }

/* ---------- dates: date-only values, business timezone America/Los_Angeles (TEC-02) ---------- */
function isoDate(d){ if(!d)return null; if(typeof d==='string')return d.slice(0,10); const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function businessToday(){ try{ return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }catch(e){ return isoDate(new Date()); } }
function addMonthsClamp(iso,n){   // calendar months with end-of-month clamping: 31 Jan + 3 → 30 Apr (PAY-02)
  const [y,m,d]=iso.slice(0,10).split('-').map(Number); const t=(y*12+(m-1))+n; const ny=Math.floor(t/12), nm=t%12+1;
  const last=new Date(Date.UTC(ny,nm,0)).getUTCDate(); return `${ny}-${String(nm).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;
}
function daysBetween(a,b){ return Math.round((Date.UTC(...b.split('-').map((v,i)=>i===1?v-1:+v))-Date.UTC(...a.split('-').map((v,i)=>i===1?v-1:+v)))/86400000); }
function quarterOf(iso){ const [y,m]=iso.split('-').map(Number); return {y,q:Math.floor((m-1)/3)+1}; }
function addDays(iso,n){ const [y,m,d]=iso.split('-').map(Number); return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10); }

/* ---------- blocked / not-configured results ---------- */
class Blocked extends Error{ constructor(code,msg,field){ super(msg); this.code=code; this.field=field||null; } }

/* ---------- plan helpers ---------- */
const STD_TERMS=[12,24,36,48,60];
function validatePlanVersion(v){   // COM-06 publication checks; also used before preview
  const errs=[]; const c=(v&&v.config)||{};
  if(!v||!v.family)errs.push('Plan family is required.');
  if(c.placeholder){ errs.push(`${v.family} is a placeholder — rates are Not configured.`); return errs; }
  if(!v.rate_basis)errs.push('rate_basis is required (mrr_multiple or tcv_percent).');
  if(v.rate_basis==='mrr_multiple'){
    if(!c.newMult)errs.push('rate_basis is mrr_multiple but no multiple fields are populated.');
    if(c.newPct||c.renewalPct)errs.push('rate_basis is mrr_multiple but percentage fields are populated — the two disagree.');
  }
  if(v.rate_basis==='tcv_percent'&&!c.newPct)errs.push('rate_basis is tcv_percent but no percentage fields are populated.');
  if(c.newMult){ for(const t of STD_TERMS){ if(c.newMult[t]==null||c.newMult[t]==='')errs.push(`New-sale multiple for ${t} months is not set.`); } }
  if(c.renewalMult==null||c.renewalMult==='')errs.push('Manual renewal multiple is not set.');
  const t1=c.tranche1Pct!=null?dec(c.tranche1Pct):null, t2=c.tranche2Pct!=null?dec(c.tranche2Pct):null;
  if(!t1||!t2||cmp(add(t1,t2),ONE)!==0)errs.push('Tranche split must total 100%.');
  if(c.allocation){ const h=dec(c.allocation.hunter), f=dec(c.allocation.farmer); if(!h||!f||cmp(add(h,f),ONE)!==0)errs.push('Role allocation must total 100% (ADM-02).'); }
  if(c.minMargin==null)errs.push('Qualification margin floor is not set.');
  if(c.termConversionMult!=null&&cmp(dec(c.termConversionMult),ZERO)!==0)errs.push('Term-conversion incentive must be 0 for revised Hybrid (COM-04).');
  if(c.autoRenewalMult!=null&&cmp(dec(c.autoRenewalMult),ZERO)!==0)errs.push('Auto-renewal commission must be 0 (COM-04).');
  return errs;
}
function termMultiple(cfg,term,kind){   // exact multiples only; nonstandard terms need an approved mapping (COM-02, COM-06, F-15)
  term=+term;
  const table=kind==='sla'?cfg.slaNewMult:cfg.newMult;
  if(!table)throw new Blocked('plan_not_configured','Plan not configured — no term multiples.');
  if(!(term>0))throw new Blocked('term_required','A committed term in months is required.','term');
  if(table[term]!=null&&table[term]!=='')return {mult:dec(table[term]),source:`${term}-month multiple`};
  if(term>60){ const cap=kind==='sla'?table[60]:(cfg.newMultCapAbove60!=null?cfg.newMultCapAbove60:table[60]); return {mult:dec(cap),source:`${term} months — capped at the 60-month multiple`}; }
  const map=cfg.termMappings&&cfg.termMappings[term];
  if(map&&map.approved_by&&map.mult!=null)return {mult:dec(map.mult),source:`${term} months — approved mapping (${map.approved_by})`};
  throw new Blocked('term_mapping_required',`${term}-month term is nonstandard: an approved term mapping is required. It is not paid the next lower bracket.`,'term');
}

/* ---------- MRR definitions (COM-02) ---------- */
function eligibleMrrCentsRational(a){   // flat price → contractual monthly rate; stepped/prepaid → normalised first-12-month recurring ÷ 12
  const sched=(a.custom_billing&&Array.isArray(a.billing_schedule)&&a.billing_schedule.length)?a.billing_schedule:null;
  if(!sched){ const m=a.monthly_rmr; if(m===null||m===undefined||m==='')return null; return R(cents(m)); }
  const start=a.first_billing_date||a.activation_date; let m0=0; if(start){ m0=+String(start).slice(5,7)-1; }
  let ann=0n; for(let m=1;m<=12;m++){ const cal=((m0+m-1)%12)+1; for(const r of sched){ if((+r.month)===cal){ if(r.once&&m-1>=12)continue; if(r.once&&r.recurring===false)continue; ann+=cents(r.amount||0); } } }
  return R(ann,12n);
}

/* ---------- modelled cost and qualification margin (CST-01, CST-02, CST-04, CST-10, F-08, F-09) ---------- */
function modelledCost(a){
  // Returns {annualCents, state, notes}. state: 'complete' | 'unknown' | 'legacy_only'
  // Labour = scheduled hours × loaded labour rate × cadence; burdened labour is never re-burdened (CST-08).
  const lines=[];
  const rows=(a.labor_schedule&&Array.isArray(a.labor_schedule.rows))?a.labor_schedule.rows:null;
  const rate=a.loaded_labor_rate;
  let hours=null;
  if(rows&&rows.length){ hours=rows.reduce((s,r)=>add(s,dec(r.hours||0)),ZERO); }
  else if(a.inspection_frequency!=null&&a.hours_per_inspection!=null&&(+a.inspection_frequency>0)){ hours=mul(dec(a.inspection_frequency),dec(a.hours_per_inspection)); }
  const labour=(hours&&cmp(hours,ZERO)>0)?(rate!=null&&rate!==''&&+rate>0?mul(hours,dec(rate)):null):ZERO;
  const cat=(k)=>{ const v=a[k]; return (v===null||v===undefined||v==='')?ZERO:dec(v); };
  const material=cat('material_cost_annual'), monitoring=cat('monitoring_cost_annual'), software=cat('software_cost_annual'), sub=cat('subcontractor_annual_cost'), other=cat('other_direct_annual');
  const itemised=[labour,material,monitoring,software,sub,other].filter(Boolean).reduce((s,x)=>add(s,x),ZERO);
  const legacy=(a.monthly_direct_cost!=null&&+a.monthly_direct_cost>0)?mul(dec(a.monthly_direct_cost),R(12n)):null;
  const confirmedZero=!!a.cost_confirmed_zero;
  if(labour===null){ return {annual:null,state:'unknown',notes:['Labour hours are scheduled but no loaded labour rate is set.']}; }
  if(cmp(itemised,ZERO)===0){
    if(legacy){ return {annual:legacy,state:'legacy_only',notes:['Only the legacy monthly direct cost field is populated — Cost basis unverified (CST-10).']}; }
    if(confirmedZero) return {annual:ZERO,state:'complete',notes:['Direct cost explicitly confirmed as zero.']};
    return {annual:null,state:'unknown',notes:['No cost data — missing costs are never assumed to be zero (CST-04).']};
  }
  // F-09: the legacy field is NOT added on top of itemised costs any more (it was double-counting labour/sub). Flag for review.
  if(legacy)lines.push('Legacy monthly direct cost is also populated — ignored to avoid double counting; review (F-09).');
  return {annual:itemised,state:'complete',notes:lines,doubleCountFlag:!!legacy};
}
function qualificationMargin(mrrQ,termMonths,cost){
  // Gross margin over the committed term = (revenue − modelled direct cost) ÷ revenue. Overhead never enters (CST-03).
  if(mrrQ==null)return {margin:null,reason:'Monthly recurring value is missing.'};
  const months=R(BigInt(termMonths>0?termMonths:12));
  const revenue=mul(mrrQ,months);                       // cents
  if(cmp(revenue,ZERO)<=0)return {margin:null,reason:'Zero revenue — Not applicable; ordinary qualification is prevented.',notApplicable:true};
  if(cost.state==='unknown')return {margin:null,reason:'Unknown margin — '+cost.notes.join(' ')};
  if(cost.state==='legacy_only')return {margin:null,reason:'Cost basis unverified — enter an itemised breakdown (CST-10).',costUnverified:true};
  const costCents=mul(mul(cost.annual,R(100n)),div(months,R(12n)));
  return {margin:div(sub(revenue,costCents),revenue),revenueCents:revenue,costCents};
}
function marginGate(cfg,margin,exception){
  // Two-tier gate: 1.0 at or above the floor, 0 below. Unknown blocks. Comparison uses the unrounded ratio (TEC-01).
  if(margin==null)throw new Blocked('margin_unknown','Unknown margin cannot qualify (F-08, CST-01).','costs');
  const floor=dec(cfg.minMargin);
  if(cmp(margin,floor)>=0){ const tiers=(cfg.marginGate||[]).map(t=>({min:dec(t.min),mult:dec(t.mult)})).sort((x,y)=>cmp(y.min,x.min)); for(const t of tiers){ if(cmp(margin,t.min)>=0)return {mult:t.mult,label:'At or above floor'}; } return {mult:ONE,label:'At or above floor'}; }
  if(exception&&exception.mult!=null&&exception.reason&&exception.approved_by)return {mult:dec(exception.mult),label:'Approved below-floor exception',exception};
  return {mult:ZERO,label:'Below floor — not eligible'};
}

/* ---------- the calculation (COM-01..05) ---------- */
function calculate(input){
  /* input: { plan:{family,config,label,id,status,rate_basis}, eventType, term, category, priorMrr, newMrr, slaAnnual,
              priorSlaAnnual, margin (rational|null), marginException, shares:[{email,bp}], quota:{monthCents,priorInMonthCents} } */
  const plan=input.plan;
  if(!plan||!plan.config||plan.config.placeholder)throw new Blocked('plan_not_configured','Plan not configured.');
  const cfg=plan.config; const steps=[];
  const isSla=(input.category==='sla')||String(input.eventType).startsWith('sla_');
  const term=+input.term||0;
  let prior, next;
  if(isSla){
    // COM-05: SLA annual recurring value ÷ 12 = MRR equivalent, then the SLA term ladder. One engine, one basis.
    next=input.slaAnnual!=null?div(R(cents(input.slaAnnual)),R(12n)):null;
    prior=input.priorSlaAnnual!=null?div(R(cents(input.priorSlaAnnual)),R(12n)):ZERO;
    if(next==null)throw new Blocked('value_required','SLA annual value is required.','mrr');
    steps.push(`MRR equivalent = SLA annual value ÷ 12 = ${fmtCents(roundHalfUp(next))}`);
  } else {
    next=input.newMrr!=null?R(cents(input.newMrr)):null; prior=input.priorMrr!=null?R(cents(input.priorMrr)):ZERO;
    if(next==null)throw new Blocked('value_required','Eligible MRR is required.','mrr');
  }
  const gate=marginGate(cfg,input.margin,input.marginException);
  const renewalMult=dec(isSla?(cfg.slaRenewalMult!=null?cfg.slaRenewalMult:cfg.renewalMult):cfg.renewalMult);
  let components=[];
  const et=input.eventType;
  if(et==='auto_renewal'||et==='escalation'||et==='rate_increase'){
    // v1: auto-renewals and escalations pay nothing. From Hybrid v2 (autoRenewalPaysIncrease) only the increase pays, as new money at the
    // term's new-sale multiple; the amount already commissioned never pays again, and a decrease pays nothing and takes nothing back.
    if(cfg.autoRenewalPaysIncrease){ const inc=cmp(next,prior)>0?sub(next,prior):ZERO;
      const tm=cmp(inc,ZERO)>0?termMultiple(cfg,term,isSla?'sla':'new'):{mult:ZERO,source:'no increase'};
      components.push({label:(et==='auto_renewal'?'Increase at auto-renewal':'Rate increase')+` — new-agreement rate (${tm.source})`,basis:inc,mult:tm.mult,amount:mul(inc,tm.mult)}); }
    else components.push({label:et==='auto_renewal'?'Auto-renewal (COM-04)':'Contractual escalation (COM-04)',basis:ZERO,mult:ZERO,amount:ZERO});
  } else if(et==='new_sale'||et==='win_back'||et==='sla_new'){
    const tm=termMultiple(cfg,term,isSla?'sla':'new');
    let base=mul(next,tm.mult);
    components.push({label:(isSla?'New SLA sale':et==='win_back'?'Win-back (pays as new sale, COM-09)':'New sale')+` — ${tm.source}`,basis:next,mult:tm.mult,amount:base});
    // Above-quota accelerator (ADM-03): the portion of this MRR above the monthly quota earns (accel − 1) × the same multiple extra.
    const accel=cfg.accelMultiplier!=null?dec(cfg.accelMultiplier):ONE;
    if(!isSla&&input.quota&&cfg.quotaMonthlyMrr!=null&&cmp(accel,ONE)>0){
      const q=R(cents(cfg.quotaMonthlyMrr)), priorIn=R(BigInt(input.quota.priorInMonthCents||0));
      let above=sub(add(priorIn,next),q); if(cmp(above,ZERO)<0)above=ZERO; if(cmp(above,next)>0)above=next;
      if(cmp(above,ZERO)>0){ const extra=mul(mul(above,tm.mult),sub(accel,ONE)); components.push({label:`Above-quota accelerator ${ratStr(accel,2)}× on ${fmtCents(roundHalfUp(above))} MRR`,basis:above,mult:mul(tm.mult,sub(accel,ONE)),amount:extra}); }
    }
  } else if(et==='expansion'){
    const inc=cmp(next,prior)>0?sub(next,prior):ZERO;      // COM-03: greater of new − prior, or zero
    const tm=termMultiple(cfg,term,isSla?'sla':'new');
    components.push({label:`Expansion on added MRR — ${tm.source}`,basis:inc,mult:tm.mult,amount:mul(inc,tm.mult)});
  } else if(et==='manual_renewal'||et==='sla_renewal'){
    const retained=cmp(prior,next)<0?prior:next;            // lesser of prior and new, never negative
    const inc=cmp(next,prior)>0?sub(next,prior):ZERO;
    components.push({label:'Manual renewal on retained MRR',basis:retained,mult:renewalMult,amount:mul(retained,renewalMult)});
    if(cmp(inc,ZERO)>0){ const tm=termMultiple(cfg,term,isSla?'sla':'new'); components.push({label:`Increase at renewal — new-agreement rate (${tm.source})`,basis:inc,mult:tm.mult,amount:mul(inc,tm.mult)}); }
    steps.push('No term-conversion bonus is paid (COM-04).');
  } else throw new Blocked('event_type','Unknown event type '+et);
  const exact=components.reduce((s,c)=>add(s,c.amount),ZERO);
  const gated=mul(exact,gate.mult);
  const totalCents=roundHalfUp(div(gated,ONE));                       // cents (inputs are already in cents)
  // Tranches: tranche 1 rounded half-up; tranche 2 = total − tranche 1 (TEC-01)
  const t1p=dec(cfg.tranche1Pct!=null?cfg.tranche1Pct:'0.5');
  const t1=roundHalfUp(mul(R(totalCents),t1p)); const t2=totalCents-t1;
  const shares=allocateShares(totalCents,t1,input.shares);
  return {formulaVersion:FORMULA_VERSION,planLabel:plan.label,planId:plan.id||null,planStatus:plan.status||null,eventType:et,term,isSla,
    priorMrr:prior,newMrr:next,components,gate,exact,totalCents,tranche1Cents:t1,tranche2Cents:t2,shares,steps,
    displayTcvPct:(!isSla&&term>0&&components[0]&&components[0].mult)?div(components[0].mult,R(BigInt(term))):null};
}
function allocateShares(totalCents,t1Cents,shares){
  // TEC-07 / TEC-01: shares in basis points must total 10000; residual cents go deterministically (largest remainder, then email order)
  if(!shares||!shares.length)return null;
  const tot=shares.reduce((s,x)=>s+(+x.bp||0),0); if(tot!==10000)throw new Blocked('shares_incomplete',`Sales credit shares total ${tot/100}% — they must total 100%.`,'shares');
  const split=(amt)=>{ const rows=shares.map(s=>{ const ex=BigInt(amt)*BigInt(s.bp); return {email:s.email,floor:ex/10000n,rem:ex%10000n}; });
    let left=BigInt(amt)-rows.reduce((s,r)=>s+r.floor,0n);
    [...rows].sort((a,b)=>(b.rem>a.rem?1:b.rem<a.rem?-1:a.email.localeCompare(b.email))).forEach(r=>{ if(left>0n){ r.floor+=1n; left-=1n; } });
    return rows; };
  const tot1=split(totalCents), t1=split(t1Cents);
  return tot1.map((r,i)=>({email:r.email,bp:shares[i].bp,totalCents:r.floor,t1Cents:t1[i].floor,t2Cents:r.floor-t1[i].floor}));
}

/* ---------- earning conditions (PAY-01, PAY-02, VIS-04, BIL-03) ---------- */
function evaluateTranches(ev,ctx){
  /* ev: {totalCents,tranche1Cents,tranche2Cents}
     ctx: { activationDate, ended, cancelledDate, invoices:[{number,date,dueDate,total,status,collected:{state,date,verifiedAt}}], today, offsetMonths }
     invoice.status: Scheduled | Invoiced | Partially paid | Paid | Settled by credit | Voided
     invoice.collected.state: Confirmed (cash evidence) | Unverified | Disputed | null                                       */
  const today=ctx.today||businessToday(); const out={t1:{state:'Conditional',conditions:[]},t2:{state:'Conditional holdback',conditions:[]}};
  const actual=(ctx.invoices||[]).filter(i=>i.status&&i.status!=='Scheduled'&&i.status!=='Voided'&&i.number&&(+i.total||0)>0).sort((a,b)=>a.date.localeCompare(b.date));
  const firstBill=actual.length?actual[0]:null;                       // first ACTUAL invoice — never the signing date
  const cashOk=(i)=>i.collected&&i.collected.state==='Confirmed';
  const evDate=(i)=>i.collected.date||isoDate(i.collected.verifiedAt);  // true receipt date if known, else date of verified confirmation (VIS-10)
  // tranche 1
  if(!ctx.activationDate)out.t1.conditions.push('Agreement is not activated.');
  if(!firstBill)out.t1.conditions.push('Awaiting Vista record — no issued first invoice yet (BIL-07).');
  else if(firstBill.status==='Settled by credit')out.t1.conditions.push('First invoice settled by credit — a credit is not cash collected (BIL-03).');
  else if(!cashOk(firstBill))out.t1.conditions.push(`Missing receipt evidence for first invoice ${firstBill.number}.`);
  if(ctx.cancelledDate&&(!firstBill||!cashOk(firstBill)))out.t1.conditions.push('Cancelled before earning — unearned tranche stops (PAY-04).');
  if(!out.t1.conditions.length){ out.t1.state='Earned'; out.t1.earnedDate=[ctx.activationDate,evDate(firstBill)].sort().pop(); out.t1.dateBasis=firstBill.collected.date?'receipt date':'date of verified confirmation (VIS-10)'; }
  // tranche 2: three calendar months after first actual billing AND all invoices due through that date confirmed collected
  if(!firstBill){ out.t2.conditions.push('Time condition cannot start: no first actual billing.'); }
  else{
    const timeDate=addMonthsClamp(firstBill.date,ctx.offsetMonths||3); out.t2.timeDate=timeDate;
    if(today<timeDate)out.t2.conditions.push(`Time condition not met — ${timeDate} (three calendar months after first billing ${firstBill.date}).`);
    if(ctx.ended)out.t2.conditions.push('Account is not active.');
    if(ctx.cancelledDate&&ctx.cancelledDate<=timeDate)out.t2.conditions.push('Cancelled before earning — unearned tranche stops (PAY-04).');
    const due=(ctx.invoices||[]).filter(i=>i.status!=='Voided'&&i.status!=='Scheduled'&&(i.dueDate||i.date)<=timeDate&&(+i.total||0)>0);
    const unpaid=due.filter(i=>!cashOk(i)&&i.status!=='Settled by credit');
    if(unpaid.length)out.t2.conditions.push(`${unpaid.length} invoice(s) due through ${timeDate} without confirmed collection: ${unpaid.slice(0,4).map(i=>i.number).join(', ')}${unpaid.length>4?'…':''}.`);
    const sched=(ctx.invoices||[]).filter(i=>i.status==='Scheduled'&&i.date<=timeDate);
    if(sched.length)out.t2.conditions.push(`${sched.length} scheduled billing row(s) through ${timeDate} have no matched Vista invoice — they contribute nothing.`);
    if(!out.t2.conditions.length){ const dates=[timeDate,...due.filter(cashOk).map(evDate)].filter(Boolean).sort(); out.t2.state='Earned'; out.t2.earnedDate=dates.pop(); }
  }
  if(ctx.rules&&(ctx.rules.t1==='invoice_issued'||ctx.rules.t1==='marked_sold'||ctx.rules.t2==='first_invoice_collected')) return earningByInvoice(out,firstBill,ctx,today,cashOk,evDate);
  return out;
}
/* Hybrid v3 earning (Sean, 2026-10-04): Payment 1 is earned when the first nonzero invoice is ISSUED (agreement active);
   Payment 2 is earned when that first invoice is PAID — expected within ctx.rules.expectDays (60) of its invoice date;
   paid later, it is earned on the date it is paid. Nothing is forfeited for lateness. */
function earningByInvoice(prev,firstBill,ctx,today,cashOk,evDate){
  const r=ctx.rules, out={t1:prev.t1,t2:prev.t2};
  if(r.t1==='marked_sold'){ const t1={state:'Conditional',conditions:[]}; const ms=ctx.markedSold;   // a Manager, Executive or Administrator recorded the commission event
    if(!ctx.activationDate)t1.conditions.push('Agreement has no sale date.');
    if(!ms)t1.conditions.push('Not marked sold yet — a Manager, Executive or Administrator records the commission event.');
    if(ctx.cancelledDate&&ctx.activationDate&&ctx.cancelledDate<ctx.activationDate)t1.conditions.push('Cancelled before the sale date — Payment 1 is not earned (PAY-04).');
    if(!t1.conditions.length){ t1.state='Earned'; t1.earnedDate=ctx.activationDate; t1.markedSoldBy=ms.by||null; t1.markedSoldOn=ms.on||null;
      t1.dateBasis=`sale date — marked sold${ms.by?' by '+ms.by:''}${ms.on?' on '+ms.on:''}`; }
    out.t1=t1; }
  if(r.t1==='invoice_issued'){ const t1={state:'Conditional',conditions:[]};
    if(!ctx.activationDate)t1.conditions.push('Agreement is not activated.');
    if(!firstBill)t1.conditions.push('Awaiting Vista record — no issued first invoice yet (BIL-07).');
    if(ctx.cancelledDate&&(!firstBill||firstBill.date>ctx.cancelledDate))t1.conditions.push('Cancelled before the first invoice — Payment 1 is not earned (PAY-04).');
    if(!t1.conditions.length){ t1.state='Earned'; t1.earnedDate=[ctx.activationDate,firstBill.date].sort().pop(); t1.dateBasis='first invoice issued'; }
    out.t1=t1; }
  if(r.t2==='first_invoice_collected'){ const t2={state:'Conditional holdback',conditions:[]}; const days=+r.expectDays||60;
    if(!firstBill){ t2.conditions.push('Waiting for the first invoice.'); }
    else{ const expectBy=addDays(firstBill.date,days); t2.timeDate=expectBy; t2.expectBy=expectBy;
      if(firstBill.status==='Settled by credit')t2.conditions.push('First invoice settled by credit — a credit is not cash collected (BIL-03).');
      else if(!cashOk(firstBill))t2.conditions.push(today>expectBy?`First invoice ${firstBill.number} is past net ${days} (${expectBy}) and not paid yet — Payment 2 is earned when it is paid.`:`Waiting for payment of first invoice ${firstBill.number} — expected by ${expectBy} (net ${days}).`);
      if(ctx.cancelledDate&&!(cashOk(firstBill)&&evDate(firstBill)<=ctx.cancelledDate))t2.conditions.push('Cancelled before the first invoice was paid — Payment 2 is not earned (PAY-04).'); }
    if(!t2.conditions.length){ t2.state='Earned'; t2.earnedDate=[ctx.activationDate,evDate(firstBill)].filter(Boolean).sort().pop(); t2.dateBasis=firstBill.collected.date?'receipt date':'date of verified confirmation (VIS-10)';
      if(t2.earnedDate>t2.expectBy)t2.late=true; }
    out.t2=t2; }
  return out;
}

/* ---------- portfolio bonus (BON-01..04) ---------- */
function retention(opening,churn,contraction,expansion){
  const o=R(cents(opening)); if(cmp(o,ZERO)===0)return {grr:null,nrr:null,state:'Not applicable — opening MRR is zero; review (BON-02).'};
  const g=div(sub(sub(o,R(cents(churn))),R(cents(contraction))),o); const n=div(add(sub(sub(o,R(cents(churn))),R(cents(contraction))),R(cents(expansion))),o);
  return {grr:g,nrr:n,state:'ok'};
}
function tierFor(table,value){ if(value==null)return null; const rows=(table||[]).map(t=>({min:dec(t.min),pct:dec(t.pct)})).sort((a,b)=>cmp(b.min,a.min)); for(const t of rows){ if(cmp(value,t.min)>=0)return t; } return {min:null,pct:ZERO}; }
function portfolioBonus(cfg,ret,salaryBasisCents){
  if(ret.grr==null||ret.nrr==null)return {state:'Unknown',reason:ret.state};           // unavailable metric → Unknown, never $0 final
  if(salaryBasisCents==null)return {state:'Unknown',reason:'No effective-dated salary record for the period.'};
  const g=tierFor(cfg.grrBonus,ret.grr), n=tierFor(cfg.nrrBonus,ret.nrr);
  const gc=roundHalfUp(mul(R(salaryBasisCents),g.pct)), nc=roundHalfUp(mul(R(salaryBasisCents),n.pct));
  return {state:'ok',grrPct:g.pct,nrrPct:n.pct,grrCents:gc,nrrCents:nc,totalCents:gc+nc};
}
function salaryBasis(records,fromIso,toIsoExcl){   // salary accrued over eligible days with effective-dated records (BON-03)
  if(!records||!records.length)return null;
  const yearDays=daysBetween(fromIso,toIsoExcl); let acc=ZERO; let covered=0;
  for(const r of records){ const s=r.effective_from>fromIso?r.effective_from:fromIso; const e=(r.effective_to&&r.effective_to<toIsoExcl)?r.effective_to:toIsoExcl; if(e<=s)continue;
    const d=daysBetween(s,e); covered+=d; acc=add(acc,mul(R(cents(r.annual_salary)),R(BigInt(d),BigInt(yearDays)))); }
  if(!covered)return null; return roundHalfUp(acc);
}

/* ---------- payout run classification (NAV-04) ---------- */
function classifyForRun(entry,ctx){
  // entry: {earned:boolean, earnedDate, verified:boolean, blockedBy:[...], paid:boolean}
  if(entry.paid)return {state:'Excluded from this run',reason:'Already paid.'};
  if(!entry.earned)return {state:'Excluded from this run',reason:entry.reason||'Earning conditions not met.'};
  if(entry.earnedDate&&ctx.cutoff&&entry.earnedDate>ctx.quarterEnd)return {state:'Excluded from this run',reason:'Earned after quarter end — next run.'};
  if(!entry.verified)return {state:'Pending verification',reason:entry.verifyReason||'Collection not verified by the cutoff.'};
  if(entry.blockedBy&&entry.blockedBy.length)return {state:'Pending verification',reason:entry.blockedBy.join('; ')};
  return {state:'Ready to pay',reason:'Earned and verified.'};
}

/* ---------- payout calendar (VIS-12) ---------- */
function payoutCalendar(settings,todayIso){
  const s=settings||{payWithinDays:30,verifyWithinDays:15}; const t=todayIso||businessToday();
  const {y,q}=quarterOf(t); const pq=q===1?{y:y-1,q:4}:{y,q:q-1};          // the run being prepared is for the quarter just ended
  const qe=new Date(Date.UTC(pq.y,pq.q*3,0)).toISOString().slice(0,10);
  let cutoff=addDays(qe,+s.verifyWithinDays||15), pay=addDays(qe,+s.payWithinDays||30);
  let run={y:pq.y,q:pq.q,quarterEnd:qe,cutoff,payBy:pay};
  if(t>pay){ const qe2=new Date(Date.UTC(y,q*3,0)).toISOString().slice(0,10); run={y,q,quarterEnd:qe2,cutoff:addDays(qe2,+s.verifyWithinDays||15),payBy:addDays(qe2,+s.payWithinDays||30)}; }
  return run;
}
function feedDueState(feed,lastDataThrough,run,todayIso){
  const critical=(feed==='invoices'||feed==='receipts'); const t=todayIso||businessToday();
  if(!critical)return {critical,state:lastDataThrough?'ok':'not loaded',label:'Not payout-critical'};
  const meets=lastDataThrough&&lastDataThrough>=run.quarterEnd;
  if(meets)return {critical,state:'ok',label:`Covers quarter end ${run.quarterEnd}`};
  if(t>run.cutoff)return {critical,state:'overdue',label:`Overdue — data must reach ${run.quarterEnd} by the cutoff ${run.cutoff}`};
  if(daysBetween(t,run.cutoff)<=7)return {critical,state:'due soon',label:`Due by ${run.cutoff}`};
  return {critical,state:'due',label:`Due by ${run.cutoff}`};
}

const api={FORMULA_VERSION,R,dec,add,sub,mul,div,cmp,ZERO,ONE,roundHalfUp,cents,toDollars,fmtCents,ratStr,pctStr,
  isoDate,businessToday,addMonthsClamp,daysBetween,addDays,quarterOf,Blocked,STD_TERMS,validatePlanVersion,termMultiple,
  eligibleMrrCentsRational,modelledCost,qualificationMargin,marginGate,calculate,allocateShares,evaluateTranches,
  retention,tierFor,portfolioBonus,salaryBasis,classifyForRun,payoutCalendar,feedDueState};
if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.P1E=api;
})(typeof window!=='undefined'?window:globalThis);
