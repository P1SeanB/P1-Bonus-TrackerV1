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
  }
  if(!echo.trim())flags.push('No parameter echo found above the header — record which filters were applied.');
  return flags;
}
function toIsoDate(v){
  if(v==null||v==='')return null;
  if(v instanceof Date&&!isNaN(v)){ if(v.getUTCFullYear()<1901)return null; return v.toISOString().slice(0,10); }   // Vista prints blank dates as 12/30/1899
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
function isTotalsRow(cells){ const t=cells.map(norm).join(' '); return /totals? for (line type|work order|agreement)|^grand totals?|report total/.test(t); }
// Vista report footer ("2 Point One Electrical Systems · Page 1 · … · Report.rpt") and footnotes ("* Actual Cost is not yet available…")
function isFooterRow(cells){ const c=cells.map(v=>String(v==null?'':v).trim()); return c.some(x=>/\.rpt$/i.test(x)||/^page \d+$/i.test(x)||/^date format/i.test(x))||/^\*{1,2} /.test(c[0]||''); }
const isDateish=v=>v instanceof Date||(typeof v==='number'&&v>20000&&v<80000)||/^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(v==null?'':v).trim());
// The export's own date range ("Invoice Dates: 01/01/25 - 09/30/26", "Date Entered: 07/01/26 - 09/30/26"): the file covers
// through the range end even when no transaction fell on that last day.
function echoRangeEnd(echo,label){ const m=String(echo||'').match(new RegExp(label+':?\\s*(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s*-\\s*(\\d{1,2}/\\d{1,2}/\\d{2,4})','i')); return m?toIsoDate(m[2])||null:null; }
const throughOf=(found,end)=>end&&(!found||end>=found)?end:found;
const cellText=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();

/* Grouped Vista layouts. The real SM Agreement List and SM Work Order Profitability Detail exports are not flat
   tables: they print group rows ("Customer: …", "Agreement: …", "Work Order 11196 Description: …", "Line Type: 2 - Labor")
   above positional detail rows, and the header row does not carry those columns. Read them as Vista prints them. */
