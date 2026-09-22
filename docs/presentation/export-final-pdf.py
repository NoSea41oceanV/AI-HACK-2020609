"""Export the visually checked PAWLAND final pitch as a projection PDF."""
from pathlib import Path

from pypdf import PdfReader
from reportlab.pdfgen import canvas

root = Path(__file__).resolve().parents[2]
output = root.parents[1] / 'output/pawpair-pitch/PAWLAND_発表資料_画面紹介改訂版.pdf'
render_dir = root / 'tmp/pawland-features'

c = canvas.Canvas(str(output), pagesize=(960, 540))
c.setTitle('PAWLAND - 発表資料 画面紹介改訂版')
for page_number in range(1, 17):
    c.drawImage(str(render_dir / f'final-{page_number}.png'), 0, 0, width=960, height=540)
    if page_number == 6:
        c.linkURL('https://www.yano.co.jp/press-release/show/press_id/4169', (480, 312, 920, 405), relative=0)
        c.linkURL('https://www.env.go.jp/nature/dobutsu/aigo/2_data/statistics/files/r07/2_1_1.pdf', (480, 90, 920, 198), relative=0)
        c.linkURL('https://www.anicom-sompo.co.jp/news-release/2025/20260311/', (480, 220, 920, 300), relative=0)
    c.showPage()
c.save()

reader = PdfReader(output)
assert len(reader.pages) == 16
assert all(abs(float(page.mediabox.width) - 960) < 0.01 for page in reader.pages)
assert all(abs(float(page.mediabox.height) - 540) < 0.01 for page in reader.pages)
print(f'Created {output} ({len(reader.pages)} pages)')
