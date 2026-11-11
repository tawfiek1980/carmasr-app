from PIL import Image
import os

src = 'شعار كار مصر الديناميكي.png'
im = Image.open(src).convert('RGB')
w, h = im.size
# square center crop
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
sq = im.crop((left, top, left + side, top + side))

# outputs
base = 'public'
os.makedirs(base, exist_ok=True)
os.makedirs('store-assets', exist_ok=True)

# full logo (keep aspect)
im.save(os.path.join(base, 'carmasr-logo.png'), 'PNG')

# square icons
for size, name in [(32, 'favicon-32.png'), (128, 'app-icon-128.png'), (192, 'icon-192.png'), (512, 'app-icon-512.png'), (512, 'favicon-512.png')]:
    sq.resize((size, size), Image.LANCZOS).save(os.path.join(base, name), 'PNG')

sq.resize((512, 512), Image.LANCZOS).save('store-assets/icon-512x512.png', 'PNG')

# also replace tareeq-logo.png reference by copying
sq.resize((64, 64), Image.LANCZOS).save(os.path.join(base, 'tareeq-logo.png'), 'PNG')

print('done')
print('files:', [f for f in os.listdir(base) if 'icon' in f or 'favicon' in f or 'logo' in f])
