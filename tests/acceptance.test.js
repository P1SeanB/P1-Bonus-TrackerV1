// Spec v2.7 §13 acceptance tests — engine and import layer. Run: node tests/acceptance.test.js
const E=require('../src/engine27.js'), V=require('../src/vista27.js');
let pass=0, fail=0; const results=[];
function t(name,fn){ try{ fn(); pass++; results.push(['PASS',name]); }catch(e){ fail++; results.push(['FAIL',name+' — '+e.message]); } }
function eq(a,b,m){ if(String(a)!==String(b))throw new Error(`${m||''} expected ${b}, got ${a}`); }
function throwsCode(fn,code){ try{ fn(); }catch(e){ if(e.code===code)return; throw new Error(`expected ${code}, got ${e.code||e.message}`);} throw new Error('expected block '+code); }

// Seed exactly as migration_v22 does (kept in sync with the SQL)
const HYBRID={id:'h1',family:'Hybrid',label:'Hybrid v1 (revised)',status:'draft',rate_basis:'mrr_multiple',config:{family:'Hybrid',placeholder:false,
  allocation:{hunter:0.25,farmer:0.75},salaryAssumption:110000,quotaMonthlyMrr:1250,accelMultiplier:'1.0',targetMargin:'0.50',minMargin:'0.45',
  marginGate:[{min:'0.45',mult:'1.0'},{min:'0',mult:'0'}],newMult:{12:'0.50',24:'0.75',36:'1.00',48:'1.125',60:'1.25'},renewalMult:'0.25',newMultCapAbove60:'1.25',
  slaNewMult:{12:'0.36',24:'0.55',36:'0.72',48:'0.81',60:'0.90'},slaRenewalMult:'0.25',autoRenewalMult:'0',escalatorMult:'0',termConversionMult:'0',
  tranche1Pct:'0.50',tranche2Pct:'0.50',releaseMode:'offset',releaseOffsetMonths:3,termMappings:{},
  grrBonus:[{min:'0.95',pct:'0.01'},{min:'0.965',pct:'0.02'},{min:'0.98',pct:'0.04'},{min:'0.99',pct:'0.06'}],
  nrrBonus:[{min:'1.03',pct:'0.01'},{min:'1.05',pct:'0.02'},{min:'1.08',pct:'0.03'},{min:'1.10',pct:'0.04'}]}};
const M50=E.dec('0.5');
const calc=(o)=>E.calculate(Object.assign({plan:HYBRID,margin:M50,shares:[{email:'rep@p1',bp:10000}]},o));

t('New 36-month at $1,000 MRR → $1,000; $500 + $500',()=>{ const r=calc({eventType:'new_sale',term:36,newMrr:'1000'}); eq(E.toDollars(r.totalCents),'1000.00'); eq(E.toDollars(r.tranche1Cents),'500.00'); eq(E.toDollars(r.tranche2Cents),'500.00'); });
t('New 12-month at $100 MRR → $50',()=>eq(E.toDollars(calc({eventType:'new_sale',term:12,newMrr:'100'}).totalCents),'50.00'));
t('60-month at $100 → $125',()=>eq(E.toDollars(calc({eventType:'new_sale',term:60,newMrr:'100'}).totalCents),'125.00'));
t('72-month at $100 → $125 (capped)',()=>eq(E.toDollars(calc({eventType:'new_sale',term:72,newMrr:'100'}).totalCents),'125.00'));
t('Manual renewal $1,000→$1,300, 36 mo → $550, no conversion bonus',()=>{ const r=calc({eventType:'manual_renewal',term:36,priorMrr:'1000',newMrr:'1300'}); eq(E.toDollars(r.totalCents),'550.00'); if(r.components.some(c=>/conversion/i.test(c.label)&&E.cmp(c.amount,E.ZERO)>0))throw new Error('conversion paid'); });
t('Margin 45% → 1.0',()=>eq(E.toDollars(calc({eventType:'new_sale',term:36,newMrr:'1000',margin:E.dec('0.45')}).totalCents),'1000.00'));
t('Margin 44.999% → 0',()=>eq(E.toDollars(calc({eventType:'new_sale',term:36,newMrr:'1000',margin:E.dec('0.44999')}).totalCents),'0.00'));
t('Unknown margin cannot qualify',()=>throwsCode(()=>calc({eventType:'new_sale',term:36,newMrr:'1000',margin:null}),'margin_unknown'));
t('GRR 98% NRR 105% → $4,400 + $2,200 = $6,600',()=>{ const ret=E.retention(100000,2000,0,7000); eq(E.ratStr(ret.grr,4),'0.9800'); eq(E.ratStr(ret.nrr,4),'1.0500');
  const sal=E.salaryBasis([{annual_salary:110000,effective_from:'2026-01-01',effective_to:null}],'2026-01-01','2027-01-01'); const b=E.portfolioBonus(HYBRID.config,ret,sal);
  eq(E.toDollars(b.grrCents),'4400.00'); eq(E.toDollars(b.nrrCents),'2200.00'); eq(E.toDollars(b.totalCents),'6600.00'); });
