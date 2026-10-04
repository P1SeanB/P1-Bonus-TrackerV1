// Scripted walkthrough (admin + rep) against demo data in the in-memory Supabase mock; writes numbered screenshots to $OUT for the user guides.
// Run: OUT=/path/to/shots node tests/walkthrough.js
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..'); const OUT=process.env.OUT; const log=[]; const note=(m)=>{log.push(m);console.log(m);};
const HYB_CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'migration_v22_spec27.sql'),'utf8').match(/select 'Hybrid', 1, 'Hybrid v1 \(revised\)', 'draft', 'mrr_multiple',\s*'(\{[\s\S]*?\})'::jsonb/)[1]);
const ag=(o)=>Object.assign({id:'a-'+o.agreement_number,customer_name:'Cust',contract_term:36,monthly_rmr:250,loaded_labor_rate:110,inspection_frequency:1,hours_per_inspection:4,material_cost_annual:150,monitoring_cost_annual:360,software_cost_annual:0,subcontractor_annual_cost:0,other_direct_annual:0,owner_email:'sean.bithell@point1.com',category:'rmr',agreement_type:'manual',autorenew:false,history_only:true,historical_import:true},o);
let DB={
  rmr_users:[{email:'sean.bithell@point1.com',role:'Administrator',permission_role:'Administrator'},{email:'exec.demo@point1.com',role:'Executive',permission_role:'Executive'}],
  rmr_commission_plans:[], rmr_agreements:[ag({agreement_number:'140',customer_name:'Harbor View Offices',activation_date:'2025-05-01',first_billing_date:'2025-05-01'}),ag({agreement_number:'141',customer_name:'Valley Unified – District Office',activation_date:'2025-08-01',first_billing_date:'2025-08-01',monthly_rmr:410})],
  rmr_plan_versions:[{id:'v-hyb1',family:'Hybrid',version_no:1,label:'Hybrid v1 (revised)',status:'draft',rate_basis:'mrr_multiple',config:HYB_CFG},
    {id:'v-hun1',family:'Hunter',version_no:1,label:'Hunter (not configured)',status:'draft',rate_basis:null,config:{family:'Hunter',placeholder:true}},
    {id:'v-far1',family:'Farmer',version_no:1,label:'Farmer (not configured)',status:'draft',rate_basis:null,config:{family:'Farmer',placeholder:true}}],
  rmr_settings:[{key:'payout_calendar',value:{frequency:'quarterly',payWithinDays:30,verifyWithinDays:15}},{key:'feed_owners',value:{}}],
  rmr_cost_class_rules:[], rmr_draws:[], rmr_legacy_payouts:[], rmr_renewals:[], rmr_attachments:[], rmr_audit_log:[], rmr_worklist:[]};
let n=0; const shot=async(page,name,sel)=>{ n++; const f=`${String(n).padStart(2,'0')}_${name}.png`; if(sel){ const el=await page.$(sel); if(el){ await el.screenshot({path:path.join(OUT,f)}); return f; } } await page.screenshot({path:path.join(OUT,f)}); return f; };
async function open(browser,email){ const page=await browser.newPage({viewport:{width:1360,height:860}}); const errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept(''));
  await page.route('**/*',async route=>{ const u=route.request().url();
    if(u.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'mock-supabase.js'),'utf8')});
    if(u.includes('xlsx.full.min.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'node_modules/xlsx/dist/xlsx.full.min.js'),'utf8')});
    if(u.startsWith('http'))return route.fulfill({contentType:'text/javascript',body:''}); return route.continue(); });
  await page.addInitScript(([seed,em])=>{ localStorage.setItem('rmr_url','https://x.supabase.co'); localStorage.setItem('rmr_key','k'); window.__DB=seed; window.__EMAIL=em; },[DB,email]);
  await page.goto('file://'+path.join(ROOT,'index.html')); await page.waitForTimeout(1500); page.__errors=errors; return page; }
