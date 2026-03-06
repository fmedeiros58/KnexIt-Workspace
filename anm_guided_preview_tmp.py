import json
from pathlib import Path
root = Path('c:/knexit-workspace/knexit-workspace')
for idx in (1,2):
    row = json.loads((root / f'guided-call{idx}.json').read_text(encoding='utf-8'))
    ans = str(row.get('answer','')).strip().replace('\n',' ')
    print(f'CALL{idx}_PREVIEW={ans[:420]}')