t('Opening MRR zero → Not applicable, never divide-by-zero',()=>{ const r=E.retention(0,0,0,0); if(r.grr!==null)throw new Error('grr'); const b=E.portfolioBonus(HYBRID.config,r,11000000n); eq(b.state,'Unknown'); });
const inv=(n,d,st,col)=>({number:n,date:d,dueDate:d,total:100,status:st,collected:col?{state:'Confirmed',date:col}:{state:'Unverified'}});
t('Second tranche before 3-month date → no earning',()=>{ const r=E.evaluateTranches({},{activationDate:'2026-01-05',today:'2026-03-15',invoices:[inv('1','2026-01-31','Paid','2026-02-10')]}); eq(r.t1.state,'Earned'); eq(r.t2.state,'Conditional holdback'); });
t('Second tranche with overdue unpaid invoice → no earning',()=>{ const r=E.evaluateTranches({},{activationDate:'2026-01-05',today:'2026-06-15',invoices:[inv('1','2026-01-31','Paid','2026-02-10'),inv('2','2026-02-28','Invoiced',null)]}); eq(r.t2.state,'Conditional holdback'); });
t('Second tranche earns when both conditions met; 31 Jan + 3 months = 30 Apr',()=>{ const r=E.evaluateTranches({},{activationDate:'2026-01-05',today:'2026-06-15',invoices:[inv('1','2026-01-31','Paid','2026-02-10'),inv('2','2026-02-28','Paid','2026-03-10'),inv('3','2026-03-31','Paid','2026-04-10'),inv('4','2026-04-30','Paid','2026-05-10')]}); eq(r.t2.timeDate,'2026-04-30'); eq(r.t2.state,'Earned'); eq(r.t2.earnedDate,'2026-05-10'); });
t('Schedule date passes without a matched Vista record → nothing earns',()=>{ const r=E.evaluateTranches({},{activationDate:'2026-01-05',today:'2026-09-15',invoices:[{number:'',date:'2026-02-01',total:100,status:'Scheduled'}]}); eq(r.t1.state,'Conditional'); eq(r.t2.state,'Conditional holdback'); });
t('Invoice settled entirely by credit → Settled by credit; no tranche triggers',()=>{ eq(V.invoiceStatus({status:'Invoiced',total:0,amount:0,balance:0}),'Settled by credit'); const r=E.evaluateTranches({},{activationDate:'2026-01-05',today:'2026-09-15',invoices:[{number:'9',date:'2026-02-01',total:100,status:'Settled by credit',collected:null}]}); eq(r.t1.state,'Conditional'); });
t('Voided invoice at zero balance is never read as collected',()=>eq(V.invoiceStatus({status:'Voided',total:120,balance:0}),'Voided'));
t('Two identical agreements, one with posted overhead lump → identical qualification',()=>{ const base={monthly_rmr:1000,contract_term:36,material_cost_annual:2000,monitoring_cost_annual:1200,loaded_labor_rate:95,inspection_frequency:2,hours_per_inspection:4};
  const a1=Object.assign({},base), a2=Object.assign({},base,{vista_posted_overhead:9720});
  const m1=E.qualificationMargin(E.eligibleMrrCentsRational(a1),36,E.modelledCost(a1)).margin, m2=E.qualificationMargin(E.eligibleMrrCentsRational(a2),36,E.modelledCost(a2)).margin; eq(E.cmp(m1,m2),0); });
