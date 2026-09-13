"""Build isolated full-website previews. Never inject the structured base template."""
from pathlib import Path
import json, re, shutil
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'review-round2';OUT.mkdir(exist_ok=True)
catalog=[]
for model in ['claude','chatgpt','grok','gemini']:
 folder=ROOT/'candidates-round2'/model
 if not (folder/'submission.json').exists(): continue
 sub=json.loads((folder/'submission.json').read_text())
 for v in sub['variations']:
  ident=v['id'];assert re.fullmatch(r'[a-z]+-0[1-5]',ident)
  source=folder/v.get('entry',ident+'/index.html')
  assert source.is_file(),source
  dest=OUT/ident;dest.mkdir(exist_ok=True)
  text=source.read_text()
  # These are local-only candidates, with isolated browser capability boundaries.
  # Network-free policy allows inline interaction and SVG/canvas but no data transmission.
  policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  additions=f'<meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="{policy}">'
  text=re.sub(r'(<head\b[^>]*>)',lambda m:m.group(1)+additions,text,count=1,flags=re.I)
  (dest/'index.html').write_text(text)
  catalog.append({'id':ident,'model':model,'name':v['name'],'rationale':v.get('rationale',''),'modelVersion':sub.get('modelVersion',v.get('modelVersion','Unknown')),'generatedAt':sub.get('generatedAt',v.get('generatedAt','')),'url':ident+'/'})
(OUT/'catalog.json').write_text(json.dumps(catalog,indent=2))
print('Standalone website previews:',len(catalog))
