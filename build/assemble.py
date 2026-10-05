# Inline the v2.7 modules into the single-file app. Idempotent: replaces content between markers.
import re
p='/home/claude/P1-Bonus-TrackerV1/index.html'; s=open(p,encoding='utf-8').read()
src=lambda f: open('/home/claude/P1-Bonus-TrackerV1/src/'+f,encoding='utf-8').read()
head_block=('<!--V27-HEAD-->\n<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>\n'
            '<script>\n'+src('engine27.js')+'\n</script>\n<script>\n'+src('vista27.js')+'\n</script>\n<script>\n'+src('renew27.js')+'\n</script>\n<!--/V27-HEAD-->\n')
if '<!--V27-HEAD-->' in s: s=re.sub(r'<!--V27-HEAD-->.*?<!--/V27-HEAD-->\n',lambda m:head_block,s,flags=re.S)
else:
    anchor='<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>\n'
    assert s.count(anchor)==1; s=s.replace(anchor,anchor+head_block)
import base64
b64=lambda f: 'data:image/png;base64,'+base64.b64encode(open('/home/claude/P1-Bonus-TrackerV1/assets/'+f,'rb').read()).decode()
shell=src('shell27.js').replace('__P1_LOGO_REV__',b64('point1-logo-reversed.png')).replace('__P1_LOGO__',b64('point1-logo.png'))
tail_block='</script>\n<script>\n/*V27-UI*/\n'+src('ui27.js')+'\n'+shell+'\n'+src('deals27.js')+'\n/*/V27-UI*/\nrenderLegend();\nboot();\n</script>\n</body>'
if '/*V27-UI*/' in s: s=re.sub(r'</script>\n<script>\n/\*V27-UI\*/.*?</body>',lambda m:tail_block,s,flags=re.S)
else:
    old='renderLegend();\nboot();\n</script>\n</body>'; assert s.count(old)==1; s=s.replace(old,tail_block)
s=s.replace("const APP_VERSION='P1RMR-55';","const APP_VERSION='P1RMR-62 · spec 2.7';")
# The owner's address is a break-glass Administrator only: it follows its Employees role like anyone else,
# and is forced to Administrator only when the users table can't be read or no other Administrator exists.
_old_guard="  if(ADMIN_EMAILS.includes(lc)){ CURRENT_ROLE='Administrator'; return; }   // guaranteed admin\n"
assert _old_guard in s
s=s.replace(_old_guard,"")
s=s.replace("const ADMIN_EMAILS=['sean.bithell@point1.com'];   // always Administrator, even if rmr_users is empty/unmigrated","const ADMIN_EMAILS=['sean.bithell@point1.com'];   // break-glass owner: Administrator only when no other Administrator exists or rmr_users is unreadable")
_old_catch="  catch(e){ CURRENT_ROLE='Representative'; }   // users table unreachable → Representative (keeps calculate & export, TEC-06)\n}"
assert _old_catch in s
s=s.replace(_old_catch,"""  catch(e){ CURRENT_ROLE=ADMIN_EMAILS.includes(lc)?'Administrator':'Representative'; return; }   // users table unreachable → owner keeps admin; everyone else Representative (TEC-06)
  if(ADMIN_EMAILS.includes(lc)&&CURRENT_ROLE!=='Administrator'){   // break-glass: the owner is Administrator only if no one else is
    try{ const q=await sb.from('rmr_users').select('email,role,permission_role'); const others=(q.data||[]).filter(u=>String(u.email||'').toLowerCase()!==lc&&normRole(u.permission_role||u.role)==='Administrator');
      if(q.error||!others.length) CURRENT_ROLE='Administrator'; }catch(_){ CURRENT_ROLE='Administrator'; } }
}""")
css='<style id="theme27">\n'+src('theme27.css')+'\n</style>\n'
if '<style id="theme27">' in s: s=re.sub(r'<style id="theme27">.*?</style>\n',lambda m:css,s,flags=re.S)
else: assert s.count('</head>')==1; s=s.replace('</head>',css+'</head>')
open(p,'w',encoding='utf-8').write(s); print('assembled', len(s))
