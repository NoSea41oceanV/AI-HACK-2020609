"""Generate the one-page PawPals sales flyer as an A4 PDF."""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


MM = 72 / 25.4
PAGE_W, PAGE_H = A4

INK = HexColor("#142826")
GREEN = HexColor("#287052")
GREEN_DARK = HexColor("#174E3A")
MINT = HexColor("#E8F4ED")
MINT_LIGHT = HexColor("#F4F9F6")
CORAL = HexColor("#E96F56")
CORAL_LIGHT = HexColor("#FFF0EA")
GOLD = HexColor("#F2C45A")
PAPER = HexColor("#FBFAF6")
WHITE = HexColor("#FFFFFF")
MUTED = HexColor("#57706B")
LINE = HexColor("#D7E3DD")


def mm(value: float) -> float:
    return value * MM


def font_setup() -> None:
    fonts = Path("C:/Windows/Fonts")
    regular = fonts / "BIZ-UDGothicR.ttc"
    bold = fonts / "BIZ-UDGothicB.ttc"
    if not regular.exists() or not bold.exists():
        regular = fonts / "meiryo.ttc"
        bold = fonts / "meiryob.ttc"
    pdfmetrics.registerFont(TTFont("JP", str(regular), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("JP-Bold", str(bold), subfontIndex=0))


def round_rect(c: canvas.Canvas, x: float, y: float, w: float, h: float, radius: float,
               fill, stroke=None, width: float = 0.7) -> None:
    c.setLineWidth(width)
    c.setFillColor(fill)
    if stroke is None:
        c.setStrokeColor(fill)
    else:
        c.setStrokeColor(stroke)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def draw_text(c: canvas.Canvas, text: str, x: float, y: float, size: float,
              color=INK, font: str = "JP", leading: float | None = None) -> float:
    c.setFillColor(color)
    c.setFont(font, size)
    if "\n" not in text:
        c.drawString(x, y, text)
        return y
    lead = leading or size * 1.35
    cursor = y
    for line in text.split("\n"):
        c.drawString(x, cursor, line)
        cursor -= lead
    return cursor


def fit_image_cover(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float,
                    radius: float = 0) -> None:
    image = Image.open(path).convert("RGB")
    target_ratio = w / h
    image_ratio = image.width / image.height
    if image_ratio > target_ratio:
        crop_w = int(image.height * target_ratio)
        left = (image.width - crop_w) // 2
        image = image.crop((left, 0, left + crop_w, image.height))
    else:
        crop_h = int(image.width / target_ratio)
        top = (image.height - crop_h) // 2
        image = image.crop((0, top, image.width, top + crop_h))
    stream = BytesIO()
    image.save(stream, format="JPEG", quality=94, optimize=True)
    stream.seek(0)
    c.saveState()
    if radius:
        clip = c.beginPath()
        clip.roundRect(x, y, w, h, radius)
        c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(stream), x, y, width=w, height=h, mask="auto")
    c.restoreState()


def pill(c: canvas.Canvas, x: float, y: float, text: str, fill=WHITE, color=GREEN_DARK,
         width: float | None = None) -> None:
    w = width or (pdfmetrics.stringWidth(text, "JP-Bold", 8.1) + mm(8))
    round_rect(c, x, y, w, mm(8), mm(4), fill)
    c.setFillColor(color)
    c.setFont("JP-Bold", 8.1)
    c.drawCentredString(x + w / 2, y + mm(2.45), text)


