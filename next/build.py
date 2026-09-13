"""Regenerate static HTML from the shared, reviewable content. No dependencies."""
from pathlib import Path
import html, json
ROOT = Path(__file__).resolve().parent
c = json.loads((ROOT / 'content.json').read_text())
e = html.escape

def field(key, value):
    return f'<div class="field"><dt>{key}</dt><dd>{value}</dd></div>'

def rich(value):
    value = e(value)
    for label, url in c.get('references', {}).items():
        value = value.replace(e(label), f'<a href="{e(url, quote=True)}">{e(label)}</a>')
    return value

def items(values):
    return '<ul class="list">' + ''.join(f'<li>{rich(v)}</li>' for v in values) + '</ul>'

fields = field('role', f'{e(c["role"])} at {e(c["company"])}<br>{e(c["team"])}')
fields += field('location', e(c['location']))
fields += field('bio', e(c['bio']))
fields += field('background', items(c['background']))
fields += field('focus', items(c['focus']))
fields += field('links', '<div class="contact">' + ''.join(f'<a href="{e(v["url"], quote=True)}">{e(v["label"])}</a>' for v in c['links']) + '</div>')
buttons = ''.join(f'<button type="button" data-model="{key}" aria-pressed="false">{label}</button>' for key,label in [('claude','Claude'),('chatgpt','ChatGPT'),('grok','Grok'),('gemini','Gemini')])
page = f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(c['name'])} — {e(c['role'])}, founder &amp; operator</title>
<meta name="description" content="{e(c['bio'], quote=True)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://natemcguire.com/">
<link rel="icon" href="/favicon.ico">
<meta property="og:title" content="Nate McGuire — Staff Engineer, founder &amp; operator">
<meta property="og:description" content="{e(c['bio'], quote=True)}">
<meta property="og:url" content="https://natemcguire.com/">
<meta property="og:image" content="https://natemcguire.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{json.dumps({"@context":"https://schema.org","@type":"Person","name":c['name'],"jobTitle":c['role'],"worksFor":{"@type":"Organization","name":c['company']},"url":"https://natemcguire.com/","description":c['bio'],"sameAs":[v['url'] for v in c['links'] if v['url'].startswith('https:')]})}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-MP2PD28L5S"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-MP2PD28L5S');</script>
<link rel="stylesheet" href="base.css">
<script src="app.js" type="module"></script>
</head><body><!--email_off-->
<header class="design-bar" hidden>
<span class="design-label">Generate a design with</span>
<div class="controls" role="group" aria-label="Choose a design collection">
<button type="button" data-model="base" aria-pressed="true">Source</button>{buttons}
</div>

<p id="design-status" role="status" aria-live="polite"></p>
<noscript>Design switching needs JavaScript. The full profile is below.</noscript>
</header>
<main class="profile" id="profile">
<div class="file-heading"><span>natemcguire / profile</span><a href="content.json">View JSON ↗</a></div>
<h1><span class="syntax">{{ </span>{e(c['name'])}</h1>
<dl class="record">{fields}</dl>
<div class="syntax closing" aria-hidden="true">}}</div>
</main>
<footer class="site-footer"><nav aria-label="More about Nate"><a href="/">bio</a><a href="/author">author</a><a href="/about">about</a><a href="/speaking">speaking</a><a href="/work-with-me">work</a></nav><span>© Nate McGuire</span></footer>
<!--/email_off--></body></html>
'''
(ROOT / 'index.html').write_text(page)
print('Built next/index.html from content.json')
