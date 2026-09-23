#!/usr/bin/env python3
# Writes every app-icon size the stores and the native projects need, from the one master picture
# `store/art/icon-source.png` (1024x1024, opaque, full-bleed - no rounded corners baked in, the OS adds its own mask).
# The splash screens are unaffected: they are still drawn in code by make-icons.mjs.
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'store/art/icon-source.png')
BG = (11, 93, 138)  # the app's brand blue (matches capacitor.config.ts / adaptive icon background)


def p(rel):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def square(size):
    """The master picture resized to `size`, opaque, no alpha."""
    return master.resize((size, size), Image.LANCZOS).convert('RGB')


def circle(size):
    """The master picture cropped to a circle, transparent outside it (for ic_launcher_round.png)."""
    im = square(size).convert('RGBA')
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
    im.putalpha(mask)
    return im


def foreground(size):
    """Adaptive icon foreground: the picture on the brand-blue background, sized so its centre (the surfer and the title) sits
    inside the 66% "safe zone" every launcher mask shows, and a little more of the edges may or may not survive a given mask."""
    im = Image.new('RGBA', (size, size), BG + (255,))
    inner = round(size * 0.82)
    pic = square(inner).convert('RGBA')
    off = (size - inner) // 2
    im.alpha_composite(pic, (off, off))
    return im


master = Image.open(SRC).convert('RGB')
assert master.size == (1024, 1024), f'expected a 1024x1024 source, got {master.size}'

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
res = 'android/app/src/main/res'
for d, k in dens.items():
    legacy = round(48 * k)
    fg = round(108 * k)
    square(legacy).save(p(f'{res}/mipmap-{d}/ic_launcher.png'))
    circle(legacy).save(p(f'{res}/mipmap-{d}/ic_launcher_round.png'))
    foreground(fg).save(p(f'{res}/mipmap-{d}/ic_launcher_foreground.png'))

square(1024).save(p('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'))
square(512).save(p('public/icon-512.png'))
square(192).save(p('public/icon-192.png'))
square(180).save(p('public/apple-touch-icon.png'))
square(1024).save(p('store/icon-1024.png'))

print('app icon written at every size, from store/art/icon-source.png')
