"""Reuse each approved design's actual palette, texture and type on reading pages."""
import re,json
from pathlib import Path

def build_themes(root):
 themes={}
 common='''
.themed-page{margin:0;min-height:100vh;display:block;overflow-x:hidden}
.themed-page .design-bar{background:#fff;color:#202124}
.themed-page .secondary-page{max-width:1060px;margin:0 auto;padding:clamp(36px,7vw,96px) 24px 80px;font:inherit}
.themed-page .secondary-page h1{font-family:inherit;font-weight:800;font-size:clamp(42px,7vw,88px);line-height:1.03;letter-spacing:-.045em;margin:0 0 36px;padding-bottom:24px;border-bottom:4px solid currentColor}
.themed-page .secondary-page h2{font-size:clamp(25px,4vw,38px);line-height:1.2;letter-spacing:-.025em;margin:48px 0 20px}
.themed-page .secondary-page h3,.themed-page .secondary-page h4{font-size:23px;line-height:1.3}
.themed-page .secondary-page p,.themed-page .secondary-page li{max-width:72ch;font-size:18px;line-height:1.75}
.themed-page .secondary-page a{color:inherit;text-decoration-thickness:1px}
.themed-page .secondary-page .meta,.themed-page .secondary-page .label{color:inherit;opacity:.7}
.themed-page .secondary-page .principle,.themed-page .secondary-page .bio-card{border-top:1px solid currentColor;padding:20px 0;margin:28px 0}
.themed-page .site-footer{color:inherit;border-top:1px solid currentColor;padding-top:24px}
.secondary-page img{max-width:100%;height:auto}.secondary-page pre{overflow:auto;padding:20px;background:#0000000c}.secondary-page .chart-wrap{height:320px}.secondary-page .article-figure{margin:32px 0}.secondary-page figcaption{font-size:14px;opacity:.8}.secondary-page button{color:inherit}
'''
 for p in (root/'next/designs').glob('*/index.html'):
  text=p.read_text();css='\n'.join(re.findall(r'<style[^>]*>(.*?)</style>',text,re.S))
  roots=re.findall(r':root\s*\{([^}]+)}',css)
  bodies=re.findall(r'(?<![\w.-])body\s*\{([^}]+)}',css)
  # Only first body rule: later rules may be descendants or responsive overrides.
  body=bodies[0] if bodies else ''
  props=[]
  for declaration in body.split(';'):
   if re.match(r'\s*(?:background(?:-[\w-]+)?|color|font(?:-[\w-]+)?|line-height)\s*:',declaration):props.append(declaration)
  if p.parent.name=='gemini-04':props+=['color:#111','font-family:Helvetica,Arial,sans-serif']
  theme='.themed-page{'+''.join(roots)+';'+';'.join(props)+'}'+common
  if p.parent.name=='claude-04':theme+='''.themed-page .secondary-page h1{text-transform:uppercase;font-family:var(--disp);text-shadow:-3px -3px var(--blue),3px 3px var(--pink);font-size:clamp(52px,10vw,125px);border-bottom:7px solid var(--ink)}.themed-page .secondary-page h2{text-transform:uppercase;color:var(--pink)}'''
  if p.parent.name in ['claude-03','grok-02']:theme+='.themed-page .secondary-page h1,.themed-page .secondary-page h2{font-family:ui-monospace,monospace;text-transform:uppercase}'
  themes[p.parent.name]=theme
 return themes
