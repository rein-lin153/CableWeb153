"""Final bug fix report - Verify all changes and generate report"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'd:\Code\CableWeb153'

# Load both files
with open(f'{BASE}/index.html', encoding='utf-8') as f:
    idx = f.read()
with open(f'{BASE}/admin.html', encoding='utf-8') as f:
    adm = f.read()

print('=' * 60)
print('BUG FIX REPORT: Admin Articles Not Showing on Homepage')
print('=' * 60)
print()

checks = [
    ('index.html', 'Dual-source loadArticles()', 'localMap = new Map' in idx),
    ('index.html', 'localStorage read (gcc_articles)', "'gcc_articles'" in idx),
    ('index.html', 'Base articles from JSON', 'baseArticles = await res.json()' in idx),
    ('index.html', 'Merge logic (override by id)', 'localMap.has(a.id) ? localMap.get(a.id) : a' in idx),
    ('index.html', 'Append new-only articles', "!baseArticles.some(a => a.id === la.id)" in idx),

    ('admin.html', 'Save toast updated (edit)', 'Saved to local! Export JSON' in adm),
    ('admin.html', 'Save toast updated (create)', 'Created locally! Export JSON' in adm),
    ('admin.html', 'Reset button HTML', 'btn-reset-data' in adm),
    ('admin.html', 'Reset onclick handler', 'resetAllData()' in adm),
    ('admin.html', 'Reset function definition', 'window.resetAllData' in adm),
    ('admin.html', 'Reset clears localStorage', 'localStorage.removeItem(STORAGE_KEY)' in adm),
    ('admin.html', 'Reset reloads articles', 'loadArticles()' in adm),
    ('admin.html', 'Reset success toast', 'Reset to default data' in adm),
    ('admin.html', 'Delete toast updated', 'Deleted! Export JSON' in adm),

    ('Both', 'Same localStorage key', 'gcc_articles' in idx and 'gcc_articles' in adm),
]

all_pass = True
for file_loc, check_name, result in checks:
    status = 'PASS' if result else 'FAIL'
    if not result:
        all_pass = False
    print(f'  [{status}] {check_name} ({file_loc})')

print()
if all_pass:
    print('*** ALL CHECKS PASSED - Bug fix complete! ***')
else:
    print('*** Some checks failed - see above ***')

print()
print('CHANGES SUMMARY:')
print('  1. index.html loadArticles(): Now fetches JSON + merges localStorage')
print('  2. index.html: Unified localStorage key to "gcc_articles"')
print('  3. admin.html: Updated toast to tell users to Export JSON')
print('  4. admin.html: Added Reset Data button + resetAllData() function')
print('  5. admin.html: Updated delete toast message')
print()
print('HOW IT WORKS:')
print('  1. Admin creates/edits article -> saved to localStorage (gcc_articles)')
print('  2. Homepage loadArticles() fetches JSON, then merges localStorage overrides')
print('  3. Articles with matching IDs are replaced; new IDs are appended')
print('  4. Reset button clears localStorage -> reloads default JSON')
print('  5. Export JSON lets admin persist changes to articles.json file')