t('Legacy monthly direct cost as only basis → Cost basis unverified, blocked',()=>{ const a={monthly_rmr:500,contract_term:12,monthly_direct_cost:100}; const c=E.modelledCost(a); eq(c.state,'legacy_only'); const q=E.qualificationMargin(E.eligibleMrrCentsRational(a),12,c); eq(q.margin,null); if(!q.costUnverified)throw new Error('flag'); });
t('No cost data at all → blocked as unknown margin',()=>{ const a={monthly_rmr:500,contract_term:12}; const q=E.qualificationMargin(E.eligibleMrrCentsRational(a),12,E.modelledCost(a)); eq(q.margin,null); throwsCode(()=>E.marginGate(HYBRID.config,q.margin),'margin_unknown'); });
t('Itemised labour + legacy field → cost counted once, flagged',()=>{ const a={monthly_rmr:500,contract_term:12,loaded_labor_rate:100,inspection_frequency:1,hours_per_inspection:10,monthly_direct_cost:50}; const c=E.modelledCost(a); eq(E.ratStr(c.annual,2),'1000.00'); if(!c.doubleCountFlag)throw new Error('not flagged'); });
t('Fresh seed: Hybrid carries revised rates, zero term conversion, no DEFAULT_CONFIG values',()=>{ const c=HYBRID.config; eq(c.newMult[36],'1.00'); eq(c.termConversionMult,'0'); eq(c.tranche1Pct,'0.50'); eq(c.releaseOffsetMonths,3); if(c.newPct||c.autoRenewalPct)throw new Error('DEFAULT_CONFIG maps present'); eq(E.validatePlanVersion(HYBRID).length,0); });
t('$100.01 with 50/50 → $50.01 + $50.00',()=>{ const sh=E.allocateShares(10001n,E.roundHalfUp(E.mul(E.R(10001n),E.dec('0.5'))),[{email:'a',bp:10000}]); eq(E.toDollars(sh[0].t1Cents),'50.01'); eq(E.toDollars(sh[0].t2Cents),'50.00'); eq(E.toDollars(sh[0].totalCents),'100.01'); });
t('Credit shares sum to the total with deterministic residual',()=>{ const sh=E.allocateShares(10001n,5001n,[{email:'a',bp:3333},{email:'b',bp:3333},{email:'c',bp:3334}]); eq(sh.reduce((s,x)=>s+x.totalCents,0n),10001n); eq(sh.reduce((s,x)=>s+x.t1Cents,0n),5001n); });
t('Shares not totalling 100% are rejected',()=>throwsCode(()=>E.allocateShares(100n,50n,[{email:'a',bp:5000}]),'shares_incomplete'));
t('Thirty-month term → approved-mapping exception (not the 24-month rate)',()=>throwsCode(()=>calc({eventType:'new_sale',term:30,newMrr:'1000'}),'term_mapping_required'));
t('Thirty-month term with approved mapping pays the mapping',()=>{ const p=JSON.parse(JSON.stringify(HYBRID)); p.config.termMappings={30:{mult:'0.875',approved_by:'Sean Bithell'}}; eq(E.toDollars(E.calculate({plan:p,eventType:'new_sale',term:30,newMrr:'1000',margin:M50}).totalCents),'875.00'); });
t('Publish mrr_multiple with only percentage fields → rejected',()=>{ const v={family:'Hybrid',rate_basis:'mrr_multiple',config:{newPct:{12:0.06},renewalMult:'0.25',tranche1Pct:'0.5',tranche2Pct:'0.5',minMargin:'0.45'}}; if(!E.validatePlanVersion(v).some(e=>/no multiple fields/.test(e)))throw new Error('accepted'); });
t('Placeholder (Hunter) cannot calculate',()=>throwsCode(()=>E.calculate({plan:{family:'Hunter',config:{placeholder:true}},eventType:'new_sale',term:36,newMrr:'1000',margin:M50}),'plan_not_configured'));
t('No plan → Plan not configured (never a fallback rate)',()=>throwsCode(()=>E.calculate({plan:null,eventType:'new_sale',term:36,newMrr:'1000',margin:M50}),'plan_not_configured'));
t('SLA $10,000 annual, 36 months → $600',()=>eq(E.toDollars(calc({eventType:'sla_new',category:'sla',term:36,slaAnnual:'10000'}).totalCents),'600.00'));
t('SLA $10,000 annual, 12 months → $300',()=>eq(E.toDollars(calc({eventType:'sla_new',category:'sla',term:12,slaAnnual:'10000'}).totalCents),'300.00'));
t('SLA renewal $10,000 retained → $208',()=>eq(E.toDollars(calc({eventType:'sla_renewal',category:'sla',term:12,priorSlaAnnual:'10000',slaAnnual:'10000'}).totalCents),'208.33'.slice(0,0)+'208.33'));
t('Auto-renewal and escalation pay zero',()=>{ eq(calc({eventType:'auto_renewal',term:12,priorMrr:'1000',newMrr:'1000'}).totalCents,0n); eq(calc({eventType:'escalation',term:12,priorMrr:'1000',newMrr:'1030'}).totalCents,0n); });
t('Expansion pays only on the increase',()=>eq(E.toDollars(calc({eventType:'expansion',term:36,priorMrr:'1000',newMrr:'1200'}).totalCents),'200.00'));
t('Win-back pays the new-sale schedule',()=>eq(E.toDollars(calc({eventType:'win_back',term:36,newMrr:'500'}).totalCents),'500.00'));
t('Accelerator above 1.0 on a known over-quota case',()=>{ const p=JSON.parse(JSON.stringify(HYBRID)); p.config.accelMultiplier='1.5';
  // quota $1,250; $1,000 already this month; this $1,000 deal → $750 above quota. 36 mo: base $1,000 + 0.5 × 1.0 × $750 = $1,375
  eq(E.toDollars(E.calculate({plan:p,eventType:'new_sale',term:36,newMrr:'1000',margin:M50,quota:{priorInMonthCents:100000}}).totalCents),'1375.00'); });
