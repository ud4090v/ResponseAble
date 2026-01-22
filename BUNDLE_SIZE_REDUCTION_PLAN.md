# Bundle Size Reduction Plan

**Date**: 2026-01-22  
**Goal**: Reduce extension bundle size by removing unused files and optimizing assets

---

## 📊 Analysis Results

### 1. Images - What's Actually Used

#### ✅ **USED Images** (Keep):
- `icon-128.png` - Used in Content, Greetings, Devtools
- `icon-34.png` - Used in Devtools, manifest
- `xrepl-light.png` - Used in Options, Content, Popup
- `xrepl-dark.png` - Used in Content
- `raiconvector.png` (RAIcon_outline.png) - Used in Content (LinkedIn comments)
- `raicon.png` (xrepl256mute.png) - Used in manifest (default icon)
- `logo.svg` - Used in Newtab

#### ❌ **UNUSED Images** (Can Delete):
- `raicon-dark-border.png` - **NOT USED ANYWHERE** (duplicate copy of xrepl256light.png)
- All other images in `src/assets/img/` that aren't referenced

#### 🔍 **Source Images** (Check if needed):
- `xrepl256light.png` - Source for `xrepl-light.png` and `raicon-dark-border.png` (unused)
- `xrepl256mute.png` - Source for `raicon.png` ✓
- `xrepl256blue.png` - Source for `xrepl-dark.png` ✓
- `RAIcon_outline.png` - Source for `raiconvector.png` ✓

**Action**: Remove `raicon-dark-border.png` from webpack copy, delete unused source images

---

### 2. JSON Config Files - Still Needed?

#### Current Usage:
- **Content Script** (`index.jsx`): Imports `packages.json` and `subscriptionPlans.json`
- **Options Page** (`Options.tsx`): Imports `packages.json` and `subscriptionPlans.json`

#### Analysis:
- ✅ **Options Page**: Still uses JSON for plan configuration (UI display)
- ⚠️ **Content Script**: Uses JSON for package definitions, but we're getting packages from API now

**Action**: 
- Keep JSON in Options page (needed for UI)
- **Remove from Content Script** - load from API/storage instead

**Impact**: Reduces content script bundle by ~20-30 KiB

---

### 3. Greetings.jsx - Unused Component

**Location**: `src/containers/Greetings/Greetings.jsx`

**Status**: ❌ **NOT IMPORTED ANYWHERE**

**Action**: **DELETE** entire folder

**Impact**: Removes unused React component + icon import

---

### 4. print.js - Empty Function

**Location**: `src/pages/Content/modules/print.js`

**Status**: Contains only empty function (logging disabled)

**Usage**: Imported in `Content/index.js` (but that file might not be used)

**Action**: Check if `Content/index.js` is used, if not, delete both files

**Impact**: Minimal (empty function), but cleans up code

---

### 5. Devtools Folder - Check Usage

**Location**: `src/pages/Devtools/`

**Files**:
- `index.html` - Devtools page HTML
- `index.js` - Devtools script

**Manifest**: Referenced as `"devtools_page": "devtools.html"`

**Question**: Do you use Chrome DevTools integration?

**Action**: 
- If **NOT using DevTools**: Remove from manifest and delete folder
- If **using DevTools**: Keep but optimize

**Impact**: Removes devtools bundle if not needed

---

### 6. Newtab Folder - Check Usage

**Location**: `src/pages/Newtab/`

**Files**:
- `index.html`, `index.jsx`, `Newtab.jsx`, `Newtab.css`, `Newtab.scss`, `index.css`

**Manifest**: Referenced as `"chrome_url_overrides": { "newtab": "newtab.html" }`

**Question**: Do you override Chrome's new tab page?

**Action**:
- If **NOT overriding new tab**: Remove from manifest and delete folder
- If **using new tab**: Keep but optimize

**Impact**: Removes newtab bundle if not needed (~50-100 KiB)

---

## 🎯 Recommended Actions

### Phase 1: Quick Wins (Immediate - 30 min)

1. ✅ **Remove unused image copy**
   - Remove `raicon-dark-border.png` from webpack.config.js
   - Delete unused source images

2. ✅ **Delete Greetings component**
   - Delete `src/containers/Greetings/` folder

3. ✅ **Remove print.js if unused**
   - Check if `Content/index.js` is used
   - Delete if not referenced

### Phase 2: Content Script Optimization (1-2 hours)

4. ✅ **Remove JSON imports from Content Script**
   - Load packages from API/storage instead
   - Keep JSON only in Options page

### Phase 3: Remove Unused Pages (5 min each)

5. ⚠️ **Remove Devtools** (if not used)
   - Remove from manifest.json
   - Delete `src/pages/Devtools/` folder

6. ⚠️ **Remove Newtab** (if not used)
   - Remove from manifest.json
   - Delete `src/pages/Newtab/` folder

---

## 📈 Expected Size Reduction

| Action | Current Size | Reduction | New Size |
|--------|-------------|-----------|----------|
| Remove unused images | 409 KiB | ~109 KiB | ~300 KiB |
| Remove JSON from content script | 240 KiB | ~20-30 KiB | ~210-220 KiB |
| Remove Greetings | - | ~5 KiB | - |
| Remove Devtools (if unused) | - | ~20-30 KiB | - |
| Remove Newtab (if unused) | - | ~50-100 KiB | - |
| **Total Potential** | **678 KiB** | **~200-250 KiB** | **~430-480 KiB** |

---

## ✅ Implementation Checklist

- [ ] Remove `raicon-dark-border.png` from webpack.config.js
- [ ] Delete unused source images from `src/assets/img/`
- [ ] Delete `src/containers/Greetings/` folder
- [ ] Check and remove `Content/index.js` and `modules/print.js` if unused
- [ ] Remove JSON imports from Content Script, load from API
- [ ] Confirm Devtools usage - remove if unused
- [ ] Confirm Newtab usage - remove if unused
- [ ] Update manifest.json to remove unused pages
- [ ] Test build and verify size reduction
- [ ] Test extension functionality

---

**Last Updated**: 2026-01-22
