from PIL import Image
import os

src = 'كار مصر_ انطلق نحو السرعة.png'
im = Image.open(src).convert('RGB')
w, h = im.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
sq = im.crop((left, top, left + side, top + side))

base = 'public'
os.makedirs(base, exist_ok=True)
os.makedirs('store-assets', exist_ok=True)

# full logo (square)
sq.save(os.path.join(base, 'carmasr-logo.png'), 'PNG')

for size, name in [(32, 'favicon-32.png'), (128, 'app-icon-128.png'), (192, 'icon-192.png'), (512, 'app-icon-512.png'), (512, 'favicon-512.png'), (1024, 'app-icon-1024.png')]:
    sq.resize((size, size), Image.LANCZOS).save(os.path.join(base, name), 'PNG')

sq.resize((512, 512), Image.LANCZOS).save('store-assets/icon-512x512.png', 'PNG')
# tareeq-logo fallback
sq.resize((64, 64), Image.LANCZOS).save(os.path.join(base, 'tareeq-logo.png'), 'PNG')

print('done', sq.size)
print('files:', [f for f in os.listdir(base) if 'icon' in f or 'favicon' in f or 'logo' in f])
