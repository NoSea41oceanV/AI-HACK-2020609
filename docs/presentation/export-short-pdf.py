"""Export the seven visually checked slides as a projection PDF."""
from pathlib import Path
from reportlab.pdfgen import canvas
from pypdf import PdfReader

root = Path(__file__).resolve().parents[2]
output = root.parents[1] / 'output/pawpair-pitch/PAWLAND_発表資料_7枚版_実画面版.pdf'
c = canvas.Canvas(str(output), pagesize=(960, 540))
c.setTitle('PAWLAND - 発表資料 7枚版')
for i in range(1, 8):
    c.drawImage(str(root / f'tmp/pawpair-short/final-{i}.png'), 0, 0, width=960, height=540)
    if i == 3:
        c.linkURL('https://www.yano.co.jp/market_reports/C68103700', (48, 39, 465, 68), relative=0)
        c.linkURL('https://www.env.go.jp/nature/dobutsu/aigo/2_data/statistics/files/r07/2_1_1.pdf', (466, 39, 911, 68), relative=0)
    c.showPage()
c.save()
assert len(PdfReader(output).pages) == 7
print('Created 7-page PDF')