t('Accelerator dormant at 1.0 pays nothing extra',()=>eq(E.toDollars(calc({eventType:'new_sale',term:36,newMrr:'1000',quota:{priorInMonthCents:500000}}).totalCents),'1000.00'));
t('Displayed TCV % derived from multiples (36 mo = 2.7778%)',()=>eq(E.pctStr(calc({eventType:'new_sale',term:36,newMrr:'1000'}).displayTcvPct,4),'2.7778%'));
t('48-month multiple 1.125 → 2.3438% displayed',()=>eq(E.pctStr(calc({eventType:'new_sale',term:48,newMrr:'1000'}).displayTcvPct,4),'2.3438%'));
t('Payout run: unverified → Pending; verified → Ready (per amount, not per run)',()=>{ const ctx={quarterEnd:'2026-09-30',cutoff:'2026-10-15'}; eq(E.classifyForRun({earned:true,earnedDate:'2026-08-01',verified:false},ctx).state,'Pending verification'); eq(E.classifyForRun({earned:true,earnedDate:'2026-08-01',verified:true},ctx).state,'Ready to pay'); });
t('Payout calendar: cutoff 15 days and pay 30 days after quarter end',()=>{ const r=E.payoutCalendar({payWithinDays:30,verifyWithinDays:15},'2026-10-03'); eq(r.quarterEnd,'2026-09-30'); eq(r.cutoff,'2026-10-15'); eq(r.payBy,'2026-10-30'); });
t('Receipts slot overdue past cutoff; posted cost is not',()=>{ const run=E.payoutCalendar(null,'2026-10-20'); eq(E.feedDueState('receipts','2026-08-31',run,'2026-10-20').state,'overdue'); if(E.feedDueState('posted_cost',null,run,'2026-10-20').critical)throw new Error('posted cost critical'); });
t('Stale import that ran on time still fails the gate',()=>{ const run=E.payoutCalendar(null,'2026-10-05'); if(E.feedDueState('invoices','2026-09-15',run,'2026-10-05').state==='ok')throw new Error('passed'); });