def make_flyer(output_path: Path, repo_root: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    font_setup()
    c = canvas.Canvas(str(output_path), pagesize=A4, pageCompression=1)
    c.setTitle("PawPals 営業チラシ")
    c.setAuthor("PawPals")
    c.setSubject("ペットホテル向け AI 部屋割り支援")

    # Base and top accent
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(GREEN_DARK)
    c.rect(0, PAGE_H - mm(4), PAGE_W, mm(4), fill=1, stroke=0)

    margin = mm(13)
    inner_w = PAGE_W - margin * 2

    # Hero
    hero_y, hero_h = PAGE_H - mm(96), mm(86)
    round_rect(c, margin, hero_y, inner_w, hero_h, mm(6), GREEN_DARK)
    c.setFillColor(HexColor("#3F8666"))
    c.circle(margin + mm(8), hero_y + mm(10), mm(14), fill=1, stroke=0)
    c.setFillColor(HexColor("#26654B"))
    c.circle(margin + mm(81), hero_y + mm(81), mm(30), fill=1, stroke=0)

    draw_text(c, "PawPals", margin + mm(10), hero_y + mm(75), 15, WHITE, "JP-Bold")
    pill(c, margin + mm(49), hero_y + mm(70.5), "ペットホテル向け", MINT, GREEN_DARK, mm(36))
    draw_text(c, "部屋割りに悩む時間を、\n犬と向き合う時間へ。",
              margin + mm(10), hero_y + mm(56), 24, WHITE, "JP-Bold", 31)
    draw_text(c, "犬の特徴整理から、全ペアの相性評価、\nその日の部屋割り案までを一つに。",
              margin + mm(10), hero_y + mm(27), 10, HexColor("#DCECE4"), "JP", 15)

    photo_x, photo_y, photo_w, photo_h = margin + mm(117), hero_y + mm(8), mm(57), mm(70)
    fit_image_cover(c, repo_root / "public" / "sample-dog.png", photo_x, photo_y, photo_w, photo_h, mm(5))
    round_rect(c, photo_x + mm(4), photo_y + mm(4), mm(45), mm(10), mm(5), HexColor("#FFFFFFE8"))
    draw_text(c, "判断の準備を、AIと。", photo_x + mm(8), photo_y + mm(7.2), 8.4, GREEN_DARK, "JP-Bold")

    # Pain points
    title_y = hero_y - mm(10)
    draw_text(c, "こんな毎日、ありませんか？", margin, title_y, 14, INK, "JP-Bold")
    problems = [
        ("01", "情報がばらばら", "性格や注意点が、紙・台帳・\nスタッフの記憶に分かれる"),
        ("02", "全組み合わせが大変", "犬が増えるほど、すべての\n相性を比べにくい"),
        ("03", "変化のたび再検討", "当日の様子が変わると、\n部屋割りを考え直す"),
    ]
    gap = mm(4)
    card_w = (inner_w - gap * 2) / 3
    card_y, card_h = title_y - mm(35), mm(29)
    for i, (number, headline, body) in enumerate(problems):
        x = margin + i * (card_w + gap)
        round_rect(c, x, card_y, card_w, card_h, mm(4), WHITE, LINE)
        round_rect(c, x + mm(4), card_y + mm(17), mm(10), mm(8), mm(4), CORAL_LIGHT)
        draw_text(c, number, x + mm(6.6), card_y + mm(19.3), 7.4, CORAL, "JP-Bold")
        draw_text(c, headline, x + mm(17), card_y + mm(19.2), 9.2, INK, "JP-Bold")
        draw_text(c, body, x + mm(5), card_y + mm(11.3), 7.3, MUTED, "JP", 10.2)

    # Product story
    product_y, product_h = card_y - mm(76), mm(69)
    round_rect(c, margin, product_y, inner_w, product_h, mm(5), MINT_LIGHT, LINE)
    visual_x, visual_y = margin + mm(6), product_y + mm(6)
    visual_w, visual_h = mm(92), mm(56)
    round_rect(c, visual_x, visual_y, visual_w, visual_h, mm(4), WHITE, LINE)
    draw_text(c, "1頭ずつの情報から、\n部屋全体の組み合わせへ。",
              visual_x + mm(7), visual_y + mm(43), 13, GREEN_DARK, "JP-Bold", 18)
    portraits = [
        repo_root / "public" / "breed-shiba.png",
        repo_root / "public" / "breed-toy-poodle.png",
        repo_root / "public" / "breed-golden-retriever.png",
    ]
    for index, portrait in enumerate(portraits):
        px = visual_x + mm(7 + index * 21)
        py = visual_y + mm(9)
        fit_image_cover(c, portrait, px, py, mm(18), mm(18), mm(9))
        c.setStrokeColor(WHITE)
        c.setLineWidth(2)
        c.circle(px + mm(9), py + mm(9), mm(9), fill=0, stroke=1)
    c.setFillColor(GREEN)
    c.setLineWidth(1.4)
    c.line(visual_x + mm(68), visual_y + mm(18), visual_x + mm(78), visual_y + mm(18))
    c.line(visual_x + mm(75), visual_y + mm(21), visual_x + mm(78), visual_y + mm(18))
    c.line(visual_x + mm(75), visual_y + mm(15), visual_x + mm(78), visual_y + mm(18))
    round_rect(c, visual_x + mm(79), visual_y + mm(8), mm(8), mm(20), mm(2), MINT)
    draw_text(c, "部\n屋", visual_x + mm(81.3), visual_y + mm(20.5), 7.2, GREEN_DARK, "JP-Bold", 11)

    flow_x = margin + mm(105)
    draw_text(c, "情報から判断案まで、一本につなぐ", flow_x, product_y + mm(58), 11.3, GREEN_DARK, "JP-Bold")
    steps = [
        ("1", "集める", "回答・写真・動画由来の静止画から\nAIが特徴を共通項目で整理"),
        ("2", "比べる", "全ペアを評価。安全制約と\n部屋の定員も確認"),
        ("3", "決める", "観測から再計算。理由を見て\n最後はスタッフが確定"),
    ]
    sy = product_y + mm(44)
    for number, head, body in steps:
        c.setFillColor(GREEN)
        c.circle(flow_x + mm(4), sy + mm(2), mm(4), fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("JP-Bold", 8)
        c.drawCentredString(flow_x + mm(4), sy + mm(0.3), number)
        draw_text(c, head, flow_x + mm(11), sy + mm(2.2), 9.3, INK, "JP-Bold")
        draw_text(c, body, flow_x + mm(30), sy + mm(3), 7.3, MUTED, "JP", 9.8)
        sy -= mm(16)
    round_rect(c, flow_x, product_y + mm(2), mm(68), mm(8), mm(3), CORAL_LIGHT)
    draw_text(c, "AIは補助。最終判断は施設スタッフが行います。",
              flow_x + mm(4), product_y + mm(4.8), 5.9, HexColor("#984735"), "JP-Bold")

    # Price and CTA
    footer_y, footer_h = mm(15), product_y - mm(22)
    left_w = mm(110)
    round_rect(c, margin, footer_y, left_w, footer_h, mm(5), WHITE, LINE)
    draw_text(c, "導入しやすい施設単位の料金案", margin + mm(7), footer_y + footer_h - mm(9), 11, INK, "JP-Bold")
    draw_text(c, "月額", margin + mm(7), footer_y + footer_h - mm(21), 8, MUTED, "JP-Bold")
    draw_text(c, "10,000", margin + mm(22), footer_y + footer_h - mm(23), 22, GREEN_DARK, "JP-Bold")
    draw_text(c, "円 / 施設（税別）", margin + mm(61), footer_y + footer_h - mm(21.5), 8, INK, "JP-Bold")
    c.setStrokeColor(LINE)
    c.line(margin + mm(7), footer_y + mm(16), margin + left_w - mm(7), footer_y + mm(16))
    draw_text(c, "初期導入料 30,000円 / 施設（税別）", margin + mm(7), footer_y + mm(10), 8, INK, "JP-Bold")
    draw_text(c, "月200件までのAI解析を想定｜導入条件は個別にご相談", margin + mm(7), footer_y + mm(4.8), 6.9, MUTED)

    cta_x = margin + left_w + mm(5)
    cta_w = inner_w - left_w - mm(5)
    round_rect(c, cta_x, footer_y, cta_w, footer_h, mm(5), GREEN)
    draw_text(c, "まずは、いまの", cta_x + mm(7), footer_y + footer_h - mm(10), 8.8, WHITE, "JP-Bold")
    draw_text(c, "部屋割りの進め方を", cta_x + mm(7), footer_y + footer_h - mm(19), 12.2, WHITE, "JP-Bold")
    draw_text(c, "お聞かせください。", cta_x + mm(7), footer_y + footer_h - mm(29), 12.2, WHITE, "JP-Bold")
    round_rect(c, cta_x + mm(6), footer_y + mm(6), cta_w - mm(12), mm(11), mm(5.5), WHITE)
    draw_text(c, "導入のご相談は\n資料をお渡しした担当者へ",
              cta_x + mm(11), footer_y + mm(12.5), 7, GREEN_DARK, "JP-Bold", 9)

    draw_text(c, "提供内容・料金は計画段階です。正式な提供条件は導入前にご案内します。",
              margin, mm(7.8), 5.8, MUTED)
    draw_text(c, "PawPals", PAGE_W - margin - mm(22), mm(7.8), 6.5, GREEN_DARK, "JP-Bold")

    c.showPage()
    c.save()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    make_flyer(args.output.resolve(), args.repo_root.resolve())


if __name__ == "__main__":
    main()
