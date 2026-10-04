# Usability pass (P1RMR-57): Quarter view reads revised deals from their payment state (no "Payable" before a
# payment is earned, no Mark-paid on revised deals), clearer cards, and a View button for reps on Agreements.
p='/home/claude/P1-Bonus-TrackerV1/index.html'; s=open(p,encoding='utf-8').read()
def rep(old,new,count=1):
    global s
    assert s.count(old)==count, (s.count(old), old[:90]); s=s.replace(old,new)

# 1. Quarter lines: revised deals contribute payment 1 / payment 2 with their real state
rep("""  scopedAgreements().forEach(a=>{const c=compute(a);
    if(c.legacyFull){""",
"""  scopedAgreements().forEach(a=>{const c=compute(a);
    if(c.revised&&c.revisedCalc&&typeof revisedQuarterLines27==='function'){
      revisedQuarterLines27(a,c).forEach(l=>{ if(l.qi===selQI) lines.push(l); });
    } else if(c.legacyFull){""")

# 2. Cards: separate earned from expected; "Collected" meant commission paid out
rep("""  const total=lines.reduce((s,l)=>s+l.amount,0),paid=lines.filter(l=>l.paid).reduce((s,l)=>s+l.amount,0),owed=total-paid;""",
"""  const total=lines.reduce((s,l)=>s+l.amount,0),paid=lines.filter(l=>l.paid).reduce((s,l)=>s+l.amount,0);
  const expectedAmt=lines.filter(l=>l.rstate==='expected').reduce((s,l)=>s+l.amount,0), owed=total-paid-expectedAmt;""")
rep("""    <div class="stat accent"><div class="lbl">Due this quarter</div><div class="val">${fmt(total)}</div></div>
    <div class="stat green"><div class="lbl">Still owed</div><div class="val">${fmt(owed)}</div></div>
    <div class="stat blue"><div class="lbl">Collected</div><div class="val">${fmt(paid)}</div></div>""",
"""    <div class="stat accent"><div class="lbl">This quarter</div><div class="val">${fmt(total)}</div><div class="qctx">earned + expected</div></div>
    <div class="stat green"><div class="lbl">Earned, not paid</div><div class="val">${fmt(owed)}</div></div>
    <div class="stat orange"><div class="lbl">Expected</div><div class="val">${fmt(expectedAmt)}</div><div class="qctx">waiting on conditions</div></div>
    <div class="stat blue"><div class="lbl">Paid out</div><div class="val">${fmt(paid)}</div></div>""")
rep("""    <div class="stat"><div class="lbl">Renewals this qtr</div><div class="val">${renCt}</div></div>
""","")

# 3. Piece rows and group status for revised lines
rep("""  const pieceRow=(l)=>{
""","""  const pieceRow=(l)=>{
    if(l.rstate&&typeof revisedPieceRow27==='function') return revisedPieceRow27(l);
""")
rep("""    const ometa=allPaid?{cls:'c-paid',label:'Paid'}""","""    const ometa=(g.items.every(l=>l.rstate)&&typeof revisedGroupMeta27==='function')?revisedGroupMeta27(g.items):allPaid?{cls:'c-paid',label:'Paid'}""")

# 4. Agreements list: reps get a View button (read-only detail)
rep("""      <td style="white-space:nowrap">${can('editAgreements')?`<button class="iconbtn" data-edit="${a.id}">Edit</button>""",
"""      <td style="white-space:nowrap">${!can('editAgreements')?`<button class="iconbtn" data-view27="${a.id}">View</button>`:''}${can('editAgreements')?`<button class="iconbtn" data-edit="${a.id}">Edit</button>""")
rep("""  $('agTableWrap').querySelectorAll('[data-edit]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openModal(b.dataset.edit);});""",
"""  $('agTableWrap').querySelectorAll('[data-edit]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openModal(b.dataset.edit);});
  $('agTableWrap').querySelectorAll('[data-view27]').forEach(b=>b.onclick=(e)=>{e.stopPropagation(); if(typeof viewAgreement27==='function') viewAgreement27(b.dataset.view27);});""")

# 5. Opportunity modal wording no longer tells reps to "Win" it
rep("""A lightweight stub. Fill in the real sold values later when you Win it.""","""<span id="oppSub27">A lightweight stub. When the customer signs, the deal is set up from it.</span>""")

rep('''<div style="font-size:13px;color:var(--muted)">Pipeline of potential deals.''','''<div style="font-size:13px;color:var(--muted)" id="oppIntro27">Pipeline of potential deals.''')
open(p,'w',encoding='utf-8').write(s); print('patch3 ok')
