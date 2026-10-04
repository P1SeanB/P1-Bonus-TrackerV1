// Layout B end-to-end: rep Mark won with contract → admin sets up → Today → Payouts five steps (packet, approval, paid & lock) → rep My pay, question, answer.
// Clock fixed at 2027-01-18 so the Q4 2026 payout is open. Run: node tests/payout.test.js   (OUT=<dir> also writes screenshots)
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..'); const OUT=process.env.OUT||null;
const results=[]; let fail=0; const ok=(c,m)=>{ results.push((c?'PASS ':'FAIL ')+m); if(!c)fail++; };
const HYB_CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'migration_v22_spec27.sql'),'utf8').match(/select 'Hybrid', 1, 'Hybrid v1 \(revised\)', 'draft', 'mrr_multiple',\s*'(\{[\s\S]*?\})'::jsonb/)[1]);
const opp=(id,cust,owner,rmr,num)=>({id,customer_name:cust,stage:'quoting',opportunity_number:num,est_monthly_rmr:rmr,owner_email:owner,monthly_rmr:0,contract_term:36});
let DB={
  rmr_users:[{email:'sean.bithell@point1.com',role:'Administrator',permission_role:'Administrator',full_name:'Sean Bithell'},
    {email:'don.jones@point1.com',role:'Executive',permission_role:'Executive',full_name:'Don Jones'},
    {email:'jordan.lee@point1.com',role:'Representative',permission_role:'Representative',full_name:'Jordan Lee'}],
  rmr_commission_plans:[],
  rmr_agreements:[opp('o1','Lakeside Medical Plaza','jordan.lee@point1.com',100,'SSE-014-26'),opp('o2','Cedar Ridge HOA','sean.bithell@point1.com',170,'SSE-015-26'),
    opp('o3','Bayside Dental','jordan.lee@point1.com',225,'SSE-016-26'),opp('o4','Northgate Storage','jordan.lee@point1.com',250,'SSE-021-27')],
  rmr_plan_versions:[{id:'v-hyb1',family:'Hybrid',version_no:1,label:'Hybrid v1 (revised)',status:'published',effective_date:'2026-10-04',approved_by:'Sean Bithell',rate_basis:'mrr_multiple',config:HYB_CFG},
    {id:'v-hun1',family:'Hunter',version_no:1,label:'Hunter (not configured)',status:'draft',rate_basis:null,config:{family:'Hunter',placeholder:true}},
    {id:'v-far1',family:'Farmer',version_no:1,label:'Farmer (not configured)',status:'draft',rate_basis:null,config:{family:'Farmer',placeholder:true}}],
  rmr_plan_assignments:[{id:1,email:'jordan.lee@point1.com',plan_version_id:'v-hyb1',effective_from:'2026-10-04',approved_by:'sean.bithell@point1.com'},{id:2,email:'sean.bithell@point1.com',plan_version_id:'v-hyb1',effective_from:'2026-10-04',approved_by:'sean.bithell@point1.com'}],
  rmr_plan_acknowledgements:[{id:1,email:'jordan.lee@point1.com',plan_version_id:'v-hyb1',text_shown:'Hybrid v1 (revised) — written commission terms',created_at:'2026-10-05T10:00:00Z'},{id:2,email:'sean.bithell@point1.com',plan_version_id:'v-hyb1',text_shown:'terms',created_at:'2026-10-04T10:00:00Z'}],
  rmr_settings:[{key:'payout_calendar',value:{frequency:'quarterly',payWithinDays:30,verifyWithinDays:15}},{key:'feed_owners',value:{agreement_terms:{owner:'sean.bithell@point1.com'}}},
    {key:'comp_family',value:{'jordan.lee@point1.com':'Hybrid','sean.bithell@point1.com':'Hybrid'}}],
  rmr_cost_class_rules:[], rmr_draws:[], rmr_legacy_payouts:[], rmr_renewals:[], rmr_attachments:[], rmr_audit_log:[], rmr_worklist:[]};
