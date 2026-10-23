"""Generate a synthetic tomato leaf image with disease spots to test the vision pipeline."""
from PIL import Image, ImageDraw, ImageFilter
import random

random.seed(7)
W, H = 900, 700
img = Image.new("RGB", (W, H), (214, 232, 198))
d = ImageDraw.Draw(img)

# soft background gradient
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(214 - 30 * t), int(232 - 25 * t), int(198 - 20 * t)))

# draw a leaf shape (ellipse rotated look with stem)
leaf = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ld = ImageDraw.Draw(leaf)
ld.ellipse([150, 120, 760, 600], fill=(46, 122, 50, 255), outline=(30, 90, 34, 255), width=6)
# central vein
ld.line([(180, 360), (740, 360)], fill=(28, 84, 32, 255), width=7)
for x in range(230, 700, 55):
    ld.line([(x, 360), (x + 40, 250)], fill=(30, 90, 34, 220), width=4)
    ld.line([(x, 360), (x + 40, 470)], fill=(30, 90, 34, 220), width=4)
leaf = leaf.rotate(-8, resample=Image.BICUBIC, center=(450, 360))
img.paste(leaf, (0, 0), leaf)
d = ImageDraw.Draw(img)

# disease lesions: brown rings with yellow halos
for _ in range(14):
    cx, cy = random.randint(230, 700), random.randint(180, 540)
    r = random.randint(14, 34)
    d.ellipse([cx - r - 10, cy - r - 10, cx + r + 10, cy + r + 10], fill=(196, 178, 80))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(94, 56, 30))
    d.ellipse([cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2], fill=(58, 34, 18))

img = img.filter(ImageFilter.GaussianBlur(0.6))
img.save("/home/z/my-project/scripts/test-leaf.jpg", quality=88)
print("saved", img.size)
