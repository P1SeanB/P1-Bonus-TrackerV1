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
  step('admin','Employees ▸ Add employee (email + permission role) ▸ Add'); await p.fill('#nu_em','jordan.lee@point1.com'); await p.selectOption('#nu_role','Representative'); await p.click('#nu_go'); await p.waitForTimeout(500);
  step('admin','Employees ▸ Comp plan = Hybrid'); await p.selectOption('[data-cf27="jordan.lee@point1.com"]','Hybrid'); await p.waitForTimeout(400);
  await p.evaluate(()=>document.getElementById('emp27').scrollIntoView()); await shot(p,'admin_employees_before_assign','#emp27');
  step('admin','Employees ▸ Assign Hybrid v1 (from 2026-10-04)'); await p.click('[data-cfgo27="jordan.lee@point1.com"]'); await p.waitForTimeout(500);
  step('admin','Employees ▸ Salary record (optional, for bonus)'); await p.selectOption('#sl_em','jordan.lee@point1.com'); await p.fill('#sl_amt','110000'); await p.fill('#sl_from','2026-10-04'); await p.click('#sl_go'); await p.waitForTimeout(400);
  await p.evaluate(()=>document.getElementById('emp27').scrollIntoView()); await shot(p,'admin_employees_assigned','#emp27');
  note('NOTE: rep still needs a Supabase Auth login (not creatable in-app) + connection URL/key on first visit');
  note('admin page errors: '+JSON.stringify(p.__errors)); await save(p); await p.close();
  // ===== REP: first sign-in, acknowledge, enter opportunity
  p=await open(browser,'jordan.lee@point1.com'); await p.waitForTimeout(600);
  note('REP role: '+await p.evaluate(()=>CURRENT_ROLE)+' · visible tabs: '+await p.evaluate(()=>[...document.querySelectorAll('[data-view]')].filter(b=>b.offsetParent).map(b=>b.textContent.trim()).join(' | ')));
  const ackShown=await p.evaluate(()=>!!document.getElementById('ackScrim27')); note('REP ack modal shown automatically: '+ackShown);
  if(!ackShown){ await p.evaluate(()=>checkAcknowledgement()); await p.waitForTimeout(300); }
  await shot(p,'rep_acknowledge','#ackScrim27 .modal'); step('rep','Read terms ▸ I have read and acknowledge'); await p.click('#ack27ok'); await p.waitForTimeout(500);
  await shot(p,'rep_quarter_empty');
  step('rep','Opportunities ▸ + New opportunity'); await p.evaluate(()=>switchView('opportunities')); await p.waitForTimeout(300); await p.click('#oppAddBtn'); await p.waitForTimeout(300);
  await p.fill('#o_cust','Lakeside Medical Plaza'); await p.selectOption('#o_stage','quoting'); await p.fill('#o_est','SSE-014-26'); await p.fill('#o_rmr','100'); await p.fill('#o_close','2026-10-17'); await p.fill('#o_notes','Fire alarm monitoring + annual inspection');
  step('rep','Fill customer, stage, estimate #, est. RMR, close date ▸ Save'); await shot(p,'rep_new_opportunity','#oppScrim .modal'); await p.click('#oppSave'); await p.waitForTimeout(500);
  await shot(p,'rep_opportunity_list');
  note('REP can see Won button: '+await p.evaluate(()=>!!document.querySelector('[data-oppwin]'))+' · rep sees agreements add btn: '+await p.evaluate(()=>{const b=document.getElementById('addBtn');return !!(b&&b.offsetParent);}));
  note('rep page errors: '+JSON.stringify(p.__errors)); await save(p); await p.close();
  // ===== ADMIN: opportunity won → agreement → costs → New sale
  p=await open(browser,'sean.bithell@point1.com');
  await p.evaluate(()=>switchView('opportunities')); await p.waitForTimeout(300); await shot(p,'admin_opportunity_list');
  note('ADMIN notified of new opp? worklist items about opps: '+await p.evaluate(()=>(P27.worklist||[]).filter(w=>/opp/i.test(w.type||'')).length));
  step('admin','Opportunities ▸ Won'); const oid=await p.evaluate(()=>AGREEMENTS.find(a=>a.customer_name==='Lakeside Medical Plaza').id); await p.click(`[data-oppwin="${oid}"]`); await p.waitForTimeout(400);
  await shot(p,'admin_won_agreement_editor','#scrim .modal');
  note('prefilled after Won: '+await p.evaluate(()=>JSON.stringify({num:$('f_num').value,cust:$('f_cust').value,rmr:$('f_rmr').value,term:$('f_term').value,owner:$('f_owner').value})));
  step('admin','Deal tab: agreement #, MRR, term, activation date, first billing date'); await p.fill('#f_num','171'); await p.selectOption('#f_term','36'); await p.fill('#f_date','2026-10-20'); await p.fill('#f_billdate','2026-11-01');
  note('term options: '+await p.evaluate(()=>[...document.querySelectorAll('#f_term option')].map(o=>o.value||'(blank)').join(',')));
  step('admin','Commission tab: Monthly RMR (carried from opp est.)'); await p.evaluate(()=>document.querySelector('#agTabs [data-tab="comm"]').click()); await p.fill('#f_rmr','100');
  await p.evaluate(()=>document.querySelector('#agTabs [data-tab="costs"]').click()); await p.waitForTimeout(150);
  step('admin','Costs: labour rate / inspection hours / materials / monitoring'); await p.fill('#f_rate','110'); await p.fill('#f_mat','60'); await p.fill('#f_mon','180'); await p.evaluate(()=>updatePreview());
  step('admin','Save agreement'); await p.click('#mSave'); await p.waitForTimeout(700);
  const aid=await p.evaluate(()=>(AGREEMENTS.find(a=>a.agreement_number==='171')||{}).id); note('agreement saved: '+!!aid+' · stage='+await p.evaluate(()=>(AGREEMENTS.find(a=>a.agreement_number==='171')||{}).stage));
  note('events after save (should be 0): '+await p.evaluate(()=>(__DB.rmr_comm_events||[]).length));
  await p.evaluate(id=>openModal(id),aid); await p.waitForTimeout(400); await shot(p,'admin_agreement_deal','#scrim .modal');
  step('admin','Costs tab ▸ Approve & lock cost version'); await p.evaluate(()=>document.querySelector('#agTabs [data-tab="costs"]').click()); await p.waitForTimeout(200); await shot(p,'admin_costs_tab','#scrim .modal'); await p.click('#cv27_lock'); await p.waitForTimeout(400);
  step('admin','Commission tab ▸ New sale'); await p.evaluate(()=>{ document.querySelector('#agTabs [data-tab="comm"]').click(); updatePreview(); }); await p.waitForTimeout(250); await shot(p,'admin_commission_tab_before','#scrim .modal');
  await p.click('[data-commit27="new_sale"]'); await p.waitForTimeout(600);
  note('event: '+await p.evaluate(()=>JSON.stringify((__DB.rmr_comm_events||[]).map(e=>({t:e.event_type,c:e.total_cents})))+' ledger: '+JSON.stringify((__DB.rmr_ledger_entries||[]).map(x=>x.entry_type+':'+x.amount_cents))));
  await p.evaluate(()=>updatePreview()); await shot(p,'admin_commission_tab_after','#scrim .modal');
  await p.evaluate(()=>document.querySelector('#agTabs [data-tab="hist"]').click()); await p.waitForTimeout(250); await shot(p,'admin_commission_history','#scrim .modal');
  step('admin','Billing & Files tab ▸ (after invoice) Verify collection'); await p.evaluate(()=>document.querySelector('#agTabs [data-tab="bill"]').click()); await p.waitForTimeout(300); await shot(p,'admin_billing_tab','#scrim .modal');
  note('agreement tabs: '+await p.evaluate(()=>[...document.querySelectorAll('#agTabs button')].map(b=>b.dataset.tab+':'+b.textContent.trim()).join(', ')));
  await p.evaluate(()=>closeModal()); await p.evaluate(()=>switchView('quarter')); await p.waitForTimeout(500); await shot(p,'admin_quarter_payout_run');
  await p.evaluate(()=>switchView('worklist')); await p.waitForTimeout(400); await shot(p,'admin_worklist');
  await p.evaluate(()=>switchView('recon')); await p.waitForTimeout(400); await shot(p,'admin_reconciliation_import');
  note('admin page errors: '+JSON.stringify(p.__errors)); await save(p); await p.close();
  // ===== REP: what they see afterwards
  p=await open(browser,'jordan.lee@point1.com'); await p.waitForTimeout(500);
  await p.evaluate(()=>switchView('agreements')); await p.waitForTimeout(300); await shot(p,'rep_agreements');
  note('rep agreements visible: '+await p.evaluate(()=>scopedAgreements().map(a=>a.agreement_number).join(',')));
  await p.evaluate(()=>switchView('quarter')); await p.waitForTimeout(400); await shot(p,'rep_quarter_after');
  const aid2=await p.evaluate(()=>(AGREEMENTS.find(a=>a.agreement_number==='171')||{}).id); await p.evaluate(id=>{ try{openModal(id);}catch(e){window.__oe=e.message;} },aid2); await p.waitForTimeout(400); note('rep modal open: '+await p.evaluate(()=>document.getElementById('scrim').classList.contains('show')+' err='+(window.__oe||''))); note('rep row click handler: '+await p.evaluate(()=>{ const r=document.querySelector('#agTableWrap tr[data-id], #agTableWrap tbody tr'); return r?(r.getAttribute('data-id')||'row')+' onclick='+(!!r.onclick):'none'; }));
  note('rep can save agreement: '+await p.evaluate(()=>{const b=document.getElementById('mSave'); return !!(b&&b.offsetParent&&!b.disabled);}));
  note('rep page errors: '+JSON.stringify(p.__errors));
  await browser.close(); fs.writeFileSync(path.join(OUT,'log.txt'),log.join('\n')); note('clicks: '+JSON.stringify(clicks));
})();
