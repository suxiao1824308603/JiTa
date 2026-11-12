"""生成插件图标：靛蓝渐变圆角方块 + 白色「简」字。"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
SIZE = 512
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # 对角渐变：#4f6bff -> #7c5cff
    y, x = np.mgrid[0:SIZE, 0:SIZE]
    t = (x + y) / (2 * (SIZE - 1))
    start = np.array([79, 107, 255], dtype=float)
    end = np.array([124, 92, 255], dtype=float)
    rgb = start + (end - start) * t[..., None]
    img = Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")

    # 圆角遮罩
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=112, fill=255)
    img.putalpha(mask)

    # 顶部高光
    gloss = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(gloss).ellipse((-140, -360, SIZE + 140, 210), fill=(255, 255, 255, 26))
    gloss.putalpha(Image.composite(gloss.getchannel("A"), Image.new("L", (SIZE, SIZE), 0), mask))
    img.alpha_composite(gloss)

    draw = ImageDraw.Draw(img)
    glyph = "简"
    f = font(300)
    box = draw.textbbox((0, 0), glyph, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text(((SIZE - w) / 2 - box[0], (SIZE - h) / 2 - box[1] - 12), glyph, font=f, fill="#ffffff")

    for size in (16, 32, 48, 128):
        img.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png")

    print("icons written to", OUT)


if __name__ == "__main__":
    main()
