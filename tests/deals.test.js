// Deals & Customers (P1RMR-62): one Deals list Opportunity → Quoted → Signed → Sold; paid deals live
// under Customers; lost + cancelled feed the hunt list; the agreement window follows the commission chain.
// Clock fixed at 2026-10-20. Run: node tests/deals.test.js
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const results=[]; let fail=0; const ok=(c,m)=>{ results.push((c?'PASS ':'FAIL ')+m); if(!c)fail++; };
const HYB_CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'migration_v22_spec27.sql'),'utf8').match(/select 'Hybrid', 1, 'Hybrid v1 \(revised\)', 'draft', 'mrr_multiple',\s*'(\{[\s\S]*?\})'::jsonb/)[1]);
const V2=Object.assign({},HYB_CFG,{placeholder:false,appliesToAllAgreements:true,autoRenewalPaysIncrease:true,paidThrough:'2026-06-30',paidThroughApprovedBy:'Sean Bithell (self-approved)'});
const SEAN='sean.bithell@point1.com';
const cost={loaded_labor_rate:100,inspection_frequency:1,hours_per_inspection:1};
const poor={loaded_labor_rate:100,inspection_frequency:1,hours_per_inspection:1,other_direct_annual:100000};
const ag=(n,o)=>Object.assign({id:'a-'+n,agreement_number:n,customer_name:'Cust '+n,owner_email:SEAN,stage:null,history_only:false,monthly_rmr:100,contract_term:36,activation_date:'2026-09-01',original_sale_date:'2026-09-01',agreement_type:'auto',autorenew:true,category:'monitoring',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'},cost,o||{});
const opp=(n,o)=>Object.assign({id:'o-'+n,opportunity_number:'SSE-'+n+'-26',customer_name:'Prospect '+n,owner_email:SEAN,stage:'opportunity',est_monthly_rmr:100,monthly_rmr:0,created_at:'2026-09-15T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'},o||{});
const rv=(n,rev,status,eff,exp,price,billed,ts,te,tst,extra)=>Object.assign({term_key:n+'|'+rev,agreement_number:n,revision:String(rev),status,effective_date:eff,expiration_date:exp,term_price:price,amount_billed:billed,term_start:ts,term_end:te,term_status:tst,customer:'9'+n+' (Cust '+n+')'},extra||{});
const inv=(no,n,d,amt)=>({invoice_number:no,status:'Invoiced',customer:'9'+n+' Cust '+n,invoice_date:d,total:amt,amount:amt,balance:0,agreement_number:n,map_method:'invoice number on billing row'});
const ver=(no,amt,d)=>({id:'v'+no,verification_uid:no+'|t',invoice_number:no,total_amount:amt,total_paid:amt,evidence_state:'Confirmed',source:'sm_invoices_tab',receipt_date:d,verified_at:d+'T12:00:00Z',verified_by:SEAN});
let DB={
  rmr_users:[{email:SEAN,role:'Administrator',permission_role:'Administrator',full_name:'Sean Bithell'}],
  rmr_commission_plans:[],
  rmr_agreements:[
    opp('301'),
    opp('302',{stage:'quoting',est_monthly_rmr:250,estimate_ref:'SSE-302',stage_dates:{quoted:'2026-10-01'}}),
    opp('303',{stage:'lost',est_monthly_rmr:80,lost_reason_code:'price',lost_reason:'too expensive',revisit_date:'2027-04-01',stage_dates:{lost:'2026-08-20'}}),
    ag('304',{monthly_rmr:200,billing_log:[{date:'2026-09-01',amount:200,invoice_no:'60001',status:'paid'}]}),
    ag('305',{monthly_rmr:150,customer_name:'Shared Cust'}),
    ag('306',Object.assign({monthly_rmr:90},poor)),
    ag('307',{monthly_rmr:120,history_only:true,activation_date:'2023-01-01',original_sale_date:'2023-01-01',customer_name:'Shared Cust'}),
    ag('308',{monthly_rmr:60,history_only:true,activation_date:'2024-01-01',original_sale_date:'2024-01-01',ended_date:'2026-08-15',cancel_reason:'moved out'}),
    ag('309',{monthly_rmr:0,history_only:true,activation_date:'2022-01-01',consolidated_into:'307',ended_date:'2026-01-01',customer_name:'Shared Cust'})],
  rmr_vista_agreement_terms:[
    rv('304',1,'Active','2026-09-01','2029-08-31',7200,200,'2026-09-01','2029-08-31','Active'),
    rv('305',1,'Active','2026-09-01','2029-08-31',5400,150,'2026-09-01','2029-08-31','Active'),
    rv('306',1,'Active','2026-09-01','2029-08-31',3240,90,'2026-09-01','2029-08-31','Active'),
    rv('307',1,'Active','2023-01-01','2027-12-31',7200,5400,'2023-01-01','2027-12-31','Active'),
    rv('308',1,'Terminated','2024-01-01','2026-12-31',2160,1860,'2024-01-01','2026-12-31','Terminated',{terminated_date:'2026-08-15'})],
  rmr_vista_invoices:[inv('60001','304','2026-09-01',200)],
  rmr_receipt_verifications:[ver('60001',200,'2026-09-10')],
  rmr_plan_versions:[{id:'v-hyb2',family:'Hybrid',version_no:2,label:'Hybrid v2',status:'published',effective_date:'2026-10-04',approved_by:'Sean Bithell',rate_basis:'mrr_multiple',config:V2}],
  rmr_plan_assignments:[{id:1,email:SEAN,plan_version_id:'v-hyb2',effective_from:'2026-10-04',approved_by:SEAN}],
  rmr_plan_acknowledgements:[{id:1,email:SEAN,plan_version_id:'v-hyb2',text_shown:'terms v2',created_at:'2026-10-04T10:00:00Z'}],
  rmr_settings:[{key:'payout_calendar',value:{frequency:'quarterly',payWithinDays:30,verifyWithinDays:15}},{key:'comp_family',value:{[SEAN]:'Hybrid'}}],
  rmr_cost_class_rules:[], rmr_draws:[], rmr_legacy_payouts:[], rmr_renewals:[], rmr_attachments:[], rmr_audit_log:[], rmr_worklist:[]};
async function open(browser,email){ const ctx=await browser.newContext({viewport:{width:1440,height:900}}); const page=await ctx.newPage(); const errors=[];
  await page.clock.setFixedTime(new Date('2026-10-20T18:00:00Z'));
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{ if(m.type()==='error')errors.push('console: '+m.text()); }); page.on('dialog',d=>d.accept(''));
  await page.route('**/*',async route=>{ const u=route.request().url();
    const lib={'supabase-js':'mock-supabase.js','xlsx.full.min.js':'node_modules/xlsx/dist/xlsx.full.min.js','jspdf.umd':'node_modules/jspdf/dist/jspdf.umd.min.js','jspdf.plugin.autotable':'node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js'};
    for(const k in lib) if(u.includes(k)) return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,lib[k]),'utf8')});
    if(u.startsWith('http'))return route.fulfill({contentType:'text/javascript',body:''}); return route.continue(); });
  await page.addInitScript(([seed,em])=>{ localStorage.setItem('rmr_url','https://x.supabase.co'); localStorage.setItem('rmr_key','k'); window.__STORE={}; window.__DB=seed; window.__EMAIL=em; },[DB,email]);
  await page.goto('file://'+path.join(ROOT,'index.html')); await page.waitForTimeout(1600); page.__errors=errors; return page; }
