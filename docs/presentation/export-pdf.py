"""Create a projection PDF from visually checked final slide renders."""
from pathlib import Path
from reportlab.pdfgen import canvas
from pypdf import PdfReader

root = Path.cwd()
output = root / 'output/pawpair-pitch/PAWPAIR_発表資料.pdf'
c = canvas.Canvas(str(output), pagesize=(960, 540))
c.setTitle('PAWPAIR - AI HACK 2026 発表資料')
for number in range(1, 14):
    image = root / f'tmp/pawpair-pitch/final-{number:02}.png'
    if not image.exists():
        raise FileNotFoundError(image)
    c.drawImage(str(image), 0, 0, width=960, height=540)
    if number == 6:
        c.linkURL('https://www.yano.co.jp/market_reports/C68103700', (48, 72, 465, 99), relative=0)
        c.linkURL('https://www.env.go.jp/nature/dobutsu/aigo/2_data/statistics/files/r07/2_1_1.pdf', (466, 72, 911, 99), relative=0)
    c.showPage()
c.save()
assert len(PdfReader(output).pages) == 13
print('PDF created: 13 pages, 16:9')