let n=0; const shot=async(page,name,sel)=>{ if(!OUT)return; n++; const f=path.join(OUT,`${String(n).padStart(2,'0')}_${name}.png`); if(sel){ const el=await page.$(sel); if(el){ await el.screenshot({path:f}); return; } } await page.screenshot({path:f}); };
async function open(browser,email){ const ctx=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}); const page=await ctx.newPage(); const errors=[];
  await page.clock.setFixedTime(new Date('2027-01-18T18:00:00Z'));
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{ if(m.type()==='error')errors.push('console: '+m.text()); }); page.on('dialog',d=>d.accept(''));
  await page.route('**/*',async route=>{ const u=route.request().url();
    if(u.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'mock-supabase.js'),'utf8')});
    if(u.includes('xlsx.full.min.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'node_modules/xlsx/dist/xlsx.full.min.js'),'utf8')});
    if(u.includes('jspdf.umd'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'node_modules/jspdf/dist/jspdf.umd.min.js'),'utf8')});
    if(u.includes('jspdf.plugin.autotable'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js'),'utf8')});
    if(u.startsWith('http'))return route.fulfill({contentType:'text/javascript',body:''}); return route.continue(); });
  await page.addInitScript(([seed,em])=>{ localStorage.setItem('rmr_url','https://x.supabase.co'); localStorage.setItem('rmr_key','k'); window.__DB=seed; window.__EMAIL=em; },[DB,email]);
  await page.goto('file://'+path.join(ROOT,'index.html')); await page.waitForTimeout(1600); page.__errors=errors; return page; }