// ----- import layer -----
const echo=[['SM Invoice List'],['Company: 2  Status: Invoiced  Date range 1/1/2026 - 9/30/2026'],[]];
const hdr=['Invoice','Status','Customer','Invoice Date','Post Month','Due Date','Amount','Tax','Total','Service Site','Work Order','Balance'];
const row=(n,st,bal)=>[null,String(n),st,'ACME','9/1/2026','2026-09','10/1/2026',100,0,100,'S1','WO1',bal];
t('Invoice export one-column offset is detected (Balance is the 12th field)',()=>{ const p=V.parse('invoices',[...echo,hdr,row(34285,'Invoiced',0)]); eq(p.ok,true); eq(p.offset,1); eq(p.rows[0].balance,0); eq(p.rows[0].invoice_number,'34285'); });
t('Default Invoiced-only run → parameter echo recorded and flagged',()=>{ const rows=[...echo,hdr]; for(let i=0;i<60;i++)rows.push(row(40000+i,'Invoiced',0)); const p=V.parse('invoices',rows); if(!p.flags.some(f=>/Invoiced only|F-20/.test(f)))throw new Error('not flagged'); if(!/Status: Invoiced/.test(p.paramEcho))throw new Error('echo'); });
t('Duplicates within a file are ignored (idempotent keys)',()=>{ const p=V.parse('invoices',[...echo,hdr,row(1001,'Invoiced',0),row(1001,'Invoiced',0)]); eq(p.rows.length,1); eq(p.duplicates,1); });
t('Unreadable column → fails whole and names the column',()=>{ const r=row(1002,'Invoiced','abc'); const p=V.parse('invoices',[...echo,hdr,r]); eq(p.ok,false); if(!/balance/i.test(p.error))throw new Error(p.error); });
t('Posted cost file in the Invoices slot → rejected on column signature',()=>{ const p=V.parse('invoices',[['SM Work Order Profitability Detail'],['Work Order','Line Type','Description','Date','Cost'],['WO1','Labor','x','9/1/2026',10]]); eq(p.ok,false); if(!/column signature/.test(p.error))throw new Error(p.error); });
t('Posted cost: Totals rows discarded; overhead classified by rule table; unresolved kept',()=>{ const rules=[{match_field:'description',pattern:'(?i)applied overhead',bucket:'overhead'},{match_field:'line_type',pattern:'(?i)^labor$',bucket:'direct_burdened'}];
  const p=V.parse('posted_cost',[['Work Order','Line Type','Description','Date','Cost'],['WO1','Miscellaneous','Applied Overhead','12/31/2024',270],['WO1','Labor','Tech','1/5/2025',100],['','Totals for Line Type','','',370],['WO1','Purchase','Freight','1/5/2025',12],['','Totals for Work Order','','',382]]);
  eq(p.rows.length,3); eq(V.classifyCost(p.rows[0],rules),'overhead'); eq(V.classifyCost(p.rows[1],rules),'direct_burdened'); eq(V.classifyCost(p.rows[2],rules),'unresolved'); });
t('Agreement text in a description is corroborating, never the primary key',()=>{ const m=V.mapInvoice({invoice_number:'34285',description:'10/01/26 Agmt 37 Service'},{byWorkOrder:{}}); eq(m.agreement,null); eq(m.candidate,'37'); });
t('Work order maps invoice to agreement',()=>eq(V.mapInvoice({invoice_number:'1',work_order:'WO9'},{byWorkOrder:{WO9:'37'}}).agreement,'37'));

