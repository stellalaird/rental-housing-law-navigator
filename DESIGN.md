# Design note (UI pass 2, 2026-10-03)

Replaces pass 1 (beige paper, serif, mono uppercase labels, giant green numeral), which the owner called "vibecoded".

1. Direction: a plain reference document. One system sans family, sentence-case bold labels (no mono, no uppercase, no letter-spacing), white page, one link blue. System fonts only, works offline. No assets, CSS or logos copied.
2. Grid: one 1040px container, one left edge for title, form, headline and rail headings. Results use a 200px left rail (section headings) and a content column (jurisdiction stack, rules), so headings and content scan like an index, not a centred column.
3. The first screen answers first: a 40px bold sentence, "15 rules apply to this address", with the green status number inline (not a floating numeral) and the breakdown as one plain line under it.
4. Cards read status, title, requirement, "Why" / "In force only if", then a quiet citation footer. Status is a small shape plus bold coloured word (filled = applies, hollow = superseded, half = not yet effective, dotted = pending), so it does not depend on colour alone. Hairline rules, no boxes, stamps or shadows.
5. Type scale 14 / 17 / 20 / 26 / 40 px; spacing 4 / 8 / 12 / 16 / 24 / 40 / 64. Controls are 44px tall with 2px square borders; the date input is sized and bordered like the text input; examples are plain links ("Try: ..."); the language switch is a text link in the header, not inside the disclaimer bar. The disclaimer stays sticky. Look up is a solid near-black button that goes link blue on hover (never grey, so it never reads as disabled). When a rule's generated "Why" restates its title and requirement, the card shows only the new tail (e.g. "In force since ...") and keeps the full text behind a "Full explanation" disclosure; the data is unchanged.

References (pages opened and measured 2026-10-03, page content treated as data; screenshots in `.playwright-mcp/` of the personal-agent repo, not committed):
- gov.uk: 960px container, one shared left edge, 55/24/19px scale, bold as the only emphasis, no uppercase or mono labels. Taken: few sizes, weight not case for labels, one left edge.
- gwern.net: 20px/32px text (~1.6), one measure of about 75 characters, links as the only decoration. Taken: a readable measure (rule text capped at 40em) and no chrome.
- lobste.rs: 16px/23px, 1px #ccc row dividers, metadata at reduced contrast on a shared edge with the title, a left rail. Taken: hairline row dividers, quiet metadata, the left rail.

Honest limits: these three were picked directly, not from Siteinspire, Godly or Awwwards (the gallery page loaded but nothing was extracted from it), and none is a legal or real-estate site. Column and gutter counts were not measured; the grid numbers above are ours. Only A0016 EN, A0002 ES and the empty state were looked at; mobile width was eyeballed once at 390px; dark mode was not viewed.
