// Screenshots with numbered orange highlights for the Admin & Executive user guide. Run: OUT=<dir> node tests/guide_shots.js
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path'); const XLSX=require('xlsx');
const ROOT=path.resolve(__dirname,'..'); const OUT=process.env.OUT; fs.mkdirSync(OUT,{recursive:true});
const HYB_CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'migration_v22_spec27.sql'),'utf8').match(/select 'Hybrid', 1, 'Hybrid v1 \(revised\)', 'draft', 'mrr_multiple',\s*'(\{[\s\S]*?\})'::jsonb/)[1]);
const opp=(id,cust,owner,rmr,num,stage)=>({id,customer_name:cust,stage:stage||'quoting',opportunity_number:num,est_monthly_rmr:rmr,owner_email:owner,monthly_rmr:0,contract_term:36,expected_close:'2026-11-15'});
let DB={
  rmr_users:[{email:'sean.bithell@point1.com',role:'Administrator',permission_role:'Administrator',full_name:'Sean Bithell'},
    {email:'don.jones@point1.com',role:'Executive',permission_role:'Executive',full_name:'Don Jones'},
    {email:'shane.stoltenberg@point1.com',role:'Executive',permission_role:'Executive',full_name:'Shane Stoltenberg'}],
  rmr_commission_plans:[],
  rmr_agreements:[opp('o2','Cedar Ridge HOA','sean.bithell@point1.com',170,'SSE-015-26')],
  rmr_plan_versions:[{id:'v-hyb1',family:'Hybrid',version_no:1,label:'Hybrid v1 (revised)',status:'published',effective_date:'2026-10-04',approved_by:'Sean Bithell',approved_at:'2026-10-03T20:00:00Z',rate_basis:'mrr_multiple',config:HYB_CFG},
    {id:'v-hun1',family:'Hunter',version_no:1,label:'Hunter (not configured)',status:'draft',rate_basis:null,config:{family:'Hunter',placeholder:true}},
    {id:'v-far1',family:'Farmer',version_no:1,label:'Farmer (not configured)',status:'draft',rate_basis:null,config:{family:'Farmer',placeholder:true}}],
  rmr_plan_assignments:[{id:2,email:'sean.bithell@point1.com',plan_version_id:'v-hyb1',effective_from:'2026-10-04',approved_by:'sean.bithell@point1.com'}],
  rmr_plan_acknowledgements:[{id:2,email:'sean.bithell@point1.com',plan_version_id:'v-hyb1',text_shown:'terms',created_at:'2026-10-04T10:00:00Z',acknowledged_at:'2026-10-04T10:00:00Z'}],
  rmr_settings:[{key:'payout_calendar',value:{frequency:'quarterly',payWithinDays:30,verifyWithinDays:15}},{key:'feed_owners',value:{agreement_terms:{owner:'sean.bithell@point1.com'},invoices:{owner:'sean.bithell@point1.com',backup:'Any Executive'},receipts:{owner:'sean.bithell@point1.com',backup:'Any Executive'}}},
    {key:'comp_family',value:{'sean.bithell@point1.com':'Hybrid'}}],
  rmr_salary_records:[], rmr_cost_class_rules:[], rmr_draws:[], rmr_legacy_payouts:[], rmr_renewals:[], rmr_attachments:[], rmr_audit_log:[], rmr_worklist:[]};
const shots=[]; let n=0;
async function open(browser,email,when){ const ctx=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true,deviceScaleFactor:1}); const page=await ctx.newPage();
  await page.clock.setFixedTime(new Date(when+'T18:00:00Z')); page.__errors=[];
  page.on('pageerror',e=>page.__errors.push(e.message)); page.on('dialog',d=>d.accept(''));
  await page.route('**/*',async route=>{ const u=route.request().url();
    const lib={ 'supabase-js':'mock-supabase.js','xlsx.full.min.js':'node_modules/xlsx/dist/xlsx.full.min.js','jspdf.umd':'node_modules/jspdf/dist/jspdf.umd.min.js','jspdf.plugin.autotable':'node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js'};
    for(const k in lib) if(u.includes(k)) return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,lib[k]),'utf8')});
    if(u.startsWith('http'))return route.fulfill({contentType:'text/javascript',body:''}); return route.continue(); });
  await page.addInitScript(([seed,em])=>{ localStorage.setItem('rmr_url','https://x.supabase.co'); localStorage.setItem('rmr_key','k'); window.__DB=seed; window.__EMAIL=em;
    document.addEventListener('DOMContentLoaded',()=>{ const s=document.createElement('style'); s.textContent='.toast{display:none!important}'; document.head.appendChild(s); }); },[DB,email]);
  await page.goto('file://'+path.join(ROOT,'index.html')); await page.waitForTimeout(1600); return page; }