const save=async page=>{ DB=await page.evaluate(()=>JSON.parse(JSON.stringify(window.__DB))); };
const clicks={}; const step=(who,what)=>{ clicks[who]=(clicks[who]||0)+1; note(`[${who}] ${what}`); };
(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  // ===== ADMIN: one-time setup — publish Hybrid, add rep, set comp plan, assign
  let p=await open(browser,'sean.bithell@point1.com');
  note('ADMIN visible tabs: '+await p.evaluate(()=>[...document.querySelectorAll('nav button, #tabs button, [data-view]')].filter(b=>b.offsetParent).map(b=>b.textContent.trim()).join(' | ')));
  await p.evaluate(()=>switchView('admin')); await p.waitForTimeout(400); await shot(p,'admin_plan_draft');
  step('admin','Admin ▸ Hybrid ▸ Preview calculation'); await p.click('#pv27'); await p.waitForTimeout(200);
  step('admin','Publish version → effective date, 48-mo confirm, terms confirm, Publish'); await p.click('#pb27'); await p.waitForTimeout(200);
  await p.fill('#pf_eff','2026-10-04'); await p.check('#pf_48'); await p.check('#pf_terms'); await shot(p,'admin_publish_form'); await p.click('#pf_go'); await p.waitForTimeout(500);
  note('published: '+await p.evaluate(()=>P27.versions.find(v=>v.id==='v-hyb1').status));
  await p.evaluate(()=>{ renderEmployees27(); document.getElementById('emp27').scrollIntoView(); }); await p.waitForTimeout(200);
  step('admin','Employees ▸ Add an employee: email, role, comp plan, start date, salary, temporary password ▸ Add employee');
  await p.fill('#nu_em','jordan.lee@point1.com'); await p.selectOption('#nu_role','Representative'); await p.selectOption('#nu_cf','Hybrid'); await p.fill('#nu_from','2026-10-04'); await p.fill('#nu_sal','110000'); await p.fill('#nu_pw','Welcome-2026');
  await shot(p,'admin_add_employee_form','#emp27'); await p.click('#nu_go'); await p.waitForTimeout(800);
  await p.evaluate(()=>document.getElementById('emp27').scrollIntoView()); await shot(p,'admin_employee_added','#emp27');
  note('nu_out: '+await p.evaluate(()=>document.getElementById('nu_out').innerText));
  note('admin page errors: '+JSON.stringify(p.__errors)); await save(p); await p.close();
  // ===== REP: first sign-in — password, plan terms, opportunity, Mark won
  p=await open(browser,'jordan.lee@point1.com'); await p.waitForTimeout(800);
  note('REP tabs: '+await p.evaluate(()=>[...document.querySelectorAll('[data-view]')].filter(b=>b.offsetParent).map(b=>b.textContent.trim()).join(' | ')));
  if(await p.$('#pwScrim27')){ await shot(p,'rep_choose_password','#pwScrim27 .modal'); step('rep','Choose your password'); await p.fill('#pw1_27','My-own-pass-1'); await p.fill('#pw2_27','My-own-pass-1'); await p.click('#pwGo27'); await p.waitForTimeout(400); } else note('NO password prompt');
  if(!await p.$('#ackScrim27')){ await p.evaluate(()=>checkAcknowledgement()); await p.waitForTimeout(300); }
  await shot(p,'rep_acknowledge','#ackScrim27 .modal'); step('rep','Read terms ▸ I have read and acknowledge'); await p.click('#ack27ok'); await p.waitForTimeout(500);
  await shot(p,'rep_my_pay_empty');
  step('rep','Opportunities ▸ + New opportunity ▸ fill ▸ Save'); await p.evaluate(()=>switchView('opportunities')); await p.waitForTimeout(300); await p.click('#oppAddBtn'); await p.waitForTimeout(300);
  await p.fill('#o_cust','Lakeside Medical Plaza'); await p.selectOption('#o_stage','quoting'); await p.fill('#o_est','SSE-014-26'); await p.fill('#o_rmr','100'); await p.fill('#o_close','2026-10-17'); await p.fill('#o_notes','Fire alarm monitoring + annual inspection');
  await shot(p,'rep_new_opportunity','#oppScrim .modal'); await p.click('#oppSave'); await p.waitForTimeout(500);
  step('rep','Customer signed ▸ Mark won ▸ signed date + final $/mo ▸ Send');   await p.click('.paidbtn:has-text("Mark won")'); await p.waitForTimeout(200); await p.fill('#mw27_d','2026-10-20'); await p.fill('#mw27_m','100');
  { const f=path.join(require('os').tmpdir(),'Lakeside-signed.pdf'); fs.writeFileSync(f,'%PDF-1.4'); await p.setInputFiles('#mw27_f',f); } await shot(p,'rep_mark_won');
  await p.click('#mw27_go'); await p.waitForTimeout(600); await shot(p,'rep_opportunity_won_waiting');
  note('rep page errors: '+JSON.stringify(p.__errors)); await save(p); await p.close();
  // ===== ADMIN: Worklist → Set up deal → Approve & record sale
  p=await open(browser,'sean.bithell@point1.com');
  await p.evaluate(()=>switchView('worklist')); await p.waitForTimeout(500); await shot(p,'admin_worklist_deal_won');
  step('admin','Worklist ▸ Set up deal'); await p.click('[data-wltype2="deal_won"]'); await p.waitForTimeout(400);
  step('admin','Close the deal: agreement #, term, costs ▸ Approve & record sale'); await p.selectOption('#cd_term','36'); await p.fill('#cd_bill','2026-11-01'); await p.fill('#cd_hrs','1'); await p.fill('#cd_rate','110'); await p.fill('#cd_mat','60'); await p.fill('#cd_mon','180'); await p.waitForTimeout(200);
  await shot(p,'admin_close_the_deal','#cdScrim27 .modal'); await p.click('#cdGo27'); await p.waitForTimeout(900);
  note('after close: '+await p.evaluate(()=>{ const a=AGREEMENTS.find(x=>x.customer_name==='Lakeside Medical Plaza'); return JSON.stringify({num:a.agreement_number,stage:a.stage,events:P27.events.length,ledger:P27.ledger.map(x=>x.stage+':'+x.amount_cents)}); }));
  await p.evaluate(()=>switchView('quarter')); await p.waitForTimeout(500); await shot(p,'admin_quarter_view');
  await p.evaluate(()=>{ selQI=CUR_QI; renderQuarter(); document.getElementById('qTableWrap').scrollIntoView(); }); await p.waitForTimeout(300); await shot(p,'admin_quarter_lines','#qTableWrap');
  await p.evaluate(()=>switchView('agreements')); await p.waitForTimeout(300); await shot(p,'admin_agreements');
  note('admin page errors: '+JSON.stringify(p.__errors)); await save(p); await p.close();
  // ===== REP: My pay and the read-only agreement
  p=await open(browser,'jordan.lee@point1.com'); await p.waitForTimeout(600);
  await shot(p,'rep_my_pay'); await p.evaluate(()=>switchView('agreements')); await p.waitForTimeout(300); await shot(p,'rep_my_agreements');
  step('rep','My agreements ▸ View'); await p.click('[data-view27]'); await p.waitForTimeout(300); await shot(p,'rep_agreement_view','#vwScrim27 .modal');
  note('rep page errors: '+JSON.stringify(p.__errors));
  await browser.close(); fs.writeFileSync(path.join(OUT,'log.txt'),log.join('\n')); note('clicks: '+JSON.stringify(clicks));
})();
