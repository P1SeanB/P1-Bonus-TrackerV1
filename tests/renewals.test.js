// Hybrid v2 + Vista terms (P1RMR-60): every agreement on Hybrid, renewals and rate changes from the Agreement List,
// pre-Q3 manager override, margin rule from Q3, renewal type switch, update-from-Vista, recording events, payout.
// Clock fixed at 2026-10-20 (Q3 2026 payout open). Run: node tests/renewals.test.js
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const results=[]; let fail=0; const ok=(c,m)=>{ results.push((c?'PASS ':'FAIL ')+m); if(!c)fail++; };
const HYB_CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'migration_v22_spec27.sql'),'utf8').match(/select 'Hybrid', 1, 'Hybrid v1 \(revised\)', 'draft', 'mrr_multiple',\s*'(\{[\s\S]*?\})'::jsonb/)[1]);
const V2=Object.assign({},HYB_CFG,{placeholder:false,appliesToAllAgreements:true,autoRenewalPaysIncrease:true,paidThrough:'2026-06-30',paidThroughApprovedBy:'Sean Bithell (self-approved)',paidThroughNote:'Paid under the prior plans; margin rule waived'});
const SEAN='sean.bithell@point1.com';
const cost={loaded_labor_rate:100,inspection_frequency:1,hours_per_inspection:1};          // $100 a year: comfortably above the 45% floor
const poor={loaded_labor_rate:100,inspection_frequency:1,hours_per_inspection:1,other_direct_annual:100000};
const ag=(n,o)=>Object.assign({id:'a-'+n,agreement_number:n,customer_name:'Cust '+n,owner_email:SEAN,stage:null,history_only:true,monthly_rmr:100,contract_term:36,activation_date:'2025-01-01',term_end:'2027-12-31',agreement_type:'manual',autorenew:false,category:'rmr',billing_log:[]},cost,o);
const rv=(n,rev,status,eff,exp,price,billed,ts,te,tst,extra)=>Object.assign({term_key:n+'|'+rev,agreement_number:n,revision:String(rev),status,effective_date:eff,expiration_date:exp,term_price:price,amount_billed:billed,term_start:ts,term_end:te,term_status:tst,customer:'9'+n+' (Cust '+n+')'},extra||{});
const inv=(no,n,d,amt)=>({invoice_number:no,status:'Invoiced',customer:'9'+n+' Cust '+n,invoice_date:d,total:amt,amount:amt,balance:0,agreement_number:n,map_method:'invoice number on billing row'});
const ver=(no,amt,d)=>({id:'v'+no,verification_uid:no+'|t',invoice_number:no,total_amount:amt,total_paid:amt,evidence_state:'Confirmed',source:'sm_invoices_tab',receipt_date:d,verified_at:d+'T12:00:00Z',verified_by:SEAN});
let DB={
  rmr_users:[{email:SEAN,role:'Administrator',permission_role:'Administrator',full_name:'Sean Bithell'}],
  rmr_commission_plans:[],
  rmr_agreements:[
    ag('201',{monthly_rmr:120,agreement_type:'manual',billing_log:[{date:'2026-07-01',amount:120,invoice_no:'50001',status:'paid'},{date:'2026-08-01',amount:120,invoice_no:'50002',status:'paid'},{date:'2026-09-01',amount:120,invoice_no:'50003',status:'paid'}]}),
    ag('202',{monthly_rmr:55,contract_term:12,agreement_type:'auto',autorenew:true,billing_log:[{date:'2026-08-01',amount:55,invoice_no:'50011',status:'paid'}]}),
    ag('203',Object.assign({monthly_rmr:100},poor)),
    ag('204',{monthly_rmr:150,history_only:false,activation_date:'2026-05-01'}),
    ag('205',{monthly_rmr:200,history_only:false,activation_date:'2026-09-01',stage:'won'}),
    ag('206',Object.assign({monthly_rmr:90,history_only:false,activation_date:'2026-09-01'},poor)),
    ag('207',{monthly_rmr:70}),
    ag('208',{monthly_rmr:300,history_only:false,activation_date:'2026-08-17',contract_term:12})],
  rmr_vista_agreement_terms:[
    rv('201',1,'Expired','2023-07-01','2026-06-30',3600,3600,'2023-07-01','2026-06-30','Expired'),rv('201',2,'Active','2026-07-01','2029-06-30',4320,360,'2026-07-01','2029-06-30','Active'),
    rv('202',1,'Expired','2025-08-01','2026-07-31',600,600,'2025-08-01','2026-07-31','Expired'),rv('202',2,'Active','2026-08-01','2027-07-31',660,110,'2026-08-01','2027-07-31','Active'),
    rv('203',1,'Active','2025-01-01','2027-12-31',3600,2100,'2025-01-01','2027-12-31','Active'),
    rv('204',1,'Active','2026-05-01','2029-04-30',5400,900,'2026-05-01','2029-04-30','Active'),
    rv('205',1,'Active','2026-09-01','2029-08-31',7200,400,'2026-09-01','2029-08-31','Active'),
    rv('206',1,'Active','2026-09-01','2029-08-31',3240,180,'2026-09-01','2029-08-31','Active'),
    rv('207',1,'Terminated','2025-03-01','2028-02-29',2880,1520,'2025-03-01','2028-02-29','Active',{terminated_date:'2026-09-30'}),rv('207',2,'Active','2026-10-01','2028-02-29',2710,0,'2025-03-01','2028-02-29','Active'),
    rv('208',1,'Active','2026-08-17','2029-08-31',10950,0,'2026-08-17','2029-08-31','Active')],
  rmr_vista_invoices:[inv('50001','201','2026-07-01',120),inv('50002','201','2026-08-01',120),inv('50003','201','2026-09-01',120),inv('50011','202','2026-08-01',55)],
  rmr_receipt_verifications:[ver('50001',120,'2026-07-10'),ver('50002',120,'2026-08-10'),ver('50003',120,'2026-09-10'),ver('50011',55,'2026-08-12')],
  rmr_plan_versions:[{id:'v-hyb1',family:'Hybrid',version_no:1,label:'Hybrid v1 (revised)',status:'published',effective_date:'2026-10-04',approved_by:'Sean Bithell',rate_basis:'mrr_multiple',config:HYB_CFG},
    {id:'v-hyb2',family:'Hybrid',version_no:2,label:'Hybrid v2',status:'published',effective_date:'2026-10-05',approved_by:'Sean Bithell',rate_basis:'mrr_multiple',config:V2}],
  rmr_plan_assignments:[{id:1,email:SEAN,plan_version_id:'v-hyb1',effective_from:'2026-10-04',effective_to:'2026-10-05',approved_by:SEAN},{id:2,email:SEAN,plan_version_id:'v-hyb2',effective_from:'2026-10-05',approved_by:SEAN}],
  rmr_plan_acknowledgements:[{id:1,email:SEAN,plan_version_id:'v-hyb1',text_shown:'terms',created_at:'2026-10-04T10:00:00Z'},{id:2,email:SEAN,plan_version_id:'v-hyb2',text_shown:'terms v2',created_at:'2026-10-05T10:00:00Z'}],
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
  const ev=()=>p.evaluate(()=>{ const out={}; AGREEMENTS.forEach(a=>{ out[a.agreement_number]=(pricedEvents27(a)||[]).map(x=>({kind:x.e.kind,type:x.e.renewalType||null,et:x.et,date:x.date,term:x.term,override:x.override,noPay:!!x.noPay,blocked:x.blocked||null,total:x.calc?Number(x.calc.totalCents)/100:null,rec:!!x.evRow})); }); return out; });
  let E=await ev();
  ok(await p.evaluate(()=>isRevisedTransaction(AGREEMENTS.find(a=>a.agreement_number==='201'))),'a history-only agreement of a Hybrid v2 rep runs on Hybrid (applies to every agreement)');
  ok(E['201'].length===2&&E['201'][0].override&&E['201'][1].kind==='renewal'&&E['201'][1].type==='auto'&&E['201'][1].total===20,'36-month auto-renewal pays only the $20 increase × 1.0 (new money); the sale before Q3 is override-paid');
  ok(E['202'][1].kind==='renewal'&&E['202'][1].type==='manual'&&E['202'][1].total===15,'12-month manual renewal: 0.25 × $50 retained + $5 increase × 0.5 = $15');
  ok(E['203'][0].override&&E['203'][0].total===100,'pre-Q3 sale below the margin floor is still paid in full by the manager override');
  ok(E['204'][0].override,'a May 2026 sale whose Payment 2 lands in August is fully marked paid (sale date decides)');
  ok(E['205'][0].total===200&&!E['205'][0].override,'Q3 new sale on a 36-month term: $200 × 1.0, margin rule applies');
  ok(E['206'][0].total===0,'Q3 sale below the 45% floor pays $0 (margin rule from Q3 on)');
  ok(E['207'].some(x=>x.kind==='rate_change'&&x.noPay),'a mid-term rate decrease pays nothing and takes nothing back');
  ok(E['208'][0].term===36,'8/17/26–8/31/29 counts as a 36-month term (stub months)');
  const lines=await p.evaluate(()=>hybridLines27(AGREEMENTS.find(a=>a.agreement_number==='203')).map(l=>({r:l.rstate,n:l.note,o:l.override})));
  ok(lines.length===2&&lines.every(l=>l.r==='paid'&&l.o&&/manager override, approved by Sean Bithell \(self-approved\)/.test(l.n)),'pre-Q3 payments show as Paid with the override and approver');
  let items=await p.evaluate(()=>{ const run=E27.payoutCalendar(P27.settings.payout_calendar); return {q:run.q,y:run.y,items:payoutItems(run).map(i=>({n:i.a.agreement_number,l:i.label,s:i.state,r:i.reason,amt:i.amount}))}; });
  ok(items.q===3&&items.y===2026,'payout run is Q3 2026');
  ok(!items.items.some(i=>['203','204'].includes(i.n)),'override-paid history never appears in the payout run');
  ok(items.items.filter(i=>i.n==='201').every(i=>/Not recorded yet/.test(i.r)),'unrecorded renewal is excluded with "record it" reason');
  // switch 201 to manual for this term → manual renewal pays 0.25 × $100 + $20 × 1.0 = $45; back to the rule → $20
  await p.evaluate(()=>switchView('renewals')); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>!!document.getElementById('terms27')&&/Contract terms &amp; renewals from Vista|Contract terms & renewals from Vista/.test(document.getElementById('terms27').innerHTML)),'Renewals page shows contract terms from Vista');
  ok(await p.evaluate(()=>{ const t=document.getElementById('terms27').innerText; return /Original start/i.test(t)&&/Current term/i.test(t)&&/Renewals/i.test(t); }),'terms table shows original start, renewals and current term');
  await p.selectOption('[data-rtype27="a-201"]','manual'); await p.waitForTimeout(400);
  E=await ev(); ok(E['201'][1].type==='manual'&&E['201'][1].total===45,'switching a 36-month term to manual pays the manual renewal ($45)');
  ok(await p.evaluate(()=>{ const a=__DB.rmr_agreements.find(x=>x.agreement_number==='201'); return a.renewal_type_override==='manual'&&a.renewal_override_term_start==='2026-07-01'&&a.agreement_type==='manual'; }),'switch is stored for the current term only');
  await p.selectOption('[data-rtype27="a-201"]','auto'); await p.waitForTimeout(400);
  E=await ev(); ok(E['201'][1].type==='auto'&&E['201'][1].total===20&&await p.evaluate(()=>__DB.rmr_agreements.find(x=>x.agreement_number==='201').renewal_type_override===null),'switching back to the rule clears the override');
  // update from Vista
  ok(await p.evaluate(()=>/Update agreements from Vista/.test(document.getElementById('terms27').innerText)&&!!document.getElementById('tm27apply')),'update-from-Vista preview with an Apply button');
  await p.click('#tm27apply'); await p.waitForTimeout(600);
  ok(await p.evaluate(()=>{ const a=__DB.rmr_agreements.find(x=>x.agreement_number==='201'); const b=__DB.rmr_agreements.find(x=>x.agreement_number==='202');
    return a.original_sale_date==='2023-07-01'&&a.term_start==='2026-07-01'&&a.term_end==='2029-06-30'&&a.contract_term===36&&a.agreement_type==='auto'&&a.autorenew===true&&b.agreement_type==='manual'&&b.contract_term===12; }),'Apply writes original start, current term, term length and renewal type');
  ok(await p.evaluate(()=>__DB.rmr_audit_log.some(x=>/Agreement updated from Vista terms/.test(x.action))),'each update is audited');
  // record the Q3+ events
  await p.evaluate(()=>{ switchView('renewals'); }); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!!document.getElementById('tm27rec')),'Record events button is offered');
  await p.click('#tm27rec'); await p.waitForTimeout(900);
  const evs=await p.evaluate(()=>__DB.rmr_comm_events.map(e=>e.event_type+':'+e.agreement_number+':'+e.total_cents).sort());
  ok(evs.includes('auto_renewal:201:2000')&&evs.includes('manual_renewal:202:1500')&&evs.includes('new_sale:205:20000'),'recorded auto-renewal $20, manual renewal $15 and the $200 sale: '+evs.join(' '));
  ok(!evs.some(e=>/:20[34]:/.test(e)),'nothing recorded for override-paid history');
  ok(!evs.some(e=>/:206:/.test(e)),'a $0 sale below the floor is not offered for recording');
  ok(evs.includes('new_sale:208:30000'),'current-term rate uses the agreement price when Vista agrees within 60¢ ($300, not $300.13)');
  ok(!evs.some(e=>/rate_increase:207/.test(e)),'no event for a decrease');
  ok(await p.evaluate(()=>__DB.rmr_cost_versions.length>=3),'recording locks the cost version it used');
  items=await p.evaluate(()=>{ const run=E27.payoutCalendar(P27.settings.payout_calendar); return payoutItems(run).map(i=>({n:i.a.agreement_number,l:i.label,s:i.state,r:i.reason,amt:i.amount})); });
  const r201=items.filter(i=>i.n==='201');
  ok(r201.some(i=>i.l==='Renewal · Payment 1 of 2'&&i.s==='Ready to pay'&&i.amt===10),'renewal Payment 1 ($10) is ready: first invoice of the new rate paid 7/10');
  ok(r201.some(i=>i.l==='Renewal · Payment 2 of 2'&&/after quarter end|next run/.test(i.r)),'renewal Payment 2 waits for the next run (three months after 7/1 billing)');
  ok(await p.evaluate(()=>{ const v=P27.versions.find(x=>x.id==='v-hyb2'); const t=termsText(v); return /pay only the increase/.test(t)&&/manager override \(approved by Sean Bithell \(self-approved\)/.test(t)&&/applies to every agreement/.test(t)&&/12-month term renews manually/.test(t); }),'written terms state the v2 rules and the override');
  ok(await p.evaluate(()=>{ const L=myLines27(); return L.some(l=>l.a.agreement_number==='203'&&l.state==='paid'&&/manager override/.test(l.note)); }),'My pay lists pre-Q3 commissions as paid by override');
  await p.evaluate(()=>{ openModal('a-201'); }); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>/Original start 2023-07-01 · 1 renewal/.test(document.getElementById('agSummary27').innerText)),'agreement header shows original start and renewal count');
  await p.evaluate(()=>closeModal());
  ok(!p.__errors.length,'no page errors'+(p.__errors.length?': '+p.__errors.slice(0,3).join(' | '):''));
  await browser.close();
  results.forEach(r=>console.log(r)); console.log(`\n${results.length-fail} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
