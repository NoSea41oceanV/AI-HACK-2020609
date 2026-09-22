"""Generate the one-page PAWLAND sales flyer as an A4 PDF."""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageStat
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


def fit_image_contain(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float,
                      radius: float = 0, background=WHITE,
                      source_region: tuple[int, int, int, int] | None = None) -> None:
    """Draw a screenshot region by PDF clipping, preserving the source image and ratio."""
    image = Image.open(path).convert("RGB")
    channel_spread = max(high - low for low, high in ImageStat.Stat(image).extrema)
    if channel_spread < 8:
        raise ValueError(f"Screenshot appears blank or nearly blank: {path}")
    region_x, region_y, region_w, region_h = source_region or (0, 0, image.width, image.height)
    if (region_x < 0 or region_y < 0 or region_w <= 0 or region_h <= 0
            or region_x + region_w > image.width or region_y + region_h > image.height):
        raise ValueError(f"Screenshot region is outside the image: {path} {source_region}")
    image_ratio = region_w / region_h
    frame_ratio = w / h
    if image_ratio > frame_ratio:
        region_draw_w = w
        region_draw_h = w / image_ratio
    else:
        region_draw_h = h
        region_draw_w = h * image_ratio
    scale = region_draw_w / region_w
    region_draw_x = x + (w - region_draw_w) / 2
    region_draw_y = y + (h - region_draw_h) / 2
    draw_x = region_draw_x - region_x * scale
    draw_y = region_draw_y - (image.height - region_y - region_h) * scale
    draw_w = image.width * scale
    draw_h = image.height * scale
    stream = BytesIO()
    image.save(stream, format="PNG", optimize=True)
    stream.seek(0)
    round_rect(c, x, y, w, h, radius, background, LINE)
    c.saveState()
    if radius:
        clip = c.beginPath()
        clip.roundRect(x, y, w, h, radius)
        c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(stream), draw_x, draw_y, width=draw_w, height=draw_h, mask="auto")
    c.restoreState()


def pill(c: canvas.Canvas, x: float, y: float, text: str, fill=WHITE, color=GREEN_DARK,
         width: float | None = None) -> None:
    w = width or (pdfmetrics.stringWidth(text, "JP-Bold", 8.1) + mm(8))
    round_rect(c, x, y, w, mm(8), mm(4), fill)
    c.setFillColor(color)
    c.setFont("JP-Bold", 8.1)
    c.drawCentredString(x + w / 2, y + mm(2.45), text)


def make_flyer(output_path: Path, repo_root: Path, screen_primary: Path,
               screen_secondary: Path | None = None) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not screen_primary.exists():
        raise FileNotFoundError(f"Primary system screenshot not found: {screen_primary}")
    screen_secondary = screen_secondary or screen_primary
    if not screen_secondary.exists():
        raise FileNotFoundError(f"Secondary system screenshot not found: {screen_secondary}")
    font_setup()
    c = canvas.Canvas(str(output_path), pagesize=A4, pageCompression=1)
    c.setTitle("PAWLAND 営業チラシ")
    c.setAuthor("PAWLAND")
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

    draw_text(c, "PAWLAND", margin + mm(10), hero_y + mm(75), 15, WHITE, "JP-Bold")
    pill(c, margin + mm(49), hero_y + mm(70.5), "ペットホテル向け", MINT, GREEN_DARK, mm(36))
    draw_text(c, "部屋割りに悩む時間を、\n犬と向き合う時間へ。",
              margin + mm(10), hero_y + mm(56), 24, WHITE, "JP-Bold", 31)
    draw_text(c, "犬の特徴整理から、全ペアの相性評価、\nその日の部屋割り案までを一つに。",
              margin + mm(10), hero_y + mm(27), 10, HexColor("#DCECE4"), "JP", 15)

    screen_x, screen_y, screen_w, screen_h = margin + mm(111), hero_y + mm(16), mm(63), mm(54)
    fit_image_contain(
        c, screen_secondary, screen_x, screen_y, screen_w, screen_h, mm(4),
        source_region=(348, 230, 1305, 925),
    )
    draw_text(c, "実システムの公開デモ画面（架空データ）",
              screen_x, hero_y + mm(10), 5.6, HexColor("#DCECE4"), "JP")

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
    visual_x, visual_y = margin + mm(6), product_y + mm(12)
    visual_w, visual_h = mm(92), mm(48)
    fit_image_contain(
        c, screen_primary, visual_x, visual_y, visual_w, visual_h, mm(4),
        source_region=(346, 151, 1308, 655),
    )
    draw_text(c, "実システムの公開デモ画面（架空データ）",
              visual_x, product_y + mm(6.2), 5.8, MUTED, "JP")

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
    draw_text(c, "PAWLAND", PAGE_W - margin - mm(24), mm(7.8), 6.5, GREEN_DARK, "JP-Bold")

    c.showPage()
    c.save()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--screen-primary", type=Path, required=True,
                        help="Full screenshot of the live PAWLAND public demo")
    parser.add_argument("--screen-secondary", type=Path,
                        help="Optional second screenshot; defaults to --screen-primary")
    args = parser.parse_args()
    make_flyer(
        args.output.resolve(),
        args.repo_root.resolve(),
        args.screen_primary.resolve(),
        args.screen_secondary.resolve() if args.screen_secondary else None,
    )


if __name__ == "__main__":
    main()
