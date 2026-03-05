import json
from pathlib import Path

root = Path('/mnt/c/knexit-workspace/knexit-workspace')
log_path = root / 'anm-guided.log'
call1 = json.loads((root / 'guided-call1.json').read_text(encoding='utf-8'))
call2 = json.loads((root / 'guided-call2.json').read_text(encoding='utf-8'))

orch1 = ((call1.get('engine') or {}).get('orchestration') or {})
orch2 = ((call2.get('engine') or {}).get('orchestration') or {})

print('CALL1', call1.get('trace_id'), orch1.get('session_id'), len(str(call1.get('answer', ''))))
print('CALL2', call2.get('trace_id'), orch2.get('session_id'), len(str(call2.get('answer', ''))))
print('---LOG_EVENTS---')

for raw in log_path.read_text(encoding='utf-8', errors='replace').splitlines():
    raw = raw.strip()
    if not raw.startswith('{'):
        continue
    try:
        row = json.loads(raw)
    except Exception:
        continue
    event = row.get('event')
    if event not in {'secondary_memory_session_started', 'orchestration_started', 'orchestration_completed'}:
        continue
    payload = row.get('payload', {})
    print(json.dumps({
        'timestamp': row.get('timestamp'),
        'event': event,
        'trace_id': row.get('trace_id'),
        'request_id': payload.get('request_id'),
        'session_id': payload.get('session_id'),
        'continued_from_session_id': payload.get('continued_from_session_id'),
        'response_mode': payload.get('response_mode'),
        'cycle_count': payload.get('cycle_count'),
        'stop_reason': payload.get('stop_reason'),
    }, ensure_ascii=False))