const save=async p=>{ DB=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__DB))); if(p.__errors.length) console.log('ERRORS',p.__errors); await p.context().close(); };
// marks: [selector, number] — selector may be 'text=Exact words' or 'up:#id' (the input's field wrapper)
async function mark(page,marks,scrollSel){
  await page.evaluate(([marks,scrollSel])=>{
    document.querySelectorAll('.hl27x').forEach(x=>x.remove());
    const find=s=>{ if(s.startsWith('text=')){ const t=s.slice(5); return [...document.querySelectorAll('button,a,summary,label,th,h2,h3,span,b,div')].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed').find(e=>e.textContent.trim()===t)||null; }
      if(s.startsWith('up:')){ const e=document.querySelector(s.slice(3)); return e&&(e.closest('label,.fld,.fld27,.cfg-row')||e.parentElement); } return document.querySelector(s); };
    if(scrollSel){ const e=find(scrollSel); if(e) e.scrollIntoView({block:'start'}); window.scrollBy(0,-90); }
    marks.forEach(([s,num])=>{ const el=find(s); if(!el){ console.warn('MISSING '+s); return; } const r=el.getBoundingClientRect();
      const b=document.createElement('div'); b.className='hl27x'; b.style.cssText=`position:fixed;left:${r.left-4}px;top:${r.top-4}px;width:${r.width+8}px;height:${r.height+8}px;border:3px solid #F27123;border-radius:9px;box-shadow:0 0 0 4px rgba(242,113,35,.20);z-index:99998;pointer-events:none;box-sizing:border-box`; document.body.appendChild(b);
      const d=document.createElement('div'); d.className='hl27x'; d.textContent=num; d.style.cssText=`position:fixed;left:${Math.max(3,r.left-16)}px;top:${Math.max(3,r.top-16)}px;width:26px;height:26px;border-radius:50%;background:#F27123;color:#fff;font:800 14px/26px 'DM Sans',Arial,sans-serif;text-align:center;z-index:99999;box-shadow:0 2px 6px rgba(0,0,0,.3);pointer-events:none`; document.body.appendChild(d); });
  },[marks,scrollSel||null]);
  await page.waitForTimeout(120);
}
async function shot(page,name,clipSel,pad){ n++; const f=`${String(n).padStart(2,'0')}_${name}.png`; let clip;
  if(clipSel){ clip=await page.evaluate(([s,p])=>{ const e=document.querySelector(s); if(!e)return null; const r=e.getBoundingClientRect(); const x=Math.max(0,r.left-p), y=Math.max(0,r.top-p); return {x,y,width:Math.min(window.innerWidth-x,r.width+2*p),height:Math.min(window.innerHeight-y,r.height+2*p)}; },[clipSel,pad==null?24:pad]); }
  await page.screenshot({path:path.join(OUT,f),clip:clip||undefined}); shots.push(f); await page.evaluate(()=>document.querySelectorAll('.hl27x').forEach(x=>x.remove())); return f; }
const tmp=(f,body)=>{ const p=path.join(require('os').tmpdir(),f); fs.writeFileSync(p,body||'%PDF-1.4 signed'); return p; };
const close=async(p,name,o)=>{ await p.evaluate(n=>winOpp(AGREEMENTS.find(a=>a.customer_name===n).id),name); await p.waitForTimeout(300); if(o.num) await p.fill('#cd_num',o.num); if(o.date) await p.fill('#cd_date',o.date); await p.selectOption('#cd_term','36'); await p.fill('#cd_bill',o.bill); await p.fill('#cd_hrs','1'); await p.fill('#cd_rate','110'); await p.fill('#cd_mat','60'); await p.fill('#cd_mon','180'); await p.waitForTimeout(200); };

(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  // ========== 1. Admin: frame, plan, add employee (Oct 4 2026)
  let p=await open(browser,'sean.bithell@point1.com','2026-10-04');
  await mark(p,[['#side27 nav',1],['#pageHead27',2],['#scopeBar',3],['#guideBtn',4],['#signoutBtn',5]]); await shot(p,'frame_today');
  await p.evaluate(()=>switchView('admin')); await p.waitForTimeout(400);
  await mark(p,[['[data-fam27="Hybrid"]',1],['#newdraft27',2],['#pv27',3]],'[data-fam27="Hybrid"]'); await shot(p,'admin_plans');
  await p.evaluate(()=>{ renderEmployees27(); }); await p.waitForTimeout(200);
  await p.fill('#nu_em','jordan.lee@point1.com'); await p.selectOption('#nu_role','Representative'); await p.selectOption('#nu_cf','Hybrid'); await p.fill('#nu_from','2026-10-05'); await p.fill('#nu_sal','110000'); await p.fill('#nu_pw','Welcome-2026');
  await mark(p,[['up:#nu_em',1],['up:#nu_role',2],['up:#nu_cf',3],['up:#nu_from',4],['up:#nu_sal',5],['up:#nu_pw',6],['#nu_go',7]],'#emp27'); await shot(p,'admin_add_employee');
  await p.click('#nu_go'); await p.waitForTimeout(900);
  await p.evaluate(()=>{ const o=document.getElementById('nu_out'); o.innerHTML=o.innerHTML.replace(/file:\/\/[^\s<]*index\.html/g,'https://p1seanb.github.io/P1-Bonus-TrackerV1/'); });
  await mark(p,[['#nu_out',1],['text=jordan.lee@point1.com',2]],'#emp27'); await shot(p,'admin_employee_added');
  await p.evaluate(()=>{ const e=document.getElementById('cal27'); if(e) e.scrollIntoView(); window.scrollBy(0,-90); }); await shot(p,'admin_calendar_owners');
  await save(p);
  // ========== 2. Rep first sign-in (Oct 5)
  p=await open(browser,'jordan.lee@point1.com','2026-10-05'); await p.waitForTimeout(500);
  if(await p.$('#pwScrim27')){ await p.fill('#pw1_27','My-own-pass-1'); await p.fill('#pw2_27','My-own-pass-1'); await shot(p,'rep_choose_password'); await p.click('#pwGo27'); await p.waitForTimeout(500); }
  if(!await p.$('#ackScrim27')){ await p.evaluate(()=>checkAcknowledgement()); await p.waitForTimeout(400); }
  await mark(p,[['#ack27ok',1]]); await shot(p,'rep_acknowledge'); await p.click('#ack27ok'); await p.waitForTimeout(600);
  // rep adds two opportunities and marks one won (Oct 20)
  await save(p);
  p=await open(browser,'jordan.lee@point1.com','2026-10-20');
  await p.evaluate(()=>switchView('opportunities')); await p.waitForTimeout(300);
  for(const [cust,num,rmr] of [['Lakeside Medical Plaza','SSE-014-26','100'],['Bayside Dental','SSE-016-26','225'],['Northgate Storage','SSE-021-26','250']]){
    await p.click('#oppAddBtn'); await p.waitForTimeout(300); await p.fill('#o_cust',cust); await p.selectOption('#o_stage','quoting'); await p.fill('#o_est',num); await p.fill('#o_rmr',rmr); await p.fill('#o_close','2026-11-15'); await p.click('#oppSave'); await p.waitForTimeout(500); }
  await p.click('tr:has-text("Lakeside") .paidbtn:has-text("Mark won")'); await p.waitForTimeout(200); await p.fill('#mw27_d','2026-10-20'); await p.fill('#mw27_m','100'); await p.setInputFiles('#mw27_f',tmp('Lakeside-signed.pdf')); await p.waitForTimeout(150);
  await mark(p,[['up:#mw27_m',1],['#mw27_box',2],['#mw27_go',3]]); await shot(p,'rep_mark_won'); await p.click('#mw27_go'); await p.waitForTimeout(700);
  await p.click('tr:has-text("Bayside") .paidbtn:has-text("Mark won")'); await p.waitForTimeout(200); await p.fill('#mw27_d','2026-11-02'); await p.fill('#mw27_m','225'); await p.setInputFiles('#mw27_f',tmp('Bayside-signed.pdf')); await p.click('#mw27_go'); await p.waitForTimeout(700);
  await save(p);
  // ========== 3. Admin sets up the deals (Nov 3)
  p=await open(browser,'sean.bithell@point1.com','2026-11-03');
  await mark(p,[['text=Deal won — set up the agreement',1]]); await shot(p,'admin_today_deal_won');
  await p.evaluate(()=>switchView('opportunities')); await p.waitForTimeout(400);
  await mark(p,[['#oppTableWrap',1]]); await shot(p,'admin_pipeline');
  await p.evaluate(()=>switchView('worklist')); await p.waitForTimeout(500);
  await mark(p,[['[data-wltype2="deal_won"]',1]]); await shot(p,'admin_worklist_deal_won');
  await p.setViewportSize({width:1440,height:1240}); await close(p,'Lakeside Medical Plaza',{bill:'2026-11-01'});
  await mark(p,[['up:#cd_num',1],['up:#cd_date',2],['up:#cd_term',3],['up:#cd_bill',4],['up:#cd_hrs',5],['#cdPrev27',6],['#cdGo27',7]]); await shot(p,'admin_close_deal');
  await p.setViewportSize({width:1440,height:900}); await p.click('#cdGo27'); await p.waitForTimeout(900);
  await close(p,'Bayside Dental',{bill:'2026-12-01'}); await p.click('#cdGo27'); await p.waitForTimeout(900);
  await close(p,'Cedar Ridge HOA',{bill:'2026-11-01',date:'2026-10-25'}); await p.click('#cdGo27'); await p.waitForTimeout(900);
  await p.evaluate(()=>switchView('agreements')); await p.waitForTimeout(400); await shot(p,'admin_agreements');
  await p.evaluate(()=>openModal(AGREEMENTS.find(a=>a.customer_name==='Lakeside Medical Plaza').id)); await p.waitForTimeout(500); await p.evaluate(()=>{ document.querySelector('#agTabs [data-tab="comm"]').click(); updatePreview(); }); await p.waitForTimeout(300);
  await shot(p,'admin_agreement_commission');
  await p.evaluate(()=>closeModal()); await save(p);
  // ========== 4. Vista imports + verification (Jan 10 2027)
  p=await open(browser,'sean.bithell@point1.com','2027-01-10');
  await p.evaluate(async()=>{ const id=n=>AGREEMENTS.find(a=>a.customer_name===n).id; const bl=(n,d,a)=>[{date:d,amount:a,invoice_no:n,status:'invoiced'}];
    await sb.from('rmr_agreements').update({billing_log:bl('35388','2026-11-01',100).concat([{date:'2026-12-01',amount:100,invoice_no:'',status:'auto'}])}).eq('id',id('Lakeside Medical Plaza'));
    await sb.from('rmr_agreements').update({billing_log:bl('35301','2026-11-01',170)}).eq('id',id('Cedar Ridge HOA'));
    await sb.from('rmr_agreements').update({billing_log:bl('35702','2026-12-01',225)}).eq('id',id('Bayside Dental'));
    await sb.from('rmr_vista_receipts').insert({receipt_key:'R1',invoice_number:'35388',amount:100,receipt_date:'2026-11-20'});
    await load(); await load27(); });
  // Agreement List first (grouped, as Vista prints it) — supplies each agreement's Vista customer number
  await p.evaluate(async()=>{ const A=n=>AGREEMENTS.find(a=>a.customer_name===n).agreement_number; const D=s=>new Date(s+'T08:00:00Z');
    const rows=[['SM Agreement List'],['Sorting by Customer Number','Showing All Agreements','Revision Status Filter Legend ','Displaying: All Statuses'],['Dates','Amount\nBilled ','Previous\nRevision','Rev.','Effective',null,'Activated','Cancelled','Terminated','Expiration','Price','Status']];
    [['Lakeside Medical Plaza',612],['Cedar Ridge HOA',618],['Bayside Dental',640]].forEach(([n,c])=>{ rows.push([`Customer: ${c} (${n})`,'','']); rows.push([`Agreement: ${A(n)} - ${n} - Monitoring`,'Status: Active','']); rows.push(['Term: 11/01/26 to 10/31/29 (Active)','Total Term Price: 0.00','Total Term Billed: 0.00','']); rows.push([1,D('2026-11-01'),D('2026-10-28'),null,null,D('2029-10-31'),0,'',0,null,'Active']); });
    rows.push(['Customer: 655 (Harbor Point Apartments)','','']); rows.push(['Agreement: 171 - Harbor Point Apartments - FA Monitoring','Status: Active','']); rows.push([1,D('2026-12-01'),D('2026-11-20'),null,null,D('2029-11-30'),0,'',0,null,'Active']);
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'S'); const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});
    await stageFile('agreement_terms',new File([buf],'SM Agreement List all statuses.xlsx'),'manual'); await commitStaged(); });
  await p.evaluate(()=>switchView('imports')); await p.waitForTimeout(500);
  await p.evaluate(()=>{ const d=document.querySelectorAll('#view-imports details')[1]; if(d) d.open=true; });
  await mark(p,[['#impIntro27 .kpis27',1],['#view-imports [data-feed27="agreement_terms"]',2],['#view-imports [data-feed27="invoices"]',3],['#view-imports details[open] summary',4]]); await shot(p,'admin_imports');
  const mk=rows=>{ const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'S'); return XLSX.write(wb,{type:'base64',bookType:'xlsx'}); };
  // the real SM Invoice List layout: parameter echo, header, and Customer # / Name printed as two cells
  const inv=mk([['SM Invoice List','Sorted by:','Invoice','Show Only Open Balances:','N','Invoice Dates:','10/01/26 - 12/31/26','Status:','All','Service Site:',' ','Work Order:',0],
    ['\nInvoice','\nStatus','\nCustomer # / Name','\nBill To Customer','Invoice\nDate',' Post Month','\nDue Date','\nAmount','\nTax','\nTotal','\nBalance'],
    ['     35301','Invoiced',618,'Cedar Ridge HOA','','11/1/2026','11/1/2026','12/1/2026',170,0,170,0],['     35388','Invoiced',612,'Lakeside Medical Plaza','','11/1/2026','11/1/2026','12/1/2026',100,0,100,0],
    ['     35702','Invoiced',640,'Bayside Dental','','12/1/2026','12/1/2026','12/31/2026',225,0,225,225],['     35711','Invoiced',612,'Lakeside Medical Plaza','','12/1/2026','12/1/2026','12/31/2026',100,0,100,100],
    ['     35810','Invoiced',702,'Unknown Tenant LLC','','12/5/2026','12/1/2026','1/4/2027',90,0,90,90],['     35815','Voided',702,'Unknown Tenant LLC','','12/6/2026','12/1/2026','1/5/2027',0,0,0,0],
    ['Grand Totals:',null,685,0,685,415],['2   Point One Electrical Systems','Page 1','01/10/27  09:35:19 AM','Date Format - MM/DD/YY','SMInvoiceList.rpt']]);
  await p.evaluate(async([b64])=>{ const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); await stageFile('invoices',new File([bin],'SM Invoice List Q4.xlsx'),'manual'); },[inv]); await p.waitForTimeout(400);
  await p.evaluate(()=>{ const d=[...document.querySelectorAll('#stage27 details')].pop(); if(d) d.open=true; });
  await mark(p,[['#stage27',1],['#st27ok',2]],'#stage27'); await shot(p,'admin_import_preview');
  await p.click('#st27ok'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ openModal(AGREEMENTS.find(a=>a.customer_name==='Cedar Ridge HOA').id); }); await p.waitForTimeout(500); await p.evaluate(()=>document.querySelector('#agTabs [data-tab="bill"]').click()); await p.waitForTimeout(300); await p.click('#blogToggle'); await p.waitForTimeout(300);
  await p.click('[data-verify-row="0"]'); await p.waitForTimeout(200); await p.fill('#vf_paid','170'); await p.fill('#vf_billed','170'); await p.selectOption('#vf_status','Paid'); await p.fill('#vf_rdate','2026-11-05'); await p.fill('#vf_note','SM Agreements ▸ Invoices tab, read Jan 10');
  await mark(p,[['#verifyForm27',1],['#vf_save',2]],'#verifyForm27'); await shot(p,'admin_verify_collection');
  await p.click('#vf_save'); await p.waitForTimeout(600); await p.evaluate(()=>closeModal()); await save(p);
  // ========== 5. Payout (Jan 18 2027)
  p=await open(browser,'sean.bithell@point1.com','2027-01-18');
  await p.evaluate(()=>switchView('quarter')); await p.waitForTimeout(600);
  await mark(p,[['#steps27 .step27:nth-child(1)',1],['#steps27 .step27:nth-child(2)',2],['#steps27 .step27:nth-child(3)',3],['#steps27 .step27:nth-child(4)',4],['#steps27 .step27:nth-child(5)',5],['#st27adj',6]]); await shot(p,'payouts_steps');
  await mark(p,[['#payoutRun27 .cards',1],['#payoutRun27 details',2]],'#payoutRun27'); await shot(p,'payouts_run_detail');
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.click('#st27adj'); await p.waitForTimeout(200); await p.selectOption('#aj_ag',await p.evaluate(()=>AGREEMENTS.find(a=>a.customer_name==='Lakeside Medical Plaza').id)); await p.fill('#aj_amt','25'); await p.fill('#aj_why','Customer added a second monitoring line on Nov 12 — $25/mo × 1.0');
  await mark(p,[['up:#aj_ag',1],['up:#aj_to',2],['up:#aj_amt',3],['up:#aj_why',4],['up:#aj_by',5],['#aj_go',6]]); await shot(p,'adjust_commission'); await p.click('#aj_go'); await p.waitForTimeout(700);
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#st27print')]); await dl.saveAs(path.join(OUT,'packet.pdf')); await p.waitForTimeout(300);
  const pk=await p.evaluate(()=>payoutState27().pkt.no);
  await p.click('#st27rec'); await p.waitForTimeout(200); await p.fill('#ra_no',pk); await p.setInputFiles('#ra_file',tmp('Q4-packet-signed.pdf'));
  await mark(p,[['up:#ra_by',1],['up:#ra_on',2],['up:#ra_no',3],['#ra_fbox',4],['#ra_go',5]]); await shot(p,'record_approval'); await p.click('#ra_go'); await p.waitForTimeout(900);
  await mark(p,[['#st27csv',1],['#st27paid',2]]); await shot(p,'payouts_approved');
  await p.click('#st27paid'); await p.waitForTimeout(200); await p.fill('#mp_d','2027-01-30'); await mark(p,[['up:#mp_d',1],['#mp_go',2]]); await shot(p,'mark_paid'); await p.click('#mp_go'); await p.waitForTimeout(900);
  await shot(p,'payouts_locked'); await save(p);
  // ========== 6. Rep asks, admin answers (Feb 2)
  p=await open(browser,'jordan.lee@point1.com','2027-02-02');
  await mark(p,[['#myPay27 .kpis27',1],['#myPay27 svg.chart27',2]]); await shot(p,'rep_my_pay');
  const qi=await p.evaluate(()=>[...document.querySelectorAll('#myPay27 [data-q27]')].findIndex(b=>/Bayside/.test(b.closest('tr').innerText)));
  await p.click(`#myPay27 [data-q27="${Math.max(0,qi)}"]`); await p.waitForTimeout(200); await p.fill('#q27_t','Bayside paid the first invoice on Jan 16 — why is payment 1 not in the January payout?'); await p.click('#q27_go'); await p.waitForTimeout(600);
  await save(p);
  p=await open(browser,'sean.bithell@point1.com','2027-02-02');
  await p.evaluate(()=>switchView('worklist')); await p.waitForTimeout(500);
  const qid=await p.evaluate(()=>__DB.rmr_worklist.find(w=>w.type==='rep_question').id);
  await p.click(`[data-wlclose="${qid}"]`); await p.fill(`#wlb${qid}`,'It was paid after the Jan 15 cutoff, so it moves to the April payout.');
  await mark(p,[[`#wlb${qid}`,1],[`#wlc${qid}`,2]]); await shot(p,'worklist_answer'); await p.click(`#wlc${qid}`); await p.waitForTimeout(500);
  for(const v of ['renewals','history','recon','reports']){ await p.evaluate(v=>switchView(v),v); await p.waitForTimeout(500); await shot(p,'page_'+v); }
  await save(p);
  // ========== Worklist: Link invoices the import suggested
  p=await open(browser,'sean.bithell@point1.com','2027-01-20');
  await p.evaluate(async()=>{ switchView('worklist'); WL_FILTER.owner='__all'; WL_FILTER.type='unmatched_vista'; WL_FILTER.status='open'; await renderWorklist(); }); await p.waitForTimeout(500);
  await mark(p,[['#wlBody table tbody tr:nth-child(1) td:nth-child(2)',1],['#wlBody table tbody tr:nth-child(2) td:nth-child(2)',2],['[data-wllink]',3],['#wlBody table tbody tr:nth-child(2) [data-wlclose]',4]],'#wlBody table'); await shot(p,'worklist_link_invoices');
  await save(p);
  await browser.close(); fs.writeFileSync(path.join(OUT,'shots.json'),JSON.stringify(shots,null,1)); console.log(shots.join('\n'));
})();