function groupedLayout(feed,rows){
  const first=rows.slice(0,60).map(r=>cellText((r||[])[0]));
  if(feed==='agreement_terms'&&first.some(x=>/^agreement: /i.test(x))&&rows.slice(0,10).some(r=>(r||[]).map(norm).includes('rev.')))return true;
  if(feed==='posted_cost'&&first.some(x=>/^work order \S+ +description:/i.test(x))&&first.some(x=>/^line type:/i.test(x)))return true;
  return false;
}
function parseGrouped(feed,rows){
  const fail=msg=>({ok:false,feed,error:msg});
  const hi=rows.findIndex((r,i)=>i<15&&(feed==='agreement_terms'?(r||[]).map(norm).includes('rev.'):(r||[]).map(norm).includes('technician')));
  const echo=rows.slice(0,Math.max(hi,1)).map(r=>(r||[]).filter(v=>v!=null&&String(v).trim()!=='').map(cellText).join(' ')).filter(Boolean).join('\n')
             +(feed==='posted_cost'&&rows[0]?'\n'+cellText(rows[0][1]):'');
  const out=[]; const seen=new Set(); let dupes=0;
  if(feed==='agreement_terms'){
    let cust=null, ag=null, desc=null, term=null;
    const STAT=/^(original quote|renewal quote|amendment quote|active|future active|terminated|expired|cancelled|canceled|quote)\b/i;
    for(let r=hi+1;r<rows.length;r++){ const row=rows[r]||[]; const c0=cellText(row[0]); if(!row.some(v=>v!=null&&String(v).trim()!==''))continue; if(isFooterRow(row))continue;
      let m;
      if((m=c0.match(/^customer:\s*(.*)$/i))){ cust=m[1]||null; continue; }
      if((m=c0.match(/^agreement:\s*(.+)$/i))){ const t=m[1]; const k=t.indexOf(' - '); ag=(k>=0?t.slice(0,k):t).trim(); desc=k>=0?t.slice(k+3).trim():null; term=null; continue; }
      // "Term: 11/01/24 to 05/31/27 (Active)" + "Total Term Price: 1,767.00" — every revision below it belongs to this contract term
      if((m=c0.match(/^term:\s*(\S+)\s+to\s+(\S+)\s*(?:\((.*)\))?/i))){ const pm=cellText(row[1]).match(/total term price:\s*([\d,.\-()]+)/i);
        term={start:toIsoDate(m[1])||null,end:toIsoDate(m[2])||null,status:m[3]||null,price:pm?toMoney(pm[1]):null}; if(term.start&&term.start<'1990')term.start=null; continue; }
      if(typeof row[0]==='number'&&ag){
        const st=cellText(row[10]); if(!STAT.test(st))return fail(`Could not read the revision status on data row ${r+1} ("${st}") — the SM Agreement List layout has changed. Nothing was imported.`);
        const rec={agreement_number:ag,revision:String(row[0]),previous_revision:row[9]!=null&&String(row[9]).trim()!==''?String(row[9]):null,status:st,
          effective_date:toIsoDate(row[1]),activated_date:toIsoDate(row[2]),cancelled_date:toIsoDate(row[3]),terminated_date:toIsoDate(row[4]),expiration_date:toIsoDate(row[5]),
          term_price:toMoney(row[6]),amount_billed:toMoney(row[8]),customer:cust,description:desc,
          term_start:term?term.start:null,term_end:term?term.end:null,term_status:term?term.status:null,term_total_price:term&&term.price!=null&&term.price!==undefined?term.price:null};
        for(const [k,v] of Object.entries(rec)){ if(v===undefined)return fail(`Could not read "${k.replace(/_/g,' ')}" on data row ${r+1}. Nothing was imported.`); }
        rec.term_key=rec.agreement_number+'|'+rec.revision; if(seen.has(rec.term_key)){dupes++;continue;} seen.add(rec.term_key); out.push(rec); }
    }
    if(!out.length)return fail('No agreement revisions found — tick the Active, Future Active, Terminated, Expired and Cancelled boxes and export again. Nothing was imported.');
    const dataThrough=out.map(x=>x.effective_date).filter(Boolean).sort().pop()||null;
    return {ok:true,feed,rows:out,header:(rows[hi]||[]).map(norm),offset:0,layout:'grouped',paramEcho:echo,flags:[],duplicates:dupes,dataThrough};
  }
  // posted_cost: detail rows are [technician, description, date, cost rate, price rate, units, UM, cost, …, price, billed, flag, gross profit, %]
  let agr=null, wo=null, lt=null;
  for(let r=hi+1;r<rows.length;r++){ const row=rows[r]||[]; const c0=cellText(row[0]); if(!row.some(v=>v!=null&&String(v).trim()!==''))continue;
    if(isFooterRow(row)||isTotalsRow(row))continue; let m;
    if((m=c0.match(/^agreement:\s*(.*)$/i))){ agr=m[1].trim()||null; continue; }
    if((m=c0.match(/^work order\s+(\S+)\s+description:/i))){ wo=m[1]; lt=null; continue; }
    if((m=c0.match(/^line type:\s*(?:\d+\s*-\s*)?(.+)$/i))){ lt=m[1].trim(); continue; }
    if(!wo||!lt||!isDateish(row[2]))continue;
    const amt=toMoney(row[7]); if(amt===undefined||amt===null)return fail(`Could not read the Cost on data row ${r+1} ("${row[7]}") — the SM Work Order Profitability Detail layout has changed. Nothing was imported.`);
    const desc=cellText(row[1])||cellText(row[0]);
    const rec={work_order:wo,line_type:lt,description:desc,post_date:toIsoDate(row[2]),amount:amt,agreement_number:agr};
    rec.line_key=[rec.work_order,rec.line_type,rec.post_date,rec.description,rec.amount,r].join('|'); out.push(rec); }
  if(!out.length)return fail('No cost lines found in this file. Nothing was imported.');
  const dataThrough=throughOf(out.map(x=>x.post_date).filter(Boolean).sort().pop()||null,echoRangeEnd(echo,'Date Entered'));
  return {ok:true,feed,rows:out,header:(rows[hi]||[]).map(norm),offset:0,layout:'grouped',paramEcho:echo,flags:[],duplicates:0,dataThrough};
}

