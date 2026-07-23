import sys, os
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'd:\Code\CableWeb153'

# ================================================================
# VERIFY ONLY — All fixes have been applied manually
# ================================================================
print("=== VERIFY ===")
with open(f'{BASE}/index.html', encoding='utf-8') as f:
    h = f.read()
with open(f'{BASE}/admin.html', encoding='utf-8') as f:
    a = f.read()
with open(f'{BASE}/js/calculators.js', encoding='utf-8') as f:
    calc = f.read()
with open(f'{BASE}/js/calc_engine.js', encoding='utf-8') as f:
    eng = f.read()

checks = [
    # Brand
    ('B·W CABLE', 'Brand name present', True),
    ('GCC Cable', 'Old brand removed', False),
    # Active state fix in JS
    ('bg-amber-400 text-slate-950 font-black border-2 border-amber-500 shadow-md', 'Active style present', True),
    ('bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold', 'Inactive style present', True),
    # Dark classes removed from JS toggles
    ("bg-slate-800","Dark toggle class in JS", False),
    # Overflow fix
    ('overflow-x-auto', 'Overflow-x-auto class', True),
    ('snap-x', 'Snap-x class', True),
]

all_ok = True
for pat, label, should_exist in checks:
    content = h + a + calc + eng
    found = pat in content
    ok = found == should_exist
    if not ok:
        all_ok = False
    status = 'OK' if ok else 'FAIL'
    print(f'  [{status}] {label}')

if all_ok:
    print('\nAll checks passed!')
else:
    print('\nSome checks failed — review manually.')