
p='/home/claude/P1-Bonus-TrackerV1/index.html'; s=open(p,encoding='utf-8').read()
old="""/* CAT-06 / F-12: the loader no longer fills superseded rate defaults"""
new="""/* MIG-04 / CAT-02: historical rule sets are reproduced with the values that were actually in force when they computed —
   the stored config plus the loader defaults that applied before v2.7. This is used ONLY for archived historical
   versions that past transactions read; the revised plan never passes through it (it loads via engine27). */
function historicalEffectiveConfig(j){ j=JSON.parse(JSON.stringify(j||{})); if(j.targetMargin==null)j.targetMargin=0.50; if(j.minMargin==null)j.minMargin=0.45; if(!j.planVersion)j.planVersion='2026 v1.0'; if(!j.basis)j.basis='TCV'; if(!j.autoRenewalPct)j.autoRenewalPct={12:0.02,24:0.025}; if(j.immediatePct==null)j.immediatePct=0.75; if(j.holdbackPct==null)j.holdbackPct=0.25; if(j.holdbackThresholdPct==null)j.holdbackThresholdPct=0.25; if(j.accelReleasePct==null)j.accelReleasePct=0.50; if(j.overheadPct==null)j.overheadPct=0.28; if(!j.planType)j.planType='A'; if(j.rmrMultiple==null)j.rmrMultiple=2.00; if(j.newInitialPct==null)j.newInitialPct=0.50; if(j.newDeferredPct==null)j.newDeferredPct=0.50; if(j.renInitialPct==null)j.renInitialPct=0.50; if(j.renDeferredPct==null)j.renDeferredPct=0.50; if(j.bManualRenewalPct==null)j.bManualRenewalPct=0.04; if(j.bAutoRenewalPct==null)j.bAutoRenewalPct=0.01;
  if(j.role==null)j.role=''; if(j.quotaMonthlyRmr==null)j.quotaMonthlyRmr=0; if(j.accelMultiplier==null)j.accelMultiplier=1; if(!j.releaseMode)j.releaseMode='revenue'; if(j.releaseOffsetMonths==null)j.releaseOffsetMonths=3;
  if(j.termConversionMult==null)j.termConversionMult=0; if(j.termConversionMinTerm==null)j.termConversionMinTerm=36; if(j.portfolioBonus==null)j.portfolioBonus=false;
  if(j.slaNewMult==null)j.slaNewMult=0; if(j.slaRenewMult==null)j.slaRenewMult=0; if(j.slaCap==null)j.slaCap=0;
  if(!j.amendMode)j.amendMode='new'; if(j.amendEscalatorPays==null)j.amendEscalatorPays=true;
  if(!Array.isArray(j.grrBonus)||!j.grrBonus.length)j.grrBonus=[{min:0.95,pct:0.02},{min:0.965,pct:0.04},{min:0.98,pct:0.06},{min:0.99,pct:0.08}]; if(!Array.isArray(j.nrrBonus)||!j.nrrBonus.length)j.nrrBonus=[{min:1.03,pct:0.02},{min:1.05,pct:0.04},{min:1.08,pct:0.06},{min:1.10,pct:0.08}];
  j.historical=true; return j; }
/* CAT-06 / F-12: the loader no longer fills superseded rate defaults"""
assert s.count(old)==1; s=s.replace(old,new)
for o,n in [("PLANS=(data||[]).filter(p=>p&&p.config).map(p=>({...p,config:normalizeConfig(p.config)}));","PLANS=(data||[]).filter(p=>p&&p.config).map(p=>({...p,config:historicalEffectiveConfig(p.config)}));   // historical, read-only (CAT-02)"),
            ("      CONFIG=normalizeConfig(JSON.parse(JSON.stringify(def.config)));","      CONFIG=JSON.parse(JSON.stringify(def.config));")]:
    assert s.count(o)==1,o; s=s.replace(o,n)
open(p,'w',encoding='utf-8').write(s); print('patch2 ok')