(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await open(browser,SEAN);

  // nav
  ok(await p.evaluate(()=>{ const t=[...document.querySelectorAll('#side27 nav.tabs button')].filter(b=>b.style.display!=='none').map(b=>b.textContent.trim()); return t.includes('Deals')&&t.includes('Customers')&&!t.includes('Pipeline'); }),'side menu shows Deals and Customers, Pipeline is folded in');

  // Deals: stages before anything is recorded
  await p.evaluate(()=>switchView('deals')); await p.waitForTimeout(400);
  let rows=await p.evaluate(()=>dealRows27().map(r=>({no:r.a.agreement_number||r.a.opportunity_number,st:r.stage,note:r.note||''})));
  const st=n=>rows.filter(r=>String(r.no).includes(n)).map(r=>r.st).join(',');
  ok(st('301')==='opportunity','a plain opportunity is at Opportunity');
  ok(st('302')==='quoted','a quoting deal is at Quoted');
  ok(st('303')==='lost','a lost deal with a future revisit date stays at Lost');
  ok(st('304')==='signed'&&st('305')==='signed','won agreements with no recorded event are Signed');
  ok(rows.some(r=>r.no==='306'&&r.st==='signed'),'a below-margin sale sits at Signed with the blocker shown');
  ok(!rows.some(r=>r.no==='307')&&!rows.some(r=>r.no==='308')&&!rows.some(r=>r.no==='309'),'override-paid history, ended and consolidated agreements are not deals');
  ok(await p.evaluate(()=>!!document.querySelector('#dealsHost27 [data-pill="lost"]')&&!!document.getElementById('dealFlat27')),'pills and the All agreements link render');
  ok(await p.evaluate(()=>/st27-sig/.test(document.getElementById('dealTbl27').innerHTML)),'stage chips use the purple stage colors');

  // totals follow the pill and search
  ok(await p.evaluate(()=>{ DEAL_PILL27='quoted'; renderDeals27(); const t=document.querySelector('#dealTbl27 .tot27').innerText; return /Quoted/.test(t)&&/1 deal\b/.test(t)&&/\$250\/mo/.test(t); }),'totals line follows the Quoted pill (1 deal, $250/mo)');
  ok(await p.evaluate(()=>{ DEAL_PILL27='open'; window.DEAL_Q27='Prospect 30'; renderDeals27(); const t=document.querySelector('#dealTbl27 .tot27').innerText; window.DEAL_Q27=''; DEAL_PILL27='open'; renderDeals27(); return /2 deals/.test(t)&&/matching/.test(t); }),'totals line follows the search');
  ok(await p.evaluate(()=>{ DEAL_PILL27='open'; DSORT27={k:null,d:1}; renderDeals27(); document.querySelector('#dealTbl27 [data-dsort="mrr"]').click();
    const v=[...document.querySelectorAll('#dealTbl27 tbody tr[data-dl] td.num:nth-of-type(1)')]; const first=document.querySelector('#dealTbl27 tbody tr[data-dl]').innerText;
    const ok1=/Prospect 302|Cust 304/.test(first)&&/▼/.test(document.querySelector('#dealTbl27 [data-dsort="mrr"]').innerText);
    document.querySelector('#dealTbl27 [data-dsort="mrr"]').click(); const ok2=/▲/.test(document.querySelector('#dealTbl27 [data-dsort="mrr"]').innerText);
    DSORT27={k:null,d:1}; renderDeals27(); return ok1&&ok2; }),'clicking a column header sorts, and clicking again reverses it');
  // record the sales (mark sold), then 304/305 move to Sold
  await p.evaluate(()=>switchView('renewals')); await p.waitForTimeout(400);
  if(await p.evaluate(()=>!!document.getElementById('tm27rec'))){ await p.click('#tm27rec'); await p.waitForTimeout(900); }
  rows=await p.evaluate(()=>dealRows27().map(r=>({no:r.a.agreement_number,st:r.stage,by:r.soldBy||null})));
  ok(rows.some(r=>r.no==='304'&&r.st==='sold'&&r.by===SEAN),'after recording, the sale is Sold and shows who marked it sold');
  ok(rows.some(r=>r.no==='305'&&r.st==='sold'),'second sale also Sold');
  ok(rows.some(r=>r.no==='306'&&r.st==='signed'),'the below-margin sale is still Signed, not Sold');

  // pay out both payments of 304 → it leaves Deals and lives under Customers
  await p.evaluate(()=>{ const ev=P27.events.find(e=>e.agreement_number==='304');
    [1,2].forEach(t=>P27.ledger.push({entry_uid:ev.event_uid+'|T'+t+'|paid|'+__EMAIL,event_uid:ev.event_uid,tranche:t,stage:'paid',recipient_email:__EMAIL,amount_cents:100})); });
  rows=await p.evaluate(()=>dealRows27().map(r=>r.a.agreement_number||''));
  ok(!rows.includes('304'),'a deal with every payment paid leaves Deals');
  ok(await p.evaluate(()=>{ switchView('customers'); renderCustomers27(); const h=document.getElementById('custList27').innerHTML; return /Cust 304/.test(h); }),'…and its customer is on the Customers page');

  // Customers page: grouping, consolidation note, flags, search
  await p.evaluate(()=>{ window.CUST_Q27='Shared'; renderCustomers27(); }); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>{ const h=document.getElementById('custList27').innerHTML; return /Shared Cust/.test(h)&&/consolidated into #307/.test(h); }),'customer groups show the consolidation note');
  ok(await p.evaluate(()=>/commission open/.test(document.getElementById('custList27').innerHTML)),'a customer with an unpaid commission is flagged');
  await p.evaluate(()=>{ window.CUST_Q27=''; renderCustomers27(); });

  // hunt list: lost quote + cancelled account, not the consolidation
  const hunt=await p.evaluate(()=>huntRows27().map(r=>({no:r.a.agreement_number||r.a.opportunity_number,why:r.why,what:r.what})));
  ok(hunt.some(r=>String(r.no).includes('303')&&r.why==='Price'),'hunt list carries the lost quote with its coded reason');
  ok(hunt.some(r=>r.no==='308'&&/moved out/.test(r.why)),'hunt list carries the cancelled account with its cancellation reason');
  ok(!hunt.some(r=>r.no==='309'),'a consolidation is not on the hunt list');

  // lost form (no blocking prompt): mark 301 lost with a reason code and revisit date
  await p.evaluate(()=>{ lostForm27('o-301'); }); await p.waitForTimeout(200);
  await p.evaluate(()=>{ document.getElementById('lf_code').value='competitor'; document.getElementById('lf_rev').value='2026-12-01'; });
  await p.click('#lf_go'); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>{ const a=AGREEMENTS.find(x=>x.id==='o-301'); return a.stage==='lost'&&a.lost_reason_code==='competitor'&&a.revisit_date==='2026-12-01'&&a.stage_dates&&!!a.stage_dates.lost; }),'the lost form stores the coded reason, revisit date and lost date');

  // revisit due → back in Deals as an opportunity
  await p.evaluate(()=>{ const a=AGREEMENTS.find(x=>x.id==='o-301'); a.revisit_date='2026-10-01'; });
  rows=await p.evaluate(()=>dealRows27().filter(r=>r.a.id==='o-301').map(r=>({st:r.stage,tag:!!r.revisitTag})));
  ok(rows.length&&rows[0].st==='opportunity'&&rows[0].tag,'a lost deal whose revisit date arrives returns as an opportunity with a Revisit tag');

  // opportunity form carries a Source
  ok(await p.evaluate(()=>!!document.getElementById('o_source')),'the opportunity form has a Source field');

  // agreement window: commission-chain tabs
  await p.evaluate(()=>{ openModal('a-305'); }); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>{ const t=[...document.querySelectorAll('#agTabs button')].map(b=>b.textContent.trim()); return t.join('|')==='Overview|History|Commissions|Commission ledger|Invoices|Costs & margin|Files'; }),'agreement tabs follow the commission chain: '+await p.evaluate(()=>[...document.querySelectorAll('#agTabs button')].map(b=>b.textContent.trim()).join('|')));
  ok(await p.evaluate(()=>/Original start/.test(document.getElementById('agHist27').innerText)),'History tab shows the Vista timeline');
  ok(await p.evaluate(()=>/Payment 1 of 2/.test(document.getElementById('agComm27').innerText)&&/marked sold by/.test(document.getElementById('agComm27').innerText)),'Commissions tab lists each payment and who marked it sold');
  ok(await p.evaluate(()=>{ const ls=[...document.querySelectorAll('.agpane[data-pane=\"deal\"] .fld label')]; const l=ls.find(x=>x.textContent.startsWith('Quote expiration')); return l&&l.closest('.fld').style.display==='none'; }),'dormant fields are hidden on the Overview tab');
  await p.evaluate(()=>{ openModal('a-304'); }); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>{ const t=document.getElementById('agInv27').innerText; return /60001/.test(t)&&/cash confirmed/.test(t)&&/Net 60/.test(t); }),'Invoices tab lists the Vista invoice with its net-60 date');
  await p.evaluate(()=>closeModal());

  // sales reports
  await p.evaluate(()=>switchView('reports')); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>{ const t=(document.getElementById('salesRep27')||{innerText:''}).innerText; return /Won RMR/i.test(t)&&/Churned RMR/i.test(t)&&/Pipeline right now/i.test(t); }),'sales report shows win/loss, churn and the live pipeline');
  ok(await p.evaluate(()=>{ const t=document.getElementById('salesRep27').innerText; return /reliable from the day stage tracking started/.test(t); }),'the data limit is stated on the report');

  ok(!p.__errors.length,'no page errors'+(p.__errors.length?': '+p.__errors.slice(0,3).join(' | '):''));
  await browser.close();
  results.forEach(r=>console.log(r)); console.log(`\n${results.length-fail} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
