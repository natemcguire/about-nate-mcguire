from pathlib import Path
import json,re,shutil,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'release/site';OUT.mkdir(exist_ok=True)
content=json.loads((ROOT/'next/content.json').read_text())
manifest={'schemaVersion':2,'variations':[]}
overrides=json.loads((ROOT/'next/design-overrides.json').read_text())
policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
for model in ['claude','chatgpt','grok','gemini']:
 folder=ROOT/'design-briefs/candidates-round2'/model
 sub=json.loads((folder/'submission.json').read_text())
 for v in sub['variations']:
  ident=v['id'];selected_folder=folder;selected_sub=sub
  if ident in overrides:
   selected_folder=ROOT/overrides[ident]['folder']
   selected_sub=json.loads((selected_folder/'submission.json').read_text())
   v=next(item for item in selected_sub['variations'] if item['id']==ident)
  source=selected_folder/v['entry'];text=source.read_text()
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
  manifest['variations'].append({'id':ident,'model':model,'name':v['name'],'entry':f'designs/{ident}/','modelVersion':selected_sub.get('modelVersion',v.get('modelVersion')),'generatedAt':selected_sub.get('generatedAt',v.get('generatedAt')),'contentVersion':content['version'],'review':{'nate':'approved','agent':'approved'},'sha256':hashlib.sha256(text.encode()).hexdigest()})
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

# Every reading page shares the model selector and keeps its selected design.
from themes import build_themes
(OUT/'designs/themes.json').write_text(json.dumps(build_themes(ROOT)))
base=(ROOT/'next/index.html').read_text()
footer=re.search(r'<footer.*?</footer>',base,re.S).group()
bar=re.search(r'<header class="design-bar".*?</header>',base,re.S).group()
assets=''.join(re.findall(r'<(?:link rel="stylesheet"|script src="app.js)[^>]*>(?:</script>)?',base))
assets=assets.replace('href="base.css','href="/base.css').replace('src="app.js','src="/app.js')
sources=[ROOT/'v2'/f'{name}.html' for name in ['about','author','speaking','work-with-me']]+list((ROOT/'v2/author').glob('*.html'))
for source in sources:
 old=source.read_text()
 body=re.split(r'</header>',old,maxsplit=1)[1]
 body=re.split(r'<footer\b',body,maxsplit=1)[0]
 body=body.replace('McLean, VA','Alexandria, Virginia')
 override=ROOT/'next/pages'/source.name
 if source.parent.name!='author' and override.exists(): body=override.read_text()
 if source.name=='author.html':
  body='<h1>Writing</h1><p>Notes on building software, growing teams, and running a business.</p><p><a href="https://medium.com/@natemcguire">Follow on Medium ↗</a></p>'+body[body.index('<h2>Writings</h2>'):]
 head=old.split('</head>')[0].replace('operator and investor in a portfolio of small internet businesses.', 'startup investor, small business buyer, and advisor to founders and financial firms on technology due diligence.')
 head=re.sub(r'<link rel="stylesheet"[^>]*>','',head)
 tail='<script src="/author/tldr.js" defer></script>' if source.parent.name=='author' else ''
 page=head+assets+'</head><body><!--email_off-->'+bar+'<main class="secondary-page" id="profile">'+body+'</main>'+footer+tail+'<!--/email_off--></body></html>'
 (OUT/source.relative_to(ROOT/'v2')).write_text(page)

(OUT/'404.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Nate McGuire</title>'+assets+'</head><body>'+bar+'<main id="profile" class="secondary-page"><h1>Page not found</h1><p><a href="/">Back to Nate McGuire</a></p></main>'+footer+'</body></html>')

# Version the corrected social card so share crawlers request the new artwork.
shutil.copy(ROOT/'next/og-image-staff.png', OUT/'og-image-staff.png')
shutil.copy(ROOT/'next/og-image-staff.png', OUT/'og-image.png')
for page in list(OUT.glob('*.html'))+list((OUT/'author').glob('*.html')):
 text=page.read_text().replace('https://natemcguire.com/og-image.png','https://natemcguire.com/og-image-staff.png')
 text=text.replace('property="og:image:width" content="1200"','property="og:image:width" content="1731"').replace('property="og:image:height" content="630"','property="og:image:height" content="909"')
 page.write_text(text)