const save=async page=>{ DB=await page.evaluate(()=>JSON.parse(JSON.stringify(window.__DB))); await page.context().close(); };
const tmp=f=>{ const p=path.join(require('os').tmpdir(),f); fs.writeFileSync(p,'%PDF-1.4 signed'); return p; };
(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  // ===== REP marks two deals won with the signed contract
  let p=await open(browser,'jordan.lee@point1.com');
  ok(await p.evaluate(()=>view==='quarter'&&document.getElementById('pgTitle27').textContent==='My pay'),'rep lands on My pay with the page header');
  const repNav=await p.evaluate(()=>[...document.querySelectorAll('#side27 nav button')].filter(b=>b.offsetParent).map(b=>b.textContent.trim()).join('|'));
  ok(repNav==='My pay|Pipeline|My deals|Renewals|Payment history|My plan','rep side menu: '+repNav);
  await p.evaluate(()=>switchView('opportunities')); await p.waitForTimeout(300);
  await p.click('tr:has-text("Lakeside") .paidbtn:has-text("Mark won")'); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>!!document.getElementById('mw27')&&document.getElementById('mw27_go').disabled),'Mark won opens the side panel; Send stays off without the contract');
  await p.fill('#mw27_d','2026-10-20'); await p.fill('#mw27_m','100'); await p.setInputFiles('#mw27_f',tmp('Lakeside-signed.pdf')); await p.waitForTimeout(100);
  ok(await p.evaluate(()=>!document.getElementById('mw27_go').disabled&&/\$100\.00/.test(document.getElementById('mw27_est').textContent)),'contract attached → Send enabled, estimate $100.00 (36 mo × 1.0)');
  await shot(p,'rep_mark_won_panel');
  await p.click('#mw27_go'); await p.waitForTimeout(600);
  ok(await p.evaluate(()=>__DB.rmr_attachments.some(a=>a.agreement_id==='o1'&&a.category==='Signed contract')&&__DB.rmr_worklist.some(w=>w.item_uid==='won:o1'&&w.detail.contract==='Lakeside-signed.pdf')),'signed contract stored on the deal and the won request names it');
  await p.click('tr:has-text("Bayside") .paidbtn:has-text("Mark won")'); await p.waitForTimeout(200); await p.fill('#mw27_d','2026-11-02'); await p.fill('#mw27_m','225'); await p.setInputFiles('#mw27_f',tmp('Bayside-signed.pdf')); await p.click('#mw27_go'); await p.waitForTimeout(600);
  await shot(p,'rep_pipeline');
  ok(p.__errors.length===0,'rep: no page errors '+JSON.stringify(p.__errors.slice(0,3)));
  await save(p);
  // ===== ADMIN sets the deals up, then the Vista receipts arrive
  p=await open(browser,'sean.bithell@point1.com');
  ok(await p.evaluate(()=>view==='today'),'admin lands on Today');
  const admNav=await p.evaluate(()=>[...document.querySelectorAll('#side27 nav button')].filter(b=>b.offsetParent).map(b=>b.textContent.trim()).join('|'));
  ok(/^Today\|Pipeline\|Agreements\|Renewals\|Payouts\|Worklist.*\|Vista imports\|Commission history\|Renewal forecast\|Reconciliation\|Reports\|Admin$/.test(admNav),'admin side menu: '+admNav);
  const close=async(id,bill,hrs,signed)=>{ await p.evaluate(id=>winOpp(id),id); await p.waitForTimeout(250); await p.selectOption('#cd_term','36'); if(signed) await p.fill('#cd_date',signed); if(bill) await p.fill('#cd_bill',bill); await p.fill('#cd_hrs',String(hrs)); await p.fill('#cd_rate','110'); await p.fill('#cd_mat','60'); await p.fill('#cd_mon','180'); await p.waitForTimeout(150); await p.click('#cdGo27'); await p.waitForTimeout(800); };
  await close('o1','2026-11-01',1); await close('o3','2026-12-01',1);
  await close('o2','2026-11-01',1,'2026-10-25');
  const sold=await p.evaluate(()=>['o1','o2','o3'].map(id=>{ const a=AGREEMENTS.find(x=>x.id===id); return a.stage+':'+P27.events.filter(e=>e.agreement_id===id).length; }).join(','));
  ok(sold==='won:1,won:1,won:1','three deals set up and recorded ('+sold+')');
  // invoices + evidence: Lakeside paid Nov 20 (Vista receipt), Cedar Ridge paid Nov 5 (verified by hand by Sean), Bayside paid Jan 16 (after the cutoff)
  await p.evaluate(async()=>{ const bl=(n,d,a)=>[{date:d,amount:a,invoice_no:n,status:'paid'}];
    await sb.from('rmr_agreements').update({billing_log:bl('35388','2026-11-01',100),first_billing_date:'2026-11-01'}).eq('id','o1');
    await sb.from('rmr_agreements').update({billing_log:bl('35301','2026-11-01',170),first_billing_date:'2026-11-01'}).eq('id','o2');
    await sb.from('rmr_agreements').update({billing_log:bl('35702','2026-12-01',225),first_billing_date:'2026-12-01'}).eq('id','o3');
    await sb.from('rmr_vista_receipts').insert({receipt_key:'R1',invoice_number:'35388',amount:100,receipt_date:'2026-11-20'});
    await sb.from('rmr_vista_receipts').insert({receipt_key:'R3',invoice_number:'35702',amount:225,receipt_date:'2027-01-16'});
    await sb.from('rmr_receipt_verifications').insert({verification_uid:'35301|sm|1',agreement_id:'o2',invoice_number:'35301',total_amount:170,total_paid:170,evidence_state:'Confirmed',source:'sm_invoices_tab',receipt_date:'2026-11-05',verified_by:'sean.bithell@point1.com',verified_at:'2027-01-10T10:00:00Z'});
    await load(); await load27(); switchView('today'); });
  await p.waitForTimeout(500);
  const today=await p.evaluate(()=>document.getElementById('todayHost27').innerText);
  ok(/Next payout · Q4 2026/i.test(today)&&/Get the Q4 2026 approval packet signed/.test(today),'Today shows the Q4 2026 payout and the packet as the next job');
  await shot(p,'admin_today');
  await p.evaluate(()=>switchView('quarter')); await p.waitForTimeout(500);
  const st=await p.evaluate(()=>({txt:document.getElementById('steps27').innerText,ready:payoutState27().pkt}));
  ok(st.ready.items.length===2&&Math.abs(st.ready.total-135)<0.01,'packet holds the two payments earned in Q4 ($50 + $85 = $135): '+st.ready.items.map(i=>i.agreement+' '+i.amount).join(', '));
  ok(st.ready.items.find(i=>i.customer==='Cedar Ridge HOA').flag===true&&st.ready.items.find(i=>i.customer==='Lakeside Medical Plaza').flag===false,"preparer's hand-verified payment is flagged; the Vista-receipt one is not");
  ok(/Print approval packet/.test(st.txt)&&/Record Executive approval/.test(st.txt)&&/Pay & lock/.test(st.txt),'Payouts shows the five steps');
  await shot(p,'admin_payouts_steps');
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#st27print')]); const pdfPath=OUT?path.join(OUT,'packet.pdf'):path.join(require('os').tmpdir(),'packet.pdf'); await dl.saveAs(pdfPath);
  ok(fs.statSync(pdfPath).size>20000&&/Approval-packet-2026-Q4-[0-9A-F]{6}\.pdf/.test(dl.suggestedFilename()),'approval packet PDF downloads with its packet number: '+dl.suggestedFilename());
  await p.waitForTimeout(200);
  await p.click('#st27rec'); await p.waitForTimeout(200);
  await p.fill('#ra_no','2026-Q4-AAAAAA'); await p.setInputFiles('#ra_file',tmp('signed-packet.pdf')); await p.click('#ra_go'); await p.waitForTimeout(200);
  ok(/out of date/.test(await p.evaluate(()=>document.getElementById('ra_err').textContent)),'a wrong or stale packet number is refused');
  const pk=st.ready.no; await p.fill('#ra_no',pk.toLowerCase()); await shot(p,'admin_record_approval'); await p.click('#ra_go'); await p.waitForTimeout(900);
  const run=await p.evaluate(()=>{ const r=__DB.rmr_payout_runs[0]; return r&&{no:r.packet_no,by:r.approved_by,scan:r.signed_scan_path,items:(r.packet.items||[]).length,payable:__DB.rmr_ledger_entries.filter(x=>x.stage==='payable').length}; });
  ok(run&&run.no===pk&&/Don Jones/.test(run.by)&&/^payouts\/2026-Q4\//.test(run.scan)&&run.items===2&&run.payable>=2,'approval recorded: Executive, signed scan, packet lines, payable ledger entries');
  const [csv]=await Promise.all([p.waitForEvent('download'),p.click('#st27csv')]); const csvTxt=fs.readFileSync(await csv.path(),'utf8');
  ok(/Jordan Lee/.test(csvTxt)&&/Sean Bithell/.test(csvTxt)&&csvTxt.trim().split('\n').length===3,'payroll file unlocked and lists the approved lines');
  await p.click('#st27paid'); await p.waitForTimeout(200); await p.fill('#mp_d','2027-01-30'); await shot(p,'admin_mark_paid'); await p.click('#mp_go'); await p.waitForTimeout(900);
  const lock=await p.evaluate(()=>({r:__DB.rmr_payout_runs[0],paid:__DB.rmr_ledger_entries.filter(x=>x.stage==='paid').length,txt:document.getElementById('steps27').innerText}));
  ok(lock.r.locked_at&&lock.r.paid_date==='2027-01-30'&&lock.paid>=2&&/paid and locked/.test(lock.txt),'Mark paid & lock: payroll date stored, paid entries written, quarter locked');
  await shot(p,'admin_payouts_locked');
  await p.evaluate(()=>switchView('imports')); await p.waitForTimeout(400); await p.evaluate(()=>{ const d=document.querySelector('#view-imports details'); if(d)d.open=true; });
  ok(await p.evaluate(()=>document.querySelectorAll('#view-imports [data-feed27]').length===5),'Vista imports page: five slots with dropdowns');
  await shot(p,'admin_imports');
  ok(p.__errors.length===0,'admin: no page errors '+JSON.stringify(p.__errors.slice(0,3)));
  await save(p);
  // ===== REP: My pay, chart, question
  p=await open(browser,'jordan.lee@point1.com');
  const mp=await p.evaluate(()=>document.getElementById('myPay27').innerText);
  ok(/Next commission payment/i.test(mp)&&/Commission by quarter/i.test(mp)&&/My payments/i.test(mp)&&/Estimate a deal/i.test(mp),'My pay: next payment, chart, estimator, payments');
  ok(await p.evaluate(()=>document.querySelectorAll('#myPay27 svg.chart27 path, #myPay27 svg.chart27 rect[fill^="#"]').length>0),'chart draws bars');
  await shot(p,'rep_my_pay');
  await p.click('#myPay27 [data-q27]'); await p.waitForTimeout(200); await p.fill('#q27_t','The customer paid on Jan 16 — is payment 1 in this payout?'); await shot(p,'rep_question_panel'); await p.click('#q27_go'); await p.waitForTimeout(600);
  ok(await p.evaluate(()=>__DB.rmr_worklist.some(w=>w.type==='rep_question'&&w.detail.requested_by==='jordan.lee@point1.com'&&w.status==='open')),'question lands on the Worklist for the admin');
  await p.evaluate(()=>switchView('myplan')); await p.waitForTimeout(300);
  ok(/Hybrid v1 \(revised\)/.test(await p.evaluate(()=>document.getElementById('myplanHost27').innerText)),'My plan shows the accepted plan and terms');
  await shot(p,'rep_my_plan');
  ok(p.__errors.length===0,'rep: no page errors '+JSON.stringify(p.__errors.slice(0,3)));
  await save(p);
  // ===== ADMIN answers; rep sees it
  p=await open(browser,'sean.bithell@point1.com'); await p.evaluate(()=>switchView('worklist')); await p.waitForTimeout(400);
  const qid=await p.evaluate(()=>__DB.rmr_worklist.find(w=>w.type==='rep_question').id);
  await p.click(`[data-wlclose="${qid}"]`); await p.fill(`#wlb${qid}`,'Yes — it was paid after the Jan 15 cutoff, so it moves to the Q1 payout.'); await p.click(`#wlc${qid}`); await p.waitForTimeout(500);
  await save(p);
  p=await open(browser,'jordan.lee@point1.com');
  ok(/moves to the Q1 payout/.test(await p.evaluate(()=>document.getElementById('myPay27').innerText)),"rep sees the admin's answer under My questions");
  await p.evaluate(()=>document.querySelector('#myPay27 .card27:last-child').scrollIntoView()); await shot(p,'rep_answer');
  await save(p);
  await browser.close(); results.forEach(x=>console.log(x)); console.log(`\n${results.length-fail} passed, ${fail} failed`); process.exit(fail?1:0);
})();
