/* ===================================================================================================
   Contract terms, renewals and rate changes from the Vista SM Agreement List (P1RMR-60).
   Pure functions: Vista revisions in, a per-agreement timeline out. Nothing here reads the database
   or decides a dollar amount — the app prices each event with the published plan.

   How Vista prints it: an agreement has one or more contract TERMS ("Term: 11/01/24 to 05/31/27");
   each term holds one or more REVISIONS. A new term is a renewal; a later revision inside the same
   term is a mid-term change (usually a rate change). A revision's "Price" is cumulative for the term,
   so its monthly rate = (Price − amount already billed in this term) ÷ months from its effective date
   to its expiration.
   =================================================================================================== */
(function(root){
"use strict";
const STANDARD_TERMS=[12,24,36,48,60];
const SKIP=/quote|cancel/i;                     // quotes never ran; a cancelled revision never billed
function iso(d){ return d?String(d).slice(0,10):null; }
function monthsBetween(a,b){                    // inclusive calendar months, fractional for partial months
  if(!a||!b)return null; const [y1,m1,d1]=a.split('-').map(Number),[y2,m2,d2]=b.split('-').map(Number);
  const dim=new Date(Date.UTC(y2,m2,0)).getUTCDate(); return (y2-y1)*12+(m2-m1)+(d2-d1+1)/dim; }
/* Term length for the commission multiple: whole months, and a term within one month of a standard term
   counts as that term (co-terminous stub months, e.g. 8/17/26–8/31/29 is a 36-month agreement). */
function termMonths(start,end){
  const m=monthsBetween(start,end); if(m==null)return {months:null,standard:null,raw:null};
  const r=Math.round(m); const std=STANDARD_TERMS.find(t=>Math.abs(m-t)<=1);
  return {months:std||r,standard:std||null,raw:Math.round(m*100)/100};
}
const cents=x=>Math.round((+x||0)*100)/100;
/* Renewal type follows the current term: a 12-month term renews manually, anything longer auto-renews.
   An Administrator can switch it for the current term; the switch lapses when the next term starts. */
function ruleType(months){ return months!=null&&months<=12?'manual':'auto'; }

function timeline(revisions,opts){
  opts=opts||{}; const today=opts.today||new Date().toISOString().slice(0,10);
  const revs=(revisions||[]).filter(r=>!SKIP.test(String(r.status||''))&&r.effective_date)
    .map(r=>({...r,revNo:+r.revision||0})).sort((a,b)=>a.revNo-b.revNo);
  if(!revs.length)return {ok:false,reason:'No active, expired or terminated revisions in Vista.'};
  // group by contract term (term rows printed above the revisions); a revision without one is its own term
  const byTerm=new Map();
  revs.forEach(r=>{ const k=(r.term_start||r.effective_date)+'|'+(r.term_end||r.expiration_date||''); if(!byTerm.has(k))byTerm.set(k,{start:r.term_start||r.effective_date,end:r.term_end||r.expiration_date||null,status:r.term_status||null,revisions:[]}); byTerm.get(k).revisions.push(r); });
  const terms=[...byTerm.values()].sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  terms.forEach(t=>{ let billed=0, monthsBilled=0; t.revisions.sort((a,b)=>a.revNo-b.revNo); const first=t.revisions[0];
    t.revisions.forEach((r,i)=>{ const end=r.expiration_date||t.end;
      if(opts.annualised){ // SLA: the price is the annual value — monthly equivalent = price ÷ 12 (÷ the term in months when longer than a year)
        const mo=monthsBetween(t.start,end); r.rate=(r.term_price!=null&&mo)?cents(r.term_price/Math.max(12,Math.round(mo))):null; }
      else if(i===0){ const mo=monthsBetween(r.effective_date,end); r.rate=(mo&&mo>0&&r.term_price!=null)?cents(r.term_price/mo):null; }
      else { // a later revision's price includes what was already billed in the term: spread the rest over the months not yet billed
        const span=Math.round(monthsBetween(first.effective_date,end)||0), own=Math.round(monthsBetween(r.effective_date,end)||0), left=Math.min(span-monthsBilled,own);
        r.rate=(left>0&&r.term_price!=null)?cents((r.term_price-billed)/left):null; }
      billed+=+r.amount_billed||0; if(r.rate>0)monthsBilled+=Math.round((+r.amount_billed||0)/r.rate); });
    // the date the term really stopped: Vista keeps the printed term end even when every revision expired or was terminated earlier
    const ends=t.revisions.map(r=>iso(r.terminated_date)||iso(r.expiration_date)).filter(Boolean).sort(); const lastEnd=ends[ends.length-1]||t.end;
    t.printedEnd=t.end; if(t.end&&lastEnd&&lastEnd<t.end)t.end=lastEnd;
    t.terminatedEarly=t.revisions.some(r=>r.terminated_date)&&t.printedEnd&&t.end<t.printedEnd;
    const tm=termMonths(t.start,t.end); t.months=tm.months; t.standardTerm=tm.standard; t.rawMonths=tm.raw;
    const withRate=t.revisions.filter(r=>r.rate!=null); t.startRate=withRate.length?withRate[0].rate:null; t.endRate=withRate.length?withRate[withRate.length-1].rate:null; });
  const started=terms.filter(t=>t.start<=today);
  const current=[...started].reverse().find(t=>!t.end||today<=t.end)||started[started.length-1]||terms[0];
  const live=revs.some(r=>/^(active|future active)\b/i.test(String(r.status||'')));
  const last=revs[revs.length-1];
  const endedDate=live?null:(iso(last.terminated_date)||iso(last.expiration_date)||iso(current.end));
  const originalStart=terms[0].start;
  // events: the original sale, every renewal (new term), every rate change inside a term
  const events=[]; let hw=null;            // high-water mark: an increase pays once, even if the rate dips and comes back
  terms.forEach((t,i)=>{
    const type=(i===terms.length-1||t===current)&&opts.overrideType&&opts.overrideTermStart===t.start?opts.overrideType:ruleType(t.months);
    if(i===0){ events.push({kind:'new_sale',date:t.start,term:t.months,standardTerm:t.standardTerm,rawMonths:t.rawMonths,prior:null,next:t.startRate,increase:null,termStart:t.start,termEnd:t.end}); hw=t.startRate; }
    else { const prior=terms[i-1].endRate, next=t.startRate; const inc=(next!=null&&hw!=null&&next-hw>0.04)?cents(next-hw):0;
      // a term cut short by termination and replaced is a rewrite of the agreement, not a renewal: only an increase can pay
      const kind=terms[i-1].terminatedEarly?'rewrite':'renewal';
      events.push({kind,renewalType:kind==='renewal'?type:'auto',date:t.start,term:t.months,standardTerm:t.standardTerm,rawMonths:t.rawMonths,prior,next,increase:inc,highWater:hw,termStart:t.start,termEnd:t.end});
      if(next!=null&&(hw==null||next>hw))hw=next; }
    t.revisions.slice(1).forEach((r,j)=>{ const prev=t.revisions[j]; if(r.rate==null||prev.rate==null||Math.abs(r.rate-prev.rate)<0.05)return;
      const inc=(hw!=null&&r.rate-hw>0.04)?cents(r.rate-hw):0;
      events.push({kind:'rate_change',date:iso(r.effective_date),term:t.months,standardTerm:t.standardTerm,rawMonths:t.rawMonths,prior:prev.rate,next:r.rate,increase:inc,highWater:hw,revision:r.revNo,termStart:t.start,termEnd:t.end});
      if(hw==null||r.rate>hw)hw=r.rate; });
  });
  events.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return {ok:true,originalStart,terms,current,renewals:events.filter(e=>e.kind==='renewal'&&e.date<=today).length,currentType:(opts.overrideType&&opts.overrideTermStart===current.start)?opts.overrideType:ruleType(current.months),
    ruleType:ruleType(current.months),currentRate:current.endRate,live,endedDate,events,lastRevision:last.revNo};
}

const api={timeline,termMonths,monthsBetween,ruleType,STANDARD_TERMS};
if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.R27=api;
})(typeof window!=='undefined'?window:globalThis);
