"""Export the visually checked PAWLAND story pitch as a projection PDF."""
from pathlib import Path

from pypdf import PdfReader
from reportlab.pdfgen import canvas

root = Path(__file__).resolve().parents[2]
output = root.parents[1] / 'output/pawpair-pitch/PAWLAND_発表資料_ストーリー改訂版.pdf'
render_dir = root / 'tmp/pawland-story'

c = canvas.Canvas(str(output), pagesize=(960, 540))
c.setTitle('PAWLAND - 発表資料 ストーリー改訂版')
for page_number in range(1, 8):
    c.drawImage(str(render_dir / f'story-final-{page_number}.png'), 0, 0, width=960, height=540)
    if page_number == 4:
        c.linkURL('https://www.yano.co.jp/press-release/show/press_id/4169', (480, 29, 620, 70), relative=0)
        c.linkURL('https://www.env.go.jp/nature/dobutsu/aigo/2_data/statistics/files/r07/2_1_1.pdf', (621, 29, 760, 70), relative=0)
        c.linkURL('https://www.anicom-sompo.co.jp/news-release/2025/20260311/', (761, 29, 920, 70), relative=0)
    c.showPage()
c.save()

reader = PdfReader(output)
assert len(reader.pages) == 7
assert all(abs(float(page.mediabox.width) - 960) < 0.01 for page in reader.pages)
assert all(abs(float(page.mediabox.height) - 540) < 0.01 for page in reader.pages)
print(f'Created {output} ({len(reader.pages)} pages)')