function parse(feed,rows,opts){
  opts=opts||{};
  const sig=FEEDS[feed]; if(!sig)return fail(`Unknown feed ${feed}.`);
  if(groupedLayout(feed,rows))return parseGrouped(feed,rows);
  const h=findHeader(rows,feed);
  if(!h&&(feed!=='agreement_terms'&&groupedLayout('agreement_terms',rows)||feed!=='posted_cost'&&groupedLayout('posted_cost',rows))){ const o=groupedLayout('agreement_terms',rows)?'agreement_terms':'posted_cost'; return fail(`Rejected on column signature: this looks like the ${FEEDS[o].label} export (${FEEDS[o].report}), not ${sig.label}. Nothing was imported.`); }
  if(!h){ const other=detectFeed(rows).filter(f=>f!==feed); return fail(other.length?`Rejected on column signature: this looks like the ${FEEDS[other[0]].label} export (${FEEDS[other[0]].report}), not ${sig.label}. Nothing was imported.`:`Rejected on column signature: missing required column(s) ${sig.need.map(c=>`"${c}"`).join(', ')}. Nothing was imported.`); }
  if(sig.forbid.some(c=>h.cells.some(x=>x.includes(c))))return fail(`Rejected on column signature: header contains a column from a different report (${sig.forbid.join(', ')}). Nothing was imported.`);
  const col={}; h.cells.forEach((c,i)=>{ const k=c.replace(/[#.:]/g,'').trim(); if(k&&col[k]==null)col[k]=i; });
  const pick=(name)=>{ for(const k of Object.keys(col)){ if(k===name||k.startsWith(name+' '))return col[k]; } return null; };
  const echo=paramEcho(rows,h.index); const flags=echoFlags(feed,echo);
  // Appendix F trap: SM Invoice List data rows sit one column to the right of their headers (Balance is the 12th field).
  let offset=0, splitAfter=null;
  if(feed==='invoices'){
    const sample=rows.slice(h.index+1).find(r=>r&&r.some(v=>v!==null&&v!==''));
    const ic=pick('invoice');
    if(sample&&ic!=null){ const at=sample[ic], next=sample[ic+1]; const looksInv=v=>v!=null&&/^\s*[A-Z]?\d{3,}\s*$/i.test(String(v)); if(!looksInv(at)&&looksInv(next))offset=1; }
    if(opts.forceOffset!=null)offset=opts.forceOffset;
    // Real export: "Customer # / Name" prints as two cells (number, name), so every column after it sits one to the right.
    const cc=pick('customer'), dc=pick('invoice date');
    if(sample&&offset===0&&cc!=null&&dc!=null&&dc>cc&&!isDateish(sample[dc])&&isDateish(sample[dc+1]))splitAfter=cc;
  }
  const out=[]; const seen=new Set(); let dupes=0;
  for(let r=h.index+1;r<rows.length;r++){
    const row=rows[r]||[]; if(!row.some(v=>v!==null&&v!==undefined&&String(v).trim()!==''))continue;
    if(isTotalsRow(row)||isFooterRow(row))continue;                  // CST-05: discard interleaved Totals rows and the report footer
    const g=(name)=>{ const i=pick(name); if(i==null)return null; if(splitAfter!=null){ if(i===splitAfter){ const a=cellText(row[i]), b=cellText(row[i+1]); return [a,b].filter(Boolean).join(' ')||null; } return row[i>splitAfter?i+1:i]; } return row[i+offset]; };
    let rec;
    if(feed==='invoices'){
      const inv=g('invoice'); if(inv==null||String(inv).trim()==='')continue;
      rec={invoice_number:String(inv).trim(),status:String(g('status')||'').trim(),customer:g('customer'),invoice_date:toIsoDate(g('invoice date')),
        post_month:(()=>{ const v=g('post month'); if(v==null||v==='')return null; const d=toIsoDate(v); return d?d.slice(0,7):String(v); })(),due_date:toIsoDate(g('due date')),amount:toMoney(g('amount')),tax:toMoney(g('tax')),
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
  if(feed==='invoices')dataThrough=throughOf(dataThrough,echoRangeEnd(echo,'Invoice Dates'));
  if(feed==='invoices'){
    const st={}; out.forEach(x=>{ const k=x.status||'(blank)'; st[k]=(st[k]||0)+1; });
    if(!st.Voided&&!st.Pending&&out.length>50)flags.push('No Voided or Pending invoices in this file — it looks like the default Invoiced-only run (F-20). Voided invoices at zero balance must never read as collected.');
    return {ok:true,feed,rows:out,header:h.cells,offset:splitAfter!=null?1:offset,splitCustomer:splitAfter!=null,paramEcho:echo,flags,duplicates:dupes,dataThrough,statusCounts:st};
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
