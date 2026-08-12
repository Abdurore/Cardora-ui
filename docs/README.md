# docs/

## `cardora-status.md`

Comprehensive read-only audit of the Cardora UI codebase: routes, auth,
roles, currency, studio/QC flows, recipient view, anonymous inbox,
explore, chat, admin/moderator/enterprise dashboards, store, profile,
theming, API surface, recent fixes, deployment, and a QA checklist.

### Rendering to PDF

Any markdown → PDF path works. Fastest options:

**VS Code**: install "Markdown PDF" extension → right-click the file →
"Markdown PDF: Export (pdf)".

**Pandoc** (if installed):

```bash
pandoc docs/cardora-status.md -o cardora-status.pdf \
  --pdf-engine=weasyprint -V geometry:margin=20mm
```

**Python (weasyprint)**:

```bash
pip install --user markdown weasyprint
python3 -c "
import markdown, weasyprint, pathlib
md = pathlib.Path('docs/cardora-status.md').read_text()
html = markdown.markdown(md, extensions=['tables','fenced_code','sane_lists'])
weasyprint.HTML(string=f'<html><body>{html}</body></html>').write_pdf('cardora-status.pdf')
"
```

**Online**: paste the .md into any markdown-to-PDF converter
(dillinger.io, markdowntopdf.com, etc.).
