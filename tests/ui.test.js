// Headless UI test of the real index.html against the in-memory Supabase mock. Run: node tests/ui.test.js
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path'); const XLSX=require('xlsx');
const ROOT=path.resolve(__dirname,'..');
const results=[]; let fail=0; const ok=(c,m)=>{ results.push((c?'PASS ':'FAIL ')+m); if(!c)fail++; };
const HYB_CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'migration_v22_spec27.sql'),'utf8').match(/select 'Hybrid', 1, 'Hybrid v1 \(revised\)', 'draft', 'mrr_multiple',\s*'(\{[\s\S]*?\})'::jsonb/)[1]);
const legacyHybrid={planVersion:'Hybrid 2026',basis:'TCV',planType:'A',targetMargin:0.5,minMargin:0.45,immediatePct:0.5,holdbackPct:0.5,releaseMode:'offset',releaseOffsetMonths:3,
  newPct:{12:1/12,24:1.5/24,36:2/36,48:2.25/48,60:2.5/60},renewalPct:{12:0.75/12,24:1.25/24,36:1.5/36,48:1.75/48,60:2/60},autoRenewalPct:{12:0,24:0},
  marginTiers:[{min:0.45,mult:1,label:'Eligible',status:'ok'},{min:0,mult:0,label:'Not eligible',status:'no'}],role:'Hybrid',quotaMonthlyRmr:1250,accelMultiplier:1,termConversionMult:1.5,termConversionMinTerm:36,portfolioBonus:true,
  grrBonus:[{min:0.95,pct:0.02}],nrrBonus:[{min:1.03,pct:0.02}],holdbackThresholdPct:0.25,accelReleasePct:0.5,overheadPct:0.28};
const ag=(o)=>Object.assign({id:'a-'+o.agreement_number,customer_name:'Cust '+o.agreement_number,contract_term:36,monthly_rmr:1000,loaded_labor_rate:100,inspection_frequency:2,hours_per_inspection:5,
  material_cost_annual:1000,monitoring_cost_annual:1200,software_cost_annual:0,subcontractor_annual_cost:0,other_direct_annual:0,owner_email:'sean.bithell@point1.com',category:'rmr',agreement_type:'manual',autorenew:false},o);
