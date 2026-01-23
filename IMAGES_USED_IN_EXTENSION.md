# Images Used in Extension

**Date**: 2026-01-22  
**Status**: Complete inventory of all images

---

## 📦 Built Images (Copied to `build/` folder)

These are the images that are actually used in the extension after webpack processing:

### 1. **`raicon.png`** (Source: `src/assets/img/xrepl256mute.png`)
- **Manifest**: Default icon for extension action button
- **Manifest**: Icon for extension (128x128)
- **Webpack**: Copied from `xrepl256mute.png` → `raicon.png`
- **Usage**: Extension icon displayed in Chrome toolbar

### 2. **`xrepl-light.png`** (Source: `src/assets/img/xrepl256light.png`)
- **Options Page**: Header logo (`Options.tsx` line 96)
- **Content Script**: Streaming indicator icon (line 4129)
- **Content Script**: Overlay icon (line 4707)
- **Popup**: Header logo (`Popup.jsx` line 36)
- **Webpack**: Copied from `xrepl256light.png` → `xrepl-light.png`
- **Usage**: Light theme logo/icon

### 3. **`xrepl-dark.png`** (Source: `src/assets/img/xrepl256blue.png`)
- **Content Script**: Dark theme icon for Gmail compose (line 2667)
- **Webpack**: Copied from `xrepl256blue.png` → `xrepl-dark.png`
- **Usage**: Dark theme logo/icon

### 4. **`raiconvector.png`** (Source: `src/assets/img/RAIcon_outline.png`)
- **Content Script**: LinkedIn comments icon (line 2525)
- **Content Script**: Loading indicator (line 5142)
- **Content Script**: Multiple LinkedIn-related icons (lines 5215, 5246)
- **Webpack**: Copied from `RAIcon_outline.png` → `raiconvector.png`
- **Usage**: Vector-style icon for LinkedIn integration

### 5. **`icon-128.png`** (Source: `src/assets/img/icon-128.png`)
- **Content Script**: Notification icons (lines 2882, 3242, 5149)
- **Webpack**: Direct copy
- **Usage**: Large icon for notifications and dialogs

### 6. **`icon-34.png`** (Source: `src/assets/img/icon-34.png`)
- **Webpack**: Direct copy
- **Usage**: Small icon (likely for devtools, though devtools was removed)

---

## 📋 Manifest Configuration

All built images are declared in `manifest.json`:

```json
"web_accessible_resources": [
  "icon-128.png",
  "icon-34.png",
  "xrepl-dark.png",
  "raiconvector.png",
  "xrepl-light.png",
  "raicon.png"
]
```

---

## 🗂️ Source Images (in `src/assets/img/`)

### ✅ **USED Source Images** (Copied to build):
1. `icon-128.png` → `icon-128.png`
2. `icon-34.png` → `icon-34.png`
3. `xrepl256mute.png` → `raicon.png`
4. `xrepl256blue.png` → `xrepl-dark.png`
5. `xrepl256light.png` → `xrepl-light.png`
6. `RAIcon_outline.png` → `raiconvector.png`

### ❌ **UNUSED Source Images** (Not copied to build):
1. `logo.svg` - Previously used in Newtab (removed)
2. `ra-glow-128-border.png`
3. `ra-glow-128-dark-border.png`
4. `ra-glow-128.png`
5. `ra-glow-256-border.png`
6. `ra-glow-256-dark-border.png`
7. `ra-glow-256.png`
8. `ra-glow-64-border.png`
9. `ra-glow-64.png`
10. `ra-glow-large-dark-border.png`
11. `RAIcon_outline_star.png`
12. `RAIcon.png`
13. `RAIcon2.png`
14. `RAIcon20x20-ovr.png`
15. `RAIcon20x20.png`
16. `RAIcon20x20bl.png`
17. `RAIcon20x20or.png`
18. `RAIcon20x20ors1.png`
19. `RAIcon20x20ors1l.png`
20. `RAIcon20x20ors1l2.png`
21. `RAIcon20x20ors2.png`
22. `xrepl.png`
23. `xrepl256.png`
24. `xrepl256green.png`

---

## 📍 Usage by Component

### **Options Page** (`Options.tsx`)
- `xrepl-light.png` - Header logo (line 96)

### **Content Script** (`Content/index.jsx`)
- `raiconvector.png` - LinkedIn comments (line 2525)
- `xrepl-dark.png` - Gmail compose dark theme (line 2667)
- `icon-128.png` - Notifications (lines 2882, 3242, 5149)
- `xrepl-light.png` - Streaming indicator (line 4129)
- `xrepl-light.png` - Overlay icon (line 4707)
- `raiconvector.png` - Loading indicators (lines 5142, 5215, 5246)

### **Popup** (`Popup.jsx`)
- `xrepl-light.png` - Header logo (line 36)

### **Manifest** (`manifest.json`)
- `raicon.png` - Default action icon (line 11)
- `raicon.png` - Extension icon 128x128 (line 14)

---

## 🔍 Image Loading Method

All images are loaded using `chrome.runtime.getURL()`:
```javascript
const iconUrl = chrome.runtime.getURL('xrepl-light.png');
```

This ensures images are loaded from the extension's build directory.

---

## 📊 Summary

- **Total Built Images**: 6
- **Total Source Images**: 30
- **Unused Source Images**: 24
- **Images in Manifest**: 6

---

## 🧹 Cleanup Recommendation

The following source images can be safely deleted as they are not used:
- All `ra-glow-*` variants (9 files)
- All `RAIcon20x20*` variants (8 files)
- `RAIcon.png`, `RAIcon2.png`, `RAIcon_outline_star.png` (3 files)
- `xrepl.png`, `xrepl256.png`, `xrepl256green.png` (3 files)
- `logo.svg` (1 file - was used in removed Newtab page)

**Total cleanup potential**: ~24 unused image files

---

**Last Updated**: 2026-01-22
