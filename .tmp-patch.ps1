$content = Get-Content "d:\Code\CableWeb153\index.html" -Raw -Encoding UTF8

# Find the articles-empty closing and insert "查看全部" button
# The pattern we're looking for:
#   </div>       <- end of articles-empty div
#   </section>   <- end of articles section

$beforePattern = '<div id="articles-empty" class="hidden text-center py-16">'
$afterPattern = '</div>' + "`n</section>" + "`n" + '<footer'

$beforeIdx = $content.IndexOf($beforePattern)
Write-Output "articles-empty found at: $beforeIdx"

# Find the </section> AFTER the articles-empty div
$searchFrom = $beforeIdx + $beforePattern.Length
$sectionEnd = $content.IndexOf("</section>", $searchFrom)
Write-Output "section end at: $sectionEnd"

if ($sectionEnd -gt 0) {
    $before = $content.Substring(0, $sectionEnd)
    $after = $content.Substring($sectionEnd)

    $insert = "`n  <!-- `"查看全部`" CTA Button -->`n  <div id=`"articles-more`" class=`"hidden text-center mt-8`">`n    <a href=`"articles.html`" class=`"inline-flex items-center gap-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl shadow-lg border-2 border-amber-500 transition-all transform hover:scale-[1.03] active:scale-95 text-sm`">`n      មែលទាំងអស់ / 查看文章全部 <i class=`"fa-solid fa-arrow-right text-xs`"></i>`n    </a>`n  </div>`n"

    $newContent = $before + $insert + $after
    Set-Content "d:\Code\CableWeb153\index.html" $newContent -Encoding UTF8
    Write-Output "Done! Inserted CTA button."
} else {
    Write-Output "Error: section end not found"
}
