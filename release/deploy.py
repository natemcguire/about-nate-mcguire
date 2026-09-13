"""Run on the Mac mini, from a staged release directory. Never print credentials."""
from pathlib import Path
import os,re,subprocess,sys
root=Path(__file__).resolve().parent
env=os.environ.copy()
for k in ['CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL']:env.pop(k,None)
for line in (Path.home()/'.config/keys/keys.env').read_text().splitlines():
 match=re.match(r'^(?:export\s+)?(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)\s*=\s*(.*)$',line)
 if match:env[match[1]]=match[2].strip().strip('"\'')
assert env.get('CLOUDFLARE_API_TOKEN') and env.get('CLOUDFLARE_ACCOUNT_ID')
cmd=['/opt/homebrew/bin/node','/opt/homebrew/bin/wrangler','pages','deploy','site','--project-name','natemcguire-v2','--branch','main','--commit-dirty=true']
if len(sys.argv)>1:cmd+=['--commit-hash',sys.argv[1]]
raise SystemExit(subprocess.run(cmd,cwd=root,env=env).returncode)