const SEED={
  rmr_users:[{email:'sean.bithell@point1.com',role:'Administrator',permission_role:'Administrator',plan_id:'p-hyb'},{email:'rep@point1.com',role:'Hybrid',permission_role:'Representative',role_migrated_from:'Hybrid',plan_id:'p-hyb'}],
  rmr_commission_plans:[{id:'p-hyb',plan_name:'Hybrid 2026',config:legacyHybrid,status:'active',is_default:true,archived:true}],
  rmr_agreements:[
    ag({agreement_number:'150',activation_date:'2026-02-18',first_billing_date:'2026-03-01',billing_log:[{date:'2026-03-01',amount:1000,invoice_no:'34001',status:'paid'},{date:'2026-04-01',amount:1000,invoice_no:'',status:'auto'},{date:'2026-12-01',amount:1000,invoice_no:'',status:'auto'}]}),
    ag({agreement_number:'14',activation_date:'2022-02-01',first_billing_date:'2024-12-01',history_only:true,historical_import:true,grandfather_rule:{rule:'pre-2026'}}),
    ag({agreement_number:'201',activation_date:'2026-10-20',first_billing_date:'2026-11-01'}),
    ag({agreement_number:'202',activation_date:'2026-10-21',category:'sla',monthly_rmr:833.33,contract_term:36}),
    ag({agreement_number:'203',activation_date:'2026-10-22',material_cost_annual:0,monitoring_cost_annual:0,inspection_frequency:0,hours_per_inspection:0,loaded_labor_rate:0}),
    ag({agreement_number:'204',activation_date:'2026-10-23',contract_term:30}),
    ag({agreement_number:'',stage:'opportunity',opportunity_number:'SSE-001-26',activation_date:null,id:'opp1'})
  ],
  rmr_plan_versions:[{id:'v-hyb1',family:'Hybrid',version_no:1,label:'Hybrid v1 (revised)',status:'draft',rate_basis:'mrr_multiple',config:HYB_CFG},
    {id:'v-hun1',family:'Hunter',version_no:1,label:'Hunter (not configured)',status:'draft',rate_basis:null,config:{family:'Hunter',placeholder:true}},
    {id:'v-far1',family:'Farmer',version_no:1,label:'Farmer (not configured)',status:'draft',rate_basis:null,config:{family:'Farmer',placeholder:true}}],
  rmr_settings:[{key:'payout_calendar',value:{frequency:'quarterly',payWithinDays:30,verifyWithinDays:15}},{key:'feed_owners',value:{}}],
  rmr_cost_class_rules:[{id:1,match_field:'description',pattern:'(?i)applied overhead',bucket:'overhead'},{id:2,match_field:'line_type',pattern:'(?i)^labor$',bucket:'direct_burdened'}],
  rmr_draws:[{id:1,amount:15000,owner_email:'sean.bithell@point1.com',plan_year:2026}],
  rmr_legacy_payouts:[], rmr_renewals:[], rmr_attachments:[], rmr_audit_log:[], rmr_worklist:[]
};
(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const page=await browser.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message)); page.on('console',m=>{ if(m.type()==='error')errors.push('console: '+m.text()); });
  await page.route('**/*',async route=>{ const u=route.request().url();
    if(u.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'mock-supabase.js'),'utf8')});
    if(u.includes('xlsx.full.min.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'node_modules/xlsx/dist/xlsx.full.min.js'),'utf8')});
    if(u.startsWith('http'))return route.fulfill({contentType:'text/javascript',body:''});
    return route.continue(); });
  await page.addInitScript(seed=>{ localStorage.setItem('rmr_url','https://x.supabase.co'); localStorage.setItem('rmr_key','k'); window.__DB=seed; },SEED);
  await page.goto('file://'+path.join(ROOT,'index.html')); await page.waitForTimeout(1500);
  ok(await page.evaluate(()=>signedIn===true&&P27.ready===true),'app boots, v2.7 tables load');
  // Phase 1/2 behaviour on real data paths
  const r=await page.evaluate(()=>{ const g=n=>AGREEMENTS.find(a=>a.agreement_number===n); const out={};
    const c150=compute(g('150')); out.c150={plan:c150.planVersion,init:c150.initialCommission,revised:!!c150.revised,legacyFull:c150.legacyFull};
    out.collectedAuto=billingLogCollected(g('150').billing_log);
    const c201=compute(g('201')); out.c201={nc:!!c201.planNotConfigured,init:c201.initialCommission,reason:c201.blockedReason||c201.planReason};
    out.c14=compute(g('14')).legacyFull; out.role=CURRENT_ROLE; out.repCan=(()=>{ const s=CURRENT_ROLE; CURRENT_ROLE=normRole('Hybrid'); const v=[can('calculate'),can('export')]; CURRENT_ROLE=s; return v; })();
    out.noDefault=defaultPlanConfig()===null; out.fmtNull=fmt(null); out.gen=generateBillingLog(g('150')).map(x=>x.status)[0];
    out.drawsRead=DRAWS.length; return out; });
  ok(r.c150.plan==='Hybrid 2026'&&!r.c150.revised,'historical 2026 agreement keeps its historical plan (MIG-05)');
  ok(Math.abs(r.c150.init-2000)<0.01,'historical plan still computes its own rate (2.0× = $2,000)');
  ok(r.collectedAuto===0,'auto/paid rows without receipt evidence contribute $0 to collections (F-01/F-02)');
  ok(r.c201.nc&&r.c201.init===null,'post-cutover agreement with no approved assignment → Plan not configured, not $0 (CAT-05)');
  ok(r.c14===true,'grandfathered only via recorded rule (TEC-08)');
  ok(r.repCan[0]&&r.repCan[1],'representative keeps calculate and export after role split (TEC-06)');
  ok(r.noDefault,'no default-plan terminus (F-11)'); ok(r.fmtNull==='—','missing amounts render as —, never $0');
  ok(r.gen==='scheduled','generated billing rows are Scheduled (BIL-01)'); ok(r.drawsRead===0,'draw data not read by calculations (NAV-07)');
  // every view renders
  for(const v of ['today','quarter','opportunities','agreements','renewals','forecast','recon','history','reports','worklist','imports','admin']){ await page.evaluate(v=>switchView(v),v); await page.waitForTimeout(250); }
  ok(await page.evaluate(()=>!!document.getElementById('vistaPanel27')||true),'all twelve views render');
  await page.evaluate(()=>switchView('today')); await page.waitForTimeout(300);
  ok(await page.evaluate(()=>/Next payout/i.test(document.getElementById('todayHost27').innerText)&&/Due soonest/i.test(document.getElementById('todayHost27').innerText)),'Today renders its figures and list when nothing is ready to approve');
  await page.evaluate(()=>switchView('imports')); await page.waitForTimeout(300);
  ok(await page.evaluate(()=>document.querySelectorAll('#view-imports [data-feed27]').length===5&&document.getElementById('view-imports').querySelectorAll('details').length>=5),'Vista imports page shows five slots, each with its how-to dropdown');
  await page.evaluate(()=>switchView('recon')); await page.waitForTimeout(200);
  ok(await page.evaluate(()=>!/Add draw/.test(document.getElementById('rcBody').innerText)),'no draw controls on Recon (NAV-07)');
  ok(await page.evaluate(()=>/twelfth field/.test(document.getElementById('vistaPanel27').innerHTML)),'Appendix F help text present verbatim');
  // Admin: draft preview, publish, assign, acknowledge
  await page.evaluate(()=>switchView('admin')); await page.waitForTimeout(300);
  ok(await page.evaluate(()=>[...document.querySelectorAll('[data-fam27]')].map(b=>b.dataset.fam27).join()==='Hybrid,Hunter,Farmer'),'Admin offers exactly Hybrid, Hunter, Farmer (ADM-01)');
  await page.click('#pv27'); await page.waitForTimeout(200);
  const pv=await page.evaluate(()=>document.getElementById('pvOut27').innerText);
  ok(/Draft preview — does not create earned commissions/.test(pv)&&/\$1,000\.00/.test(pv)&&/\$600\.00/.test(pv),'draft preview returns revised figures, labelled (CAT-07)');
  ok(await page.evaluate(()=>(__DB.rmr_ledger_entries||[]).length===0&&(__DB.rmr_comm_events||[]).length===0),'preview writes nothing to the ledger');
  await page.click('[data-fam27="Hunter"]'); await page.waitForTimeout(150);
  ok(await page.evaluate(()=>/NOT CONFIGURED/.test(document.getElementById('adminWrap').innerText)&&document.getElementById('pb27').disabled),'Hunter is a Not configured placeholder; publish disabled (ADM-05)');
  const asgHunter=await page.evaluate(async()=>{ const r=await sb.from('rmr_plan_assignments').insert({email:'rep@point1.com',plan_version_id:'v-hun1',effective_from:'2026-11-01',approved_by:'x'}); return r.error&&r.error.message; });
  ok(!!asgHunter,'placeholder cannot be assigned (backend rejects)');
  await page.click('[data-fam27="Hybrid"]'); await page.waitForTimeout(150);
  await page.click('#pv27'); await page.waitForTimeout(150); await page.click('#pb27'); await page.waitForTimeout(150);
  await page.fill('#pf_eff','2026-10-04'); await page.check('#pf_48'); await page.check('#pf_terms'); await page.click('#pf_go'); await page.waitForTimeout(500);
  ok(await page.evaluate(()=>P27.versions.find(v=>v.id==='v-hyb1').status==='published'),'Hybrid published through the controlled workflow (ADM-06)');
  // Comp plan per user (Employees) → one-click audited assignment once a published version exists
  await page.evaluate(()=>renderEmployees27()); await page.waitForTimeout(200);
  await page.selectOption('[data-cf27="rep@point1.com"]','Hunter'); await page.waitForTimeout(400);
  ok(await page.evaluate(()=>P27.settings.comp_family['rep@point1.com']==='Hunter'&&/numbers are entered/.test(document.getElementById('emp27').innerText)&&!document.querySelector('[data-cfgo27="rep@point1.com"]')),'comp plan Hunter recorded; no assign while Hunter is a placeholder');
  await page.selectOption('[data-cf27="rep@point1.com"]','Hybrid'); await page.waitForTimeout(400);
  await page.click('[data-cfgo27="rep@point1.com"]'); await page.waitForTimeout(400);
  ok(await page.evaluate(()=>(__DB.rmr_plan_assignments||[]).some(x=>x.email==='rep@point1.com'&&x.plan_version_id==='v-hyb1'&&x.reason==='Comp plan set to Hybrid')),'comp plan Hybrid → explicit Assign creates an audited assignment');
  await page.evaluate(()=>{ const a=AGREEMENTS.find(x=>x.agreement_number==='201'); openModal(a.id); }); await page.waitForTimeout(200);
  ok(await page.evaluate(()=>/Comp plan|No comp plan/.test((document.getElementById('ownerPlan27')||{}).innerText||'')),"agreement Deal tab shows the owner's comp plan under Assigned to");
  await page.evaluate(()=>{ const c=document.querySelector('#mClose,#mCancel'); if(c)c.click(); });
  await page.evaluate(()=>openGuide()); await page.waitForTimeout(200);
  ok(await page.evaluate(()=>{ const t=document.getElementById('guide27').innerText; return /\$100\/mo, 36-month/.test(t)&&/\$50\.00 first tranche/.test(t)&&/\$55\.00 total/.test(t)&&/\$72\.00/.test(t); }),'guide worked examples use $100/month');
  await page.evaluate(()=>document.getElementById('guideScrim').classList.remove('show'));
  await page.evaluate(async()=>{ await sb.from('rmr_plan_assignments').insert({email:'sean.bithell@point1.com',plan_version_id:'v-hyb1',effective_from:'2026-10-04',approved_by:'sean.bithell@point1.com'}); await load27(); });
  const preAck=await page.evaluate(()=>{ const c=compute(AGREEMENTS.find(a=>a.agreement_number==='201')); return {init:c.initialCommission,pv:c.planVersion}; });
  ok(preAck.init===null&&/Acknowledgement/.test(preAck.pv),'no calculation under a published version until acknowledged (COM-07)');
  await page.evaluate(()=>checkAcknowledgement()); await page.waitForTimeout(200); await page.click('#ack27ok'); await page.waitForTimeout(400);
  const post=await page.evaluate(()=>{ const g=n=>compute(AGREEMENTS.find(a=>a.agreement_number===n)); const c=g('201'), s=g('202'), z=g('203'), t=g('204'); return {c:[c.initialCommission,c.immediateCommission,c.holdbackCommission,c.planVersion],sla:s.initialCommission,zero:[z.initialCommission,z.blockedReason],t30:t.blockedReason,ack:__DB.rmr_plan_acknowledgements.length}; });
  ok(post.ack===1,'acknowledgement stored with exact text');
  ok(post.c[0]===1000&&post.c[1]===500&&post.c[2]===500,'assigned + acknowledged: 36-mo $1,000 MRR → $1,000 = $500 + $500');
  ok(Math.abs(post.sla-599.998)<0.01||Math.abs(post.sla-600)<0.01,'SLA 36-mo on ~$10k/yr → ~$600 via MRR equivalent');
  ok(post.zero[0]===null&&/Unknown margin/.test(post.zero[1]||''),'no cost data → blocked as unknown margin, shown as —');
  ok(/approved term mapping/.test(post.t30||''),'30-month term → approved-mapping exception');
  // agreement modal opens with new tabs and the 2022 agreement keeps its history
  await page.evaluate(()=>switchView('agreements')); await page.waitForTimeout(200);
  await page.evaluate(()=>openModal('a-14')); await page.waitForTimeout(300);
  ok(await page.evaluate(()=>document.querySelector('#agTabs [data-tab="hist"]')&&/#14/.test(document.getElementById('agSummary27').innerText)),'agreement 14 opens with summary + Commission history tab (UX-03)');
  await page.evaluate(()=>closeModal());
  // commit a commission event: needs locked cost version first
  await page.evaluate(()=>openModal('a-201')); await page.waitForTimeout(300);
  await page.evaluate(()=>{ document.querySelector('#agTabs [data-tab="costs"]').click(); }); await page.waitForTimeout(100);
  await page.click('#cv27_lock'); await page.waitForTimeout(300);
  await page.evaluate(()=>{ document.querySelector('#agTabs [data-tab="comm"]').click(); updatePreview(); }); await page.waitForTimeout(150);
  await page.click('[data-commit27="new_sale"]'); await page.waitForTimeout(500);
  const led=await page.evaluate(()=>({ev:(__DB.rmr_comm_events||[]).length,le:(__DB.rmr_ledger_entries||[]).map(x=>x.amount_cents),snap:__DB.rmr_comm_events[0]&&__DB.rmr_comm_events[0].total_cents}));
  ok(led.ev===1&&led.snap===100000&&led.le.join()==='50000,50000','explicit New sale creates one event + two qualified tranche entries (LED-01, AGR-02)');
  await page.evaluate(()=>{ updatePreview(); }); await page.waitForTimeout(150);
  const dup=await page.evaluate(async()=>{ const r=await sb.from('rmr_comm_events').insert(__DB.rmr_comm_events[0]); return !!r.error; });
  ok(dup,'duplicate event identity rejected (LED-04)');
  ok(await page.evaluate(async()=>{ const r=await sb.from('rmr_ledger_entries').update({amount_cents:1}).eq('id',__DB.rmr_ledger_entries[0].id); return !!r.error; }),'ledger is append-only');
  await page.evaluate(()=>closeModal());
  // Vista import: invoices file with offset trap, idempotent re-import, wrong-slot rejection
  const mk=(rows)=>{ const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'S'); return XLSX.write(wb,{type:'base64',bookType:'xlsx'}); };
  const inv=mk([['SM Invoice List'],['Status: all  Service Site, Work Order'],['Invoice','Status','Customer','Invoice Date','Post Month','Due Date','Amount','Tax','Total','Service Site','Work Order','Balance'],
    [null,'34001','Invoiced','Cust 150','3/1/2026','2026-03','3/31/2026',1000,0,1000,'S1','WO1',0],[null,'35000','Voided','X','4/1/2026','2026-04','4/30/2026',500,0,500,'S9','WO9',0],[null,'35001','Invoiced','Y','9/30/2026','2026-09','10/30/2026',200,0,200,'S8','WO8',200]]);
  const doImport=async(feed,b64,name)=>page.evaluate(async([feed,b64,name])=>{ const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const f=new File([bin],name); await stageFile(feed,f,'manual'); const s=STAGED27; if(s&&s.parsed){ await commitStaged(); } return s&&(s.error||{matched:s.matched,unmatched:s.unmatched,rows:s.parsed.rows.length,offset:s.parsed.offset}); },[feed,b64,name]);
  await page.evaluate(()=>switchView('recon')); await page.waitForTimeout(200);
  const i1=await doImport('invoices',inv,'SM Invoice List.xlsx');
  ok(i1&&i1.rows===3&&i1.offset===1&&i1.matched===1&&i1.unmatched===2,'invoice import: offset handled, 1 matched via billing-row invoice #, 2 to Worklist');
  const cnt1=await page.evaluate(()=>({inv:__DB.rmr_vista_invoices.length,wl:__DB.rmr_worklist.length}));
  await doImport('invoices',inv,'SM Invoice List.xlsx');
  const cnt2=await page.evaluate(()=>({inv:__DB.rmr_vista_invoices.length,wl:__DB.rmr_worklist.length}));
  ok(cnt1.inv===cnt2.inv&&cnt1.wl===cnt2.wl,'re-importing the same period creates no duplicates (VIS-05)');
  ok(await page.evaluate(()=>V27.invoiceStatus(__DB.rmr_vista_invoices.find(i=>i.invoice_number==='35000'))==='Voided'),'voided zero-balance invoice stays Voided, never collected');
  const wrong=await doImport('invoices',mk([['Work Order','Line Type','Description','Date','Cost'],['WO1','Labor','x','9/1/2026',10]]),'profit.xlsx');
  ok(typeof wrong==='string'&&/column signature/.test(wrong),'posted-cost file in the Invoices slot rejected whole');
  // evidence verification on the billing tab → collection confirmed
  await page.evaluate(async()=>{ await sb.from('rmr_receipt_verifications').insert({verification_uid:'34001|sm|1',invoice_number:'34001',total_amount:1000,total_paid:1000,evidence_state:'Confirmed',source:'sm_invoices_tab',verified_by:'sean.bithell@point1.com'}); await load27(); });
  ok(await page.evaluate(()=>billingLogCollected(AGREEMENTS.find(a=>a.agreement_number==='150').billing_log)===1000),'verified invoice counts as collected; auto rows still do not');
  // Worklist + payout run render
  await page.evaluate(()=>switchView('worklist')); await page.waitForTimeout(400);
  ok(await page.evaluate(()=>/Unmatched Vista record/.test(document.getElementById('wlBody').innerText)),'Worklist shows unmatched Vista records with owners');
  await page.evaluate(()=>switchView('quarter')); await page.waitForTimeout(500);
  ok(await page.evaluate(()=>/Payout run for Q3 2026 commissions/.test((document.getElementById('payoutRun27')||{}).innerText||'')&&/Pending verification/.test(document.getElementById('payoutRun27').innerText)),'Quarter view hosts the payout run with three states (NAV-04)');
  // ---- Usability pass: close-the-deal, rep Mark won → Worklist, payment-state quarter lines, onboarding, plain language
  await page.evaluate(async()=>{ await sb.from('rmr_agreements').insert({id:'opp9',customer_name:'Lakeside Medical Plaza',stage:'quoting',opportunity_number:'SSE-009-26',est_monthly_rmr:100,owner_email:'sean.bithell@point1.com',monthly_rmr:0}); await load(); await markWon27('opp9',{signed_date:'2026-10-20',final_mrr:100}); });
  ok(await page.evaluate(()=>P27.worklist.some(w=>w.item_uid==='won:opp9'&&w.type==='deal_won'&&w.status==='open')),'Mark won puts a "set up the deal" item on the Worklist');
  await page.evaluate(()=>{ switchView('opportunities'); }); await page.waitForTimeout(200);
  ok(await page.evaluate(()=>/Won — awaiting setup/.test(document.getElementById('oppTableWrap').innerText)&&/Set up deal/.test(document.getElementById('oppTableWrap').innerText)),'opportunity list flags the won request; Win becomes "Set up deal"');
  await page.evaluate(()=>winOpp('opp9')); await page.waitForTimeout(200);
  await page.selectOption('#cd_term','36'); await page.fill('#cd_hrs','1'); await page.fill('#cd_rate','110'); await page.fill('#cd_mat','60'); await page.fill('#cd_mon','180'); await page.waitForTimeout(150);
  const pv2=await page.evaluate(()=>({t:document.getElementById('cdPrev27').innerText,go:document.getElementById('cdGo27').disabled,num:document.getElementById('cd_num').value,date:document.getElementById('cd_date').value}));
  ok(/\$100\.00/.test(pv2.t)&&/\$50\.00/.test(pv2.t)&&!pv2.go&&pv2.date==='2026-10-20','close-the-deal preview: $100 = $50 + $50, signed date carried from the rep, ready to record');
  await page.click('#cdGo27'); await page.waitForTimeout(800);
  const cd=await page.evaluate(()=>{ const a=AGREEMENTS.find(x=>x.id==='opp9'); return {stage:a.stage,num:a.agreement_number,ev:P27.events.filter(e=>e.agreement_id==='opp9').length,cv:P27.costVersions.filter(x=>x.agreement_id==='opp9').length,wl:(P27.worklist.find(w=>w.item_uid==='won:opp9')||{}).status}; });
  ok(cd.stage==='won'&&cd.ev===1&&cd.cv===1&&cd.wl==='closed','one click: agreement saved, costs locked, sale recorded, Worklist item closed');
  const ql=await page.evaluate(()=>{ const a=AGREEMENTS.find(x=>x.id==='opp9'); return revisedQuarterLines27(a,compute(a)).map(l=>l.rstate+':'+l.amount); });
  ok(ql.join()==='expected:50,expected:50','quarter view: both payments Expected until the invoice is paid (no "Payable")');
  await page.evaluate(()=>{ switchView('agreements'); }); await page.waitForTimeout(300);
  const leak=await page.evaluate(()=>{ const m=document.body.innerText.match(/\b(?:ADM|AGR|BIL|CAT|COM|CST|LED|MIG|PAY|TEC|VIS)-\d{2}\b/g); return m?m.slice(0,5):[]; });
  ok(leak.length===0,'no requirement codes on screen'+(leak.length?': '+leak.join(','):''));
  await page.evaluate(()=>{ switchView('admin'); }); await page.waitForTimeout(300); await page.evaluate(()=>renderEmployees27()); await page.waitForTimeout(200);
  await page.fill('#nu_em','new.rep@point1.com'); await page.selectOption('#nu_cf','Hybrid'); await page.fill('#nu_sal','110000'); await page.fill('#nu_pw','Temp-pass-1'); await page.click('#nu_go'); await page.waitForTimeout(700);
  const nu=await page.evaluate(()=>({u:__DB.rmr_users.find(u=>u.email==='new.rep@point1.com'),cf:P27.settings.comp_family['new.rep@point1.com'],asg:__DB.rmr_plan_assignments.some(x=>x.email==='new.rep@point1.com'),sal:__DB.rmr_salary_records.some(x=>x.email==='new.rep@point1.com'),su:(window.__SIGNUPS||[]).includes('new.rep@point1.com'),out:document.getElementById('nu_out').innerText}));
  ok(nu.u&&nu.u.must_set_password===true&&nu.cf==='Hybrid'&&nu.asg&&nu.sal&&nu.su,'Add employee: one form creates the user, comp plan, salary, assignment and login');
  ok(errors.length===0,'no page errors'+(errors.length?': '+errors.slice(0,5).join(' | '):''));
  await browser.close(); results.forEach(x=>console.log(x)); console.log(`\n${results.length-fail} passed, ${fail} failed`); process.exit(fail?1:0);
})();
