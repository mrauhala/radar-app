# PWA Icons Guide

This radar application requires icon files for full PWA functionality. Create an `icons/` directory and generate the following icon files:

## Required Icon Sizes

### App Icons (PNG format)
- `icon-72.png` (72×72px) - Android launcher icon
- `icon-96.png` (96×96px) - Android launcher icon
- `icon-128.png` (128×128px) - Chrome Web Store
- `icon-144.png` (144×144px) - Android launcher icon
- `icon-152.png` (152×152px) - iOS home screen
- `icon-192.png` (192×192px) - Android launcher icon (standard)
- `icon-384.png` (384×384px) - Android launcher icon
- `icon-512.png` (512×512px) - Android launcher icon (high-res)

### Maskable Icons (PNG format)
- `icon-192-maskable.png` (192×192px) - Android adaptive icon
- `icon-512-maskable.png` (512×512px) - Android adaptive icon

### Apple-specific Icons
- `apple-touch-icon.png` (180×180px) - iOS home screen icon
- `safari-pinned-tab.svg` - Safari pinned tab icon (SVG format)

### Standard Web Icons
- `favicon.ico` - Browser tab icon
- `favicon-16x16.png` (16×16px) - Browser tab icon
- `favicon-32x32.png` (32×32px) - Browser tab icon

### Microsoft Tiles
- `mstile-70x70.png` (70×70px) - Windows Start menu tile
- `mstile-150x150.png` (150×150px) - Windows Start menu tile
- `mstile-310x150.png` (310×150px) - Windows Start menu wide tile
- `mstile-310x310.png` (310×310px) - Windows Start menu large tile

### Shortcut Icons (optional)
- `shortcut-finland.png` (96×96px) - App shortcut for Finland
- `shortcut-ethiopia.png` (96×96px) - App shortcut for Ethiopia
- `shortcut-vietnam.png` (96×96px) - App shortcut for Vietnam
- `shortcut-georgia.png` (96×96px) - App shortcut for Georgia

### Action Icons (for notifications)
- `action-explore.png` (24×24px) - Notification action icon
- `action-close.png` (24×24px) - Notification action icon

## Icon Design Guidelines

1. **Theme**: Weather radar/meteorology theme with dark background (#000000)
2. **Style**: Modern, minimal design that works well at small sizes
3. **Colors**: Use blue (#00aaff) as accent color matching the app's progress bar
4. **Content**: Consider using radar sweep, weather symbols, or globe icons
5. **Maskable**: For maskable icons, ensure important content is within the safe zone (center 80% of the image)

## Quick Generation Commands

You can use tools like ImageMagick to generate multiple sizes from a master icon:

```bash
# Create icons directory
mkdir icons

# Generate standard sizes from a master 512x512 icon
convert master-icon.png -resize 72x72 icons/icon-72.png
convert master-icon.png -resize 96x96 icons/icon-96.png
convert master-icon.png -resize 128x128 icons/icon-128.png
convert master-icon.png -resize 144x144 icons/icon-144.png
convert master-icon.png -resize 152x152 icons/icon-152.png
convert master-icon.png -resize 192x192 icons/icon-192.png
convert master-icon.png -resize 384x384 icons/icon-384.png
convert master-icon.png -resize 512x512 icons/icon-512.png

# Apple touch icon
convert master-icon.png -resize 180x180 icons/apple-touch-icon.png

# Favicons
convert master-icon.png -resize 32x32 icons/favicon-32x32.png
convert master-icon.png -resize 16x16 icons/favicon-16x16.png
```

## Online Icon Generators

You can also use online tools like:
- [Favicon Generator](https://realfavicongenerator.net/)
- [PWA Icon Generator](https://www.pwabuilder.com/imageGenerator)
- [App Icon Generator](https://appicon.co/)

Once you have the icons, place them in the `icons/` directory and your PWA will be fully functional!
