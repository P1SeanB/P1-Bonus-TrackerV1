/* ===================================================================================================
   Vista import parsers (spec v2.7 §2, VIS-02/03/05/09/11/13/15, CST-05, Appendix F)
   Pure functions: rows in (array of arrays from .xlsx/.csv), validated result out. Nothing is written
   here — the caller shows the summary and commits only on confirmation (manual) or only when the whole
   file validates (scheduled). A file that cannot be parsed fails WHOLE and names the column.
   =================================================================================================== */
(function(root){
"use strict";
const norm=s=>String(s==null?'':s).replace(/\s+/g,' ').trim().toLowerCase();

/* Column signatures. `need` columns must all be present in the header row; `forbid` columns identify a
   different report and cause rejection (a file dropped into the wrong slot is rejected, not part-imported). */
const FEEDS={
  invoices:{label:'Invoices',critical:true,report:'SM Invoice List',
    need:['invoice','status','customer','invoice date','balance'],
    optional:['post month','due date','amount','tax','total','service site','work order','description'],
    forbid:['line type','receipt','expiration date'], dataOffset:1},
  receipts:{label:'Receipts',critical:true,report:'AR Customer Receipt History',
    need:['receipt','invoice','amount'], optional:['customer','date','receipt date','applied'], forbid:['line type','expiration date']},
  agreement_terms:{label:'Agreement term history',critical:false,report:'SM Agreement List',
    need:['agreement','revision','status'], optional:['previous revision','effective date','activated date','cancelled date','terminated date','expiration date','total term price','term price','customer','description'],
    forbid:['line type','balance','receipt']},
  posted_cost:{label:'Posted cost',critical:false,report:'SM Work Order Profitability Detail',
    need:['work order','line type'], optional:['description','date','cost','amount','agreement'], forbid:['receipt','balance']},
  invoice_attribution:{label:'Invoice attribution (optional, corroborating)',critical:false,optional_feed:true,report:'P1 AR Aging by Customer/Contract w SMWO',
    need:['invoice'], optional:['customer','contract','description','date','balance'], forbid:['line type','revision']}
};

function findHeader(rows,feed){
  // Vista exports put a parameter echo above the header. Find the first row containing every needed column.
  const sig=FEEDS[feed];
  for(let i=0;i<Math.min(rows.length,40);i++){
    const cells=(rows[i]||[]).map(norm);
    const has=c=>cells.some(x=>x===c||x.startsWith(c+' ')||x.replace(/[#.:]/g,'').trim()===c);
    if(sig.need.every(has))return {index:i,cells};
  }
  return null;
}
function detectFeed(rows){
  const hits=[]; for(const f of Object.keys(FEEDS)){ const h=findHeader(rows,f); if(h){ const forb=FEEDS[f].forbid.some(c=>h.cells.some(x=>x.includes(c))); if(!forb)hits.push(f); } }
  return hits;
}
function paramEcho(rows,headerIndex){
  return rows.slice(0,headerIndex).map(r=>(r||[]).filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').join(' ')).filter(Boolean).join('\n');
}
function echoFlags(feed,echo){
  const flags=[]; const e=norm(echo);
  if(feed==='invoices'){
    // F-20 / VIS-03: default run filters to Invoiced only and hides voided & pending invoices
    if(/status[^a-z]*(=|:|is)?\s*invoiced\b/.test(e)&&!/all/.test(e.replace(/install/g,'')))flags.push('Status filter appears to be Invoiced only — voided and credit-settled invoices are absent (F-20). Re-run with all statuses.');
    if(!/service site/.test(e)&&!/work order/.test(e))flags.push('Service Site / Work Order output columns not confirmed in the parameter echo.');
  }
  if(!echo.trim())flags.push('No parameter echo found above the header — record which filters were applied.');
  return flags;
}
function toIsoDate(v){
  if(v==null||v==='')return null;
  if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
  if(typeof v==='number'&&v>20000&&v<80000){ const d=new Date(Date.UTC(1899,11,30)+v*86400000); return d.toISOString().slice(0,10); }   // Excel serial
  const s=String(v).trim(); let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if(m){ let y=+m[3]; if(y<100)y+=2000; return `${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`; }
  return undefined;   // unreadable
}
function toMoney(v){
  if(v==null||v==='')return null; if(typeof v==='number')return Math.round(v*100)/100;
  let s=String(v).trim(); const neg=/^\(.*\)$/.test(s)||s.startsWith('-'); s=s.replace(/[()$,\s-]/g,''); if(!/^\d+(\.\d+)?$/.test(s))return undefined;
  return (neg?-1:1)*Math.round(parseFloat(s)*100)/100;
}
function isTotalsRow(cells){ const t=cells.map(norm).join(' '); return /totals? for (line type|work order)|^grand total|report total/.test(t); }

function parse(feed,rows,opts){
  opts=opts||{};
  const sig=FEEDS[feed]; if(!sig)return fail(`Unknown feed ${feed}.`);
  const h=findHeader(rows,feed);
  if(!h){ const other=detectFeed(rows).filter(f=>f!==feed); return fail(other.length?`Rejected on column signature: this looks like the ${FEEDS[other[0]].label} export (${FEEDS[other[0]].report}), not ${sig.label}. Nothing was imported.`:`Rejected on column signature: missing required column(s) ${sig.need.map(c=>`"${c}"`).join(', ')}. Nothing was imported.`); }
  if(sig.forbid.some(c=>h.cells.some(x=>x.includes(c))))return fail(`Rejected on column signature: header contains a column from a different report (${sig.forbid.join(', ')}). Nothing was imported.`);
  const col={}; h.cells.forEach((c,i)=>{ const k=c.replace(/[#.:]/g,'').trim(); if(k&&col[k]==null)col[k]=i; });
  const pick=(name)=>{ for(const k of Object.keys(col)){ if(k===name||k.startsWith(name+' '))return col[k]; } return null; };
  const echo=paramEcho(rows,h.index); const flags=echoFlags(feed,echo);
  // Appendix F trap: SM Invoice List data rows sit one column to the right of their headers (Balance is the 12th field).
  let offset=0;
  if(feed==='invoices'){
    const sample=rows.slice(h.index+1).find(r=>r&&r.some(v=>v!==null&&v!==''));
    const ic=pick('invoice');
    if(sample&&ic!=null){ const at=sample[ic], next=sample[ic+1]; const looksInv=v=>v!=null&&/^\s*[A-Z]?\d{3,}\s*$/i.test(String(v)); if(!looksInv(at)&&looksInv(next))offset=1; }
    if(opts.forceOffset!=null)offset=opts.forceOffset;
  }
  const out=[]; const seen=new Set(); let dupes=0;
  for(let r=h.index+1;r<rows.length;r++){
    const row=rows[r]||[]; if(!row.some(v=>v!==null&&v!==undefined&&String(v).trim()!==''))continue;
    if(isTotalsRow(row))continue;                                    // CST-05: discard interleaved Totals rows
    const g=(name)=>{ const i=pick(name); return i==null?null:row[i+offset]; };
    let rec;
    if(feed==='invoices'){
      const inv=g('invoice'); if(inv==null||String(inv).trim()==='')continue;
      rec={invoice_number:String(inv).trim(),status:String(g('status')||'').trim(),customer:g('customer'),invoice_date:toIsoDate(g('invoice date')),
        post_month:g('post month')!=null?String(g('post month')):null,due_date:toIsoDate(g('due date')),amount:toMoney(g('amount')),tax:toMoney(g('tax')),
        total:toMoney(g('total')),balance:toMoney(g('balance')),service_site:g('service site')!=null?String(g('service site')).trim():null,
        work_order:g('work order')!=null?String(g('work order')).trim():null,description:g('description')};
      for(const [k,v] of Object.entries(rec)){ if(v===undefined)return fail(`Could not read column "${k.replace(/_/g,' ')}" on data row ${r+1} ("${String(row[pick(k.replace(/_/g,' '))+offset])}"). The whole file was rejected — nothing was imported.`); }
      if(rec.invoice_date==null)return fail(`Could not read column "invoice date" on data row ${r+1}. The whole file was rejected — nothing was imported.`);
      if(rec.balance==null)return fail(`Could not read column "balance" on data row ${r+1} — check the one-column offset trap (Appendix F). The whole file was rejected.`);
      const key=rec.invoice_number; if(seen.has(key)){dupes++;continue;} seen.add(key);
    } else if(feed==='receipts'){
      const rid=g('receipt'), inv=g('invoice'); if(rid==null||String(rid).trim()==='')continue;
      rec={receipt_id:String(rid).trim(),invoice_number:inv!=null?String(inv).trim():null,customer:g('customer'),amount:toMoney(g('amount')??g('applied')),receipt_date:toIsoDate(g('receipt date')??g('date'))};
      if(rec.amount===undefined)return fail(`Could not read column "amount" on data row ${r+1}. Nothing was imported.`);
      if(rec.receipt_date===undefined)return fail(`Could not read column "receipt date" on data row ${r+1}. Nothing was imported.`);
      rec.receipt_key=rec.receipt_id+'|'+(rec.invoice_number||''); if(seen.has(rec.receipt_key)){dupes++;continue;} seen.add(rec.receipt_key);
    } else if(feed==='agreement_terms'){
      const ag=g('agreement'); if(ag==null||String(ag).trim()==='')continue;
      rec={agreement_number:String(ag).trim(),revision:String(g('revision')??''),previous_revision:g('previous revision')!=null?String(g('previous revision')):null,status:g('status'),
        effective_date:toIsoDate(g('effective date')),activated_date:toIsoDate(g('activated date')),cancelled_date:toIsoDate(g('cancelled date')),
        terminated_date:toIsoDate(g('terminated date')),expiration_date:toIsoDate(g('expiration date')),term_price:toMoney(g('total term price')??g('term price')),customer:g('customer')};
      for(const [k,v] of Object.entries(rec)){ if(v===undefined)return fail(`Could not read column "${k.replace(/_/g,' ')}" on data row ${r+1}. Nothing was imported.`); }
      rec.term_key=rec.agreement_number+'|'+rec.revision; if(seen.has(rec.term_key)){dupes++;continue;} seen.add(rec.term_key);
    } else if(feed==='posted_cost'){
      const wo=g('work order'); const lt=g('line type'); if((wo==null||String(wo).trim()==='')&&(lt==null))continue;
      rec={work_order:wo!=null?String(wo).trim():null,line_type:lt!=null?String(lt).trim():null,description:g('description'),post_date:toIsoDate(g('date')),amount:toMoney(g('cost')??g('amount'))};
      if(rec.amount===undefined)return fail(`Could not read column "cost" on data row ${r+1}. Nothing was imported.`);
      rec.line_key=[rec.work_order,rec.line_type,rec.post_date,rec.description,rec.amount,r].join('|');
    } else if(feed==='invoice_attribution'){
      const inv=g('invoice'); if(inv==null||String(inv).trim()==='')continue;
      const text=row.map(v=>v==null?'':String(v)).join(' '); const m=text.match(/\bAgmt\s*#?\s*(\d+)/i);
      rec={invoice_number:String(inv).trim(),agreement_number:m?m[1]:null,text};
      if(seen.has(rec.invoice_number)){dupes++;continue;} seen.add(rec.invoice_number);
    }
    out.push(rec);
  }
  let dataThrough=null;
  const dateOf={invoices:'invoice_date',receipts:'receipt_date',posted_cost:'post_date',agreement_terms:'effective_date'}[feed];
  if(dateOf){ dataThrough=out.map(x=>x[dateOf]).filter(Boolean).sort().pop()||null; }
  if(feed==='invoices'){
    const st={}; out.forEach(x=>{ const k=x.status||'(blank)'; st[k]=(st[k]||0)+1; });
    if(!st.Voided&&!st.Pending&&out.length>50)flags.push('No Voided or Pending invoices in this file — it looks like the default Invoiced-only run (F-20). Voided invoices at zero balance must never read as collected.');
    return {ok:true,feed,rows:out,header:h.cells,offset,paramEcho:echo,flags,duplicates:dupes,dataThrough,statusCounts:st};
  }
  return {ok:true,feed,rows:out,header:h.cells,offset,paramEcho:echo,flags,duplicates:dupes,dataThrough};
  function fail(msg){ return {ok:false,feed,error:msg}; }
}

/* Invoice financial status (BIL-03). Balance zero = settled, NOT collected. */
function invoiceStatus(inv){
  const st=norm(inv.status);
  if(st.startsWith('void'))return 'Voided';
  if(st.startsWith('pend'))return 'Scheduled';
  const total=+inv.total||+inv.amount||0, bal=inv.balance==null?null:+inv.balance;
  if(bal==null)return 'Invoiced';
  if(Math.abs(bal)<0.005)return total>0?'Paid':'Settled by credit';    // settled; cash evidence decides "collected" separately
  if(bal<total-0.005)return 'Partially paid';
  return 'Invoiced';
}
/* Invoice → agreement mapping in the VIS-11 order: work order or service site → agreement; description text corroborates only. */
function mapInvoice(inv,maps){
  if(inv.work_order&&maps.byWorkOrder&&maps.byWorkOrder[inv.work_order])return {agreement:maps.byWorkOrder[inv.work_order],method:'work order'};
  if(inv.service_site&&maps.bySite&&maps.bySite[inv.service_site]){ const c=maps.bySite[inv.service_site]; if(c.length===1)return {agreement:c[0],method:'service site'}; }
  if(maps.byInvoiceNo&&maps.byInvoiceNo[inv.invoice_number])return {agreement:maps.byInvoiceNo[inv.invoice_number],method:'invoice number on billing row'};
  const m=String(inv.description||'').match(/\bAgmt\s*#?\s*(\d+)/i);
  if(m)return {agreement:null,candidate:m[1],method:'description text (corroborating only — not a primary key)'};
  return {agreement:null,method:null};
}
/* CST-05: classify a posted cost line into exactly one of four buckets using the rule table (data, not code). */
function classifyCost(line,rules){
  for(const r of (rules||[])){ const v=String(line[r.match_field]||''); let re; try{ const p=r.pattern.replace(/^\(\?i\)/,''); re=new RegExp(p,/^\(\?i\)/.test(r.pattern)?'i':''); }catch(e){ continue; } if(re.test(v))return r.bucket; }
  return 'unresolved';
}

const api={FEEDS,parse,detectFeed,invoiceStatus,mapInvoice,classifyCost,toIsoDate,toMoney};
if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.P1V=api;
})(typeof window!=='undefined'?window:globalThis);