// ----- real Vista export layouts (pulled 2026-10-03) -----
const D=s=>new Date(s+'T08:00:00Z'), Z=new Date('1899-12-30T08:00:00Z');
t('Real SM Invoice List: customer # and name in two cells, footer and Grand Totals skipped',()=>{
  const rows=[['SM Invoice List','Sorted by:','Invoice','Show Only Open Balances:','N','Invoice Dates:','01/01/25 - 09/30/26','Status:','All','Service Site:',' ','Work Order:',0],
    ['\nInvoice','\nStatus','\nCustomer # / Name','\nBill To Customer','Invoice\nDate',' Post Month','\nDue Date','\nAmount','\nTax','\nTotal','\nBalance'],[''],
    ['     25494','Invoiced',647,'Santo Office','',D('2025-01-01'),D('2025-01-01'),D('2025-01-31'),65,0,65,0],[''],
    ['     34208','Pending',807,'Mountain Cascade, Inc','',D('2026-09-25'),null,D('2026-11-24'),3548.8,0,3548.8,3548.8],
    ['Grand Totals:',null,5457577.41,896.65,5458474.06,439925.47],['2   Point One Electrical Systems','Page 1','10/03/26  09:35:19 PM','Date Format - MM/DD/YY','SMInvoiceList.rpt']];
  const p=V.parse('invoices',rows); if(!p.ok)throw new Error(p.error); eq(p.rows.length,2); eq(p.rows[0].customer,'647 Santo Office'); eq(p.rows[0].invoice_date,'2025-01-01'); eq(p.rows[0].post_month,'2025-01'); eq(p.rows[0].balance,0); eq(p.rows[1].balance,3548.8); eq(p.rows[1].post_month,null); eq(p.dataThrough,'2026-09-30'); });
t('Real SM Agreement List (grouped): revisions read under their agreement; blank 1899 dates are empty',()=>{
  const rows=[['SM Agreement List'],['Sorting by Customer NumberThen by Revision Number','Showing All Agreements','Revision Status Filter Legend ','Displaying: All Statuses'],
    ['Dates','Amount\nBilled ','Previous\nRevision','Rev.','Effective',null,'Activated','Cancelled','Terminated','Expiration','Price','Status'],
    ['Customer: 101 (Airbnb, Inc.)','',''],['Agreement: 107 - Airbnb 44 Kate Street - Intrusion Monitoring','Status: Active',''],['Term: 11/01/24 to 05/31/27 (Active)','Total Term Price: 1,767.00','Total Term Billed: 1,425.00',''],
    [1,D('2024-11-01'),D('2024-11-14'),Z,D('2026-05-31'),D('2026-07-31'),1197,'',1083,null,'Terminated'],
    [3,D('2026-08-01'),D('2026-07-31'),Z,Z,D('2027-05-31'),1767,'',228,2,'Active'],
    ['Agreement: T-C 888 Brannan - T-C 888 Brannan','Status: Inactive',''],[1,D('2017-02-01'),D('2017-01-31'),Z,D('2017-02-13'),D('2018-01-31'),5388,'',449,null,'Active ( as of 11/15/26 )'],
    ['Page 1','2   Point One Electrical Systems','10/03/26','Date Format - MM/DD/YY','SMAgreementList.rpt']];
  const p=V.parse('agreement_terms',rows); if(!p.ok)throw new Error(p.error); eq(p.rows.length,3); eq(p.rows[1].agreement_number,'107'); eq(p.rows[1].revision,'3'); eq(p.rows[1].previous_revision,'2');
  eq(p.rows[1].terminated_date,null); eq(p.rows[1].expiration_date,'2027-05-31'); eq(p.rows[1].term_price,1767); eq(p.rows[1].customer,'101 (Airbnb, Inc.)'); eq(p.rows[2].agreement_number,'T-C 888 Brannan'); });
