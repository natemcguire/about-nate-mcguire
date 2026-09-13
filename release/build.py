from pathlib import Path
import json,re,shutil,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'release/site';OUT.mkdir(exist_ok=True)
content=json.loads((ROOT/'next/content.json').read_text())
manifest={'schemaVersion':2,'variations':[]}
policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
for model in ['claude','chatgpt','grok','gemini']:
 folder=ROOT/'design-briefs/candidates-round2'/model
 sub=json.loads((folder/'submission.json').read_text())
 for v in sub['variations']:
  ident=v['id'];source=folder/v['entry'];text=source.read_text()
  text=re.sub(r'(<body\b[^>]*>)',lambda m:m.group(1)+'<!--email_off-->',text,count=1,flags=re.I).replace('</body>','<!--/email_off--></body>')
  def link(match):
   tag=match.group()
   if not re.search(r'''href\s*=\s*["'](?:https?://|mailto:)''',tag,re.I):return tag
   tag=re.sub(r'''\s+(?:target|rel)\s*=\s*(?:"[^"]*"|'[^']*')''','',tag,flags=re.I)
   return tag[:-1]+' target="_blank" rel="noopener noreferrer">'
  text=re.sub(r'<a\b[^>]*>',link,text,flags=re.I)
  meta=f'<meta name="robots" content="noindex,follow"><meta http-equiv="Content-Security-Policy" content="{policy}">'
  text=re.sub(r'(<head\b[^>]*>)',lambda m:m.group(1)+meta,text,count=1,flags=re.I)
  dest=ROOT/'next/designs'/ident;dest.mkdir(exist_ok=True);(dest/'index.html').write_text(text)
  manifest['variations'].append({'id':ident,'model':model,'name':v['name'],'entry':f'designs/{ident}/','modelVersion':sub.get('modelVersion',v.get('modelVersion')),'generatedAt':sub.get('generatedAt',v.get('generatedAt')),'contentVersion':content['version'],'review':{'nate':'approved','agent':'approved'},'sha256':hashlib.sha256(text.encode()).hexdigest()})
(ROOT/'next/designs/manifest.json').write_text(json.dumps(manifest,indent=2))
for name in ['index.html','base.css','app.js','selection.mjs','content.json']:
 shutil.copy(ROOT/'next'/name,OUT/name)
shutil.copytree(ROOT/'next/designs',OUT/'designs',dirs_exist_ok=True)
# Preserve published writing URLs and their existing TLDR function.
for name in ['author.html','style.css','favicon.ico','og-image.png','headshot.jpg','tldr-manifest.json']:
 shutil.copy(ROOT/'v2'/name,OUT/name)
shutil.copytree(ROOT/'v2/author',OUT/'author',dirs_exist_ok=True)
shutil.copytree(ROOT/'v2/functions',ROOT/'release/functions',dirs_exist_ok=True)
redirects=(ROOT/'v2/_redirects').read_text()
# Secondary pages remain available from the quiet footer.
(OUT/'_redirects').write_text(redirects)
(OUT/'_headers').write_text('''/*
  Cache-Control: no-cache
/designs/*
  X-Robots-Tag: noindex
/content.json
  X-Robots-Tag: noindex
''')
shutil.copy(ROOT/'v2/robots.txt',OUT/'robots.txt')
urls=['https://natemcguire.com/','https://natemcguire.com/author','https://natemcguire.com/about','https://natemcguire.com/speaking','https://natemcguire.com/work-with-me']+[f'https://natemcguire.com/author/{p.stem}' for p in sorted((ROOT/'v2/author').glob('*.html'))]
(OUT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>{u}</loc></url>' for u in urls)+'</urlset>\n')
(OUT/'llms.txt').write_text('# Nate McGuire\n\n'+content['role']+' at '+content['company']+', '+content['team']+'. '+content['location']+'.\n\n'+content['bio']+'\n\n'+'\n'.join('- '+x for x in content['background'])+'\n\nhttps://natemcguire.com/content.json\n')
(OUT/'404.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Nate McGuire</title><link rel="stylesheet" href="/base.css"><main class="profile"><h1>Page not found</h1><a href="/">Back to Nate McGuire</a></main></html>')
(ROOT/'release/wrangler.toml').write_text((ROOT/'v2/wrangler.toml').read_text().replace('pages_build_output_dir = "."','pages_build_output_dir = "site"'))
print(f'Built release/site: {len(manifest["variations"])} approved designs; writing archive preserved.')

# Plain secondary pages share the understated footer, not the model gallery UI.
base=(ROOT/'next/index.html').read_text()
footer=re.search(r'<footer.*?</footer>',base,re.S).group()
for name in ['about','author','speaking','work-with-me']:
 old=(ROOT/'v2'/f'{name}.html').read_text()
 body=re.split(r'</header>',old,maxsplit=1)[1].split('<footer>')[0]
 body=body.replace('McLean, VA','Alexandria, Virginia')
 head=old.split('</head>')[0]
 head=re.sub(r'<link rel="stylesheet"[^>]*>','',head)
 page=head+'<link rel="stylesheet" href="/base.css"></head><body><!--email_off--><main class="secondary-page">'+body+'</main>'+footer+'<!--/email_off--></body></html>'
 (OUT/f'{name}.html').write_text(page)
# Secondary pages also need fresh shared styling in browsers holding an older /base.css.
style_version=hashlib.sha256((ROOT/'next/base.css').read_bytes()).hexdigest()[:12]
for page in OUT.glob('*.html'):
 text=page.read_text().replace('href="/base.css"',f'href="/base.css?v={style_version}"')
 page.write_text(text)
