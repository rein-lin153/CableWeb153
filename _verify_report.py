import sys, os
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'd:\Code\CableWeb153'

with open(f'{BASE}/index.html', encoding='utf-8') as f:
    idx = f.read()
with open(f'{BASE}/admin.html', encoding='utf-8') as f:
    adm = f.read()

print('=' * 60)
print('BUG FIX VERIFICATION REPORT')
print('=' * 60)

checks = [
    # index.html dual-source merge
    ('index.html', 'Dual-source loadArticles()', 'localMap = new Map' in idx),
    ('index.html', 'localStorage key (gcc_articles)', "'gcc_articles'" in idx),
    ('index.html', 'Base articles from JSON', 'baseArticles = await res.json()' in idx),
    ('index.html', 'Override-by-id merge logic', 'localMap.has(a.id)' in idx),
    ('index.html', 'Append new-only articles', '!baseArticles.some' in idx),
    # admin.html
    ('admin.html', 'Save toast updated (edit)', 'Saved to local' in adm),
    ('admin.html', 'Save toast updated (create)', 'Created locally' in adm),
    ('admin.html', 'Reset button HTML (btn-reset-data)', 'btn-reset-data' in adm),
    ('admin.html', 'Reset onclick (resetAllData())', 'resetAllData()' in adm),
    ('admin.html', 'Reset function def (window.resetAllData)', 'window.resetAllData' in adm),
    ('admin.html', 'Reset clears localStorage', 'localStorage.removeItem(STORAGE_KEY)' in adm),
    ('admin.html', 'Reset reloads articles', 'loadArticles();' in adm),
    ('admin.html', 'Reset success toast', 'Reset to default data' in adm),
    ('admin.html', 'Delete toast updated', 'Export JSON' in adm and 'Deleted!' in adm),
    # Cross-check
    ('Both', 'Same localStorage key', "'gcc_articles'" in idx and 'gcc_articles' in adm),
]

all_pass = True
for file_loc, name, result in checks:
    status = '  OK  ' if result else '  FAIL'
    if not result:
        all_pass = False
    print(f'[{status}] {name}')

print()
if all_pass:
    print('*** ALL 15 CHECKS PASSED ***')
else:
    print('*** Some checks failed ***')

print()
print('SUMMARY:')
print('  BUG: admin.html saves to localStorage, but index.html only')
print('       reads from data/articles.json - new admin articles invisible.')
print()
print('  FIX: index.html loadArticles() now does dual-source merge:')
print('    1. Fetch base articles from data/articles.json')
print('    2. Read overrides from localStorage (gcc_articles)')
print('    3. Merge: localStorage articles override by ID, new IDs appended')
print()
print('  BONUS: Added Reset Data button in admin to clear local cache')
print('         Updated all toast messages to guide users to Export JSON')