t('Real SM WO Profitability Detail (grouped): agreement from the grouping, totals and footnotes skipped',()=>{
  const rows=[['SM Work Order Profitability Detail','Work Orders: All  Date Entered: 07/01/26 - 09/30/26  Grouped by: Agreement',null,'\nTechnician','\nDescription','\nDate','Cost\nRate','Price\nRate','Budget\nHours','Units/\nAct Hrs','\nUM','Budget\nCost','\nCost','\nPrice','\nBilled'],
    ['Agreement: ',''],['Work Order 11196  Description: Troubleshoot   Customer: 1140 Harrison   Division: 62',''],['Line Type: 2 - Labor ',''],
    ['Gomez, Randolph','',D('2026-07-07'),0,177.44,4,'hrs',460.41,'',709.76,709.76,'',249.35,'35.13'],['Totals for Line Type: Labor  ',460.41,'',709.76],
    ['Agreement: 165',''],['Work Order 11246  Description: Monitoring   Customer: X',''],['Line Type: 3 - Miscellaneous ',''],['None','Applied Overhead',D('2026-08-19'),0,0,0,'',198.73,'',0,0,'',-198.73,'N/A'],
    ['Totals for Work Order 11246  ',0],['Totals for Agreement: 165',0],['Grand Total',44,820],['* Actual Cost is not yet available, calculated using Projected Cost '],['Page 1','2   Point One Electrical Systems','10/03/26','Date Format - MM/DD/YY','SMWorkOrderProfitabilityDetail.rpt']];
  const p=V.parse('posted_cost',rows); if(!p.ok)throw new Error(p.error); eq(p.rows.length,2); eq(p.rows[0].agreement_number,null); eq(p.rows[0].line_type,'Labor'); eq(p.rows[0].amount,460.41); eq(p.rows[0].description,'Gomez, Randolph');
  eq(p.rows[1].agreement_number,'165'); eq(p.rows[1].work_order,'11246'); eq(p.dataThrough,'2026-09-30'); eq(V.classifyCost(p.rows[1],[{match_field:'description',pattern:'(?i)applied overhead',bucket:'overhead'}]),'overhead'); });
t('Grouped Agreement List dropped in the Invoices slot → rejected, names the right slot',()=>{ const p=V.parse('invoices',[['SM Agreement List'],['Dates','Rev.','Effective','Status'],['Customer: 1 (A)'],['Agreement: 5 - X'],[1,D('2026-01-01')]]); eq(p.ok,false); if(!/Agreement term history/.test(p.error))throw new Error(p.error); });

// ----- contract terms, renewals and rate changes (real Vista patterns, P1RMR-60) -----
const RT=require('../src/renew27.js');
const rv=(rev,st,eff,exp,price,billed,ts,te,x)=>Object.assign({revision:String(rev),status:st,effective_date:eff,expiration_date:exp,term_price:price,amount_billed:billed,term_start:ts,term_end:te},x||{});
t('Agreement 107: cumulative revision price → $57/mo; a $61.75 blip pays once, the return to $57 pays nothing',()=>{
  const tl=RT.timeline([rv(1,'Terminated','2024-11-01','2026-07-31',1197,1083,'2024-11-01','2027-05-31',{terminated_date:'2026-05-31'}),rv(2,'Terminated','2026-06-01','2027-05-31',1824.04,114,'2024-11-01','2027-05-31',{terminated_date:'2026-07-31'}),rv(3,'Active','2026-08-01','2027-05-31',1767,228,'2024-11-01','2027-05-31')],{today:'2026-10-03'});
  eq(tl.originalStart,'2024-11-01'); eq(tl.renewals,0); const rc=tl.events.filter(e=>e.kind==='rate_change'); eq(rc.length,2); eq(rc[0].next,61.75); eq(rc[0].increase,4.75); eq(rc[1].next,57); eq(rc[1].increase,0); eq(tl.currentRate,57); });
t('Agreement 20: a term that ended early is read by its real end; renewals counted; 12-month term is manual',()=>{
  const tl=RT.timeline([rv(1,'Expired','2013-10-21','2025-09-30',252,252,'2013-10-21','2025-09-30'),rv(2,'Expired','2025-10-01','2026-09-30',312,312,'2025-10-01','2027-09-30'),rv(3,'Cancelled','2026-10-02','2027-09-30',624,0,'2025-10-01','2027-09-30'),rv(4,'Active','2026-10-01','2027-09-30',312,312,'2026-10-01','2027-09-30')],{today:'2026-10-03'});
  eq(tl.originalStart,'2013-10-21'); eq(tl.renewals,2); eq(tl.current.start,'2026-10-01'); eq(tl.current.months,12); eq(tl.currentType,'manual'); eq(tl.currentRate,26); });
t('Agreement 122: a term terminated after a month and replaced is a rewrite, not a renewal',()=>{
  const tl=RT.timeline([rv(1,'Terminated','2025-01-01','2027-12-31',8748,0,'2025-01-01','2027-12-31',{terminated_date:'2025-01-31'}),rv(2,'Active','2025-02-01','2028-01-31',8748,5346,'2025-02-01','2028-01-31')],{today:'2026-10-03'});
  eq(tl.events[1].kind,'rewrite'); eq(tl.renewals,0); eq(tl.currentType,'auto'); });
t('Quotes and cancelled revisions are ignored; an override switches the current term only',()=>{
  const revs=[rv(1,'Original Quote','2025-01-01','2025-12-31',0,0,'2025-01-01','2025-12-31'),rv(2,'Expired','2025-01-01','2025-12-31',1200,1200,'2025-01-01','2025-12-31'),rv(3,'Active','2026-01-01','2028-12-31',3600,900,'2026-01-01','2028-12-31')];
  const a=RT.timeline(revs,{today:'2026-10-03'}); eq(a.currentType,'auto'); eq(a.events[1].renewalType,'auto');
  const b=RT.timeline(revs,{today:'2026-10-03',overrideType:'manual',overrideTermStart:'2026-01-01'}); eq(b.currentType,'manual'); eq(b.events[1].renewalType,'manual');
  const c=RT.timeline(revs,{today:'2026-10-03',overrideType:'manual',overrideTermStart:'2025-01-01'}); eq(c.currentType,'auto'); });
t('Agreement 41: a revision after one billed month spreads the rest over 11 months ($180, the invoiced rate)',()=>{
  const tl=RT.timeline([rv(3,'Terminated','2026-01-01','2026-12-31',1800,150,'2026-01-01','2026-12-31',{terminated_date:'2026-01-01'}),rv(4,'Active','2026-01-02','2026-12-31',2130,1800,'2026-01-01','2026-12-31')],{today:'2026-10-03'});
  eq(tl.currentRate,180); eq(tl.events.find(e=>e.kind==='rate_change').increase,30); });
t('Agreement 67: Alarm.com additions take $36 to $115 (the September invoice)',()=>{
  const tl=RT.timeline([rv(2,'Terminated','2026-06-01','2027-12-31',684,108,'2026-06-01','2027-12-31'),rv(3,'Active','2026-06-02','2027-12-31',1948,345,'2026-06-01','2027-12-31')],{today:'2026-10-03'});
  eq(tl.currentRate,115); });
t('SLA (agreement 149): the price is the annual value — $592,664.61 ÷ 12',()=>{
  const tl=RT.timeline([rv(1,'Terminated','2026-01-01','2026-12-31',736993,429912.56,'2026-01-01','2026-12-31'),rv(2,'Active','2026-01-02','2026-12-31',592664.61,130201.64,'2026-01-01','2026-12-31')],{today:'2026-10-03',annualised:true});
  eq(tl.currentRate,49388.72); });
t('Agreement 14: Vista only holds the months billed since it entered Vista — $1,260 = 28 × $45, so the rate is $45',()=>{
  const r=[rv(1,'Active','2022-02-01','2027-01-31',1260,1170,'2022-02-01','2027-01-31')];
  eq(RT.timeline(r,{today:'2026-10-03'}).currentRate,21); eq(RT.timeline(r,{today:'2026-10-03',knownRate:45}).currentRate,45);
  eq(RT.timeline([rv(1,'Active','2024-11-01','2027-10-31',1924.92,1176,'2024-11-01','2027-10-31')],{today:'2026-10-03',knownRate:60}).currentRate,53.47); });
t('Engine (v2 switch): auto-renewal pays the increase at the new-sale multiple; without it, nothing',()=>{
  const v2=JSON.parse(JSON.stringify(HYBRID)); v2.config.autoRenewalPaysIncrease=true;
  eq(E.toDollars(E.calculate({plan:v2,eventType:'auto_renewal',term:36,newMrr:'120',priorMrr:'100',margin:M50}).totalCents),'20.00');
  eq(E.toDollars(E.calculate({plan:v2,eventType:'rate_increase',term:24,newMrr:'90',priorMrr:'100',margin:M50}).totalCents),'0.00');
  eq(E.toDollars(E.calculate({plan:HYBRID,eventType:'auto_renewal',term:36,newMrr:'120',priorMrr:'100',margin:M50}).totalCents),'0.00'); });

results.forEach(r=>console.log(r[0]+'  '+r[1]));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
