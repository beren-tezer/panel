# PWA / favicon simgelerini public/icons/app-icon.png'den (kare, kenara kadar dolu) üretir. Yalnızca geliştirme; Pillow gerekir.
#   npm run icons   (python scripts/make-icons.py)
# Kaynak görsel değişince yeniden çalıştırın; üretilen dosyalar küçük olduğu için sayfa ve ana ekran ikonu hızlı yüklenir.
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "icons" / "app-icon.png"
OUT = ROOT / "public" / "icons"

src = Image.open(SRC).convert("RGBA")
w, h = src.size
if w != h:
    side = min(w, h)
    src = src.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))


def save(name, size, rgb=False):
    im = src.resize((size, size), Image.LANCZOS)
    if rgb:  # iOS saydamlığı siyah gösterir: düz zemin
        im = im.convert("RGB")
    im.save(OUT / name, optimize=True)
    print("ok", name)


save("icon-192.png", 192)
save("icon-512.png", 512)
save("icon-maskable-512.png", 512)  # görsel kenara kadar dolu, içerik merkezde: Android maskesi güvenli alanı kesmez
save("apple-touch-icon.png", 180, rgb=True)
save("favicon-32.png", 32)
src.resize((256, 256), Image.LANCZOS).save(ROOT / "public" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("ok favicon.ico")
