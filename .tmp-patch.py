with open(r'd:\Code\CableWeb153\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update comment
content = content.replace(
    '// ---- Render article cards ----
function renderArticles() {',
    '// ---- Render article cards (homepage: limit to 10) ----
function renderArticles() {'
)

# 2. Find the articles-empty closing section and insert button
# We use a triple-string approach via exact byte match
old_section = '    <p class="text-slate-500 text-sm">该分类下暂无文章或搜索无结果</p>\n  </div>\n</section>'

new_section = '''    <p class="text-slate-500 text-sm">该分类下暂无文章或搜索无结果</p>
  </div>

  <!-- 查看全部 CTA Button -->
  <div id="articles-more" class="hidden text-center mt-8">
    <a href="articles.html" class="inline-flex items-center gap-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl shadow-lg border-2 border-amber-500 transition-all transform hover:scale-[1.03] active:scale-95 text-sm">
      មែលទាំងអស់ / 查看文章全部 <i class="fa-solid fa-arrow-right text-xs"></i>
    </a>
  </div>
</div>

</section>'''

if old_section in content:
    content = content.replace(old_section, new_section, 1)
    print('CTA button inserted successfully.')
else:
    print('ERROR: Could not find target section.')

with open(r'd:\Code\CableWeb153\index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('File written.')
