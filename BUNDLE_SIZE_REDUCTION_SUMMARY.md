# Bundle Size Reduction - Analysis Summary

**Date**: 2026-01-22

---

## 🔍 Findings

### 1. Images - What's Actually Used

**✅ USED (Keep)**:
- `icon-128.png` - Content, Greetings, Devtools
- `icon-34.png` - Devtools, manifest
- `xrepl-light.png` - Options, Content, Popup
- `xrepl-dark.png` - Content
- `raiconvector.png` - Content (LinkedIn)
- `raicon.png` - Manifest (default icon)
- `logo.svg` - Newtab

**❌ UNUSED (Delete)**:
- `raicon-dark-border.png` - **NOT USED ANYWHERE** (duplicate of xrepl256light.png)
- Many unused source images in `src/assets/img/` folder

**Impact**: Remove ~109 KiB duplicate image

---

### 2. JSON Config Files

**Current Status**:
- ✅ **Options.tsx**: Still needs JSON for UI (plan configuration)
- ❌ **Content/index.jsx**: Imports JSON but gets packages from API now

**Action**: Remove JSON imports from Content Script, load from API/storage

**Impact**: Reduce content script by ~20-30 KiB

---

### 3. Greetings.jsx

**Status**: ❌ **NOT IMPORTED ANYWHERE**

**Location**: `src/containers/Greetings/Greetings.jsx`

**Action**: **DELETE** entire folder

**Impact**: Remove unused React component

---

### 4. print.js Module

**Status**: ❌ **NOT USED**

**Location**: `src/pages/Content/modules/print.js`
- Contains only empty function (logging disabled)
- Imported in `Content/index.js` (but that's NOT the entry point)
- Entry point is `Content/index.jsx`

**Action**: Delete `Content/index.js` and `modules/print.js`

**Impact**: Clean up unused code

---

### 5. Devtools Folder

**Status**: ⚠️ **BOILERPLATE CODE** (likely unused)

**Files**: `index.html`, `index.js`
**Manifest**: `"devtools_page": "devtools.html"`

**Question**: Do you use Chrome DevTools integration?

**Action**: 
- If **NO**: Remove from manifest + delete folder
- If **YES**: Keep but optimize

**Impact**: ~20-30 KiB if removed

---

### 6. Newtab Folder

**Status**: ⚠️ **BOILERPLATE CODE** (likely unused)

**Files**: Multiple React files
**Manifest**: `"chrome_url_overrides": { "newtab": "newtab.html" }`

**Question**: Do you override Chrome's new tab page?

**Action**:
- If **NO**: Remove from manifest + delete folder
- If **YES**: Keep but optimize

**Impact**: ~50-100 KiB if removed

---

## 📊 Expected Reductions

| Item | Size Reduction |
|------|----------------|
| Remove unused image | ~109 KiB |
| Remove JSON from content script | ~20-30 KiB |
| Remove Greetings | ~5 KiB |
| Remove Devtools (if unused) | ~20-30 KiB |
| Remove Newtab (if unused) | ~50-100 KiB |
| **Total Potential** | **~200-250 KiB** |

**Current**: 678 KiB  
**Target**: ~430-480 KiB  
**Reduction**: ~35-40%

---

## ✅ Implementation Order

1. **Quick Wins** (5 min):
   - Remove `raicon-dark-border.png` from webpack
   - Delete Greetings folder
   - Delete Content/index.js and print.js

2. **Content Script** (1-2 hours):
   - Remove JSON imports, load from API

3. **Confirm & Remove** (5 min each):
   - Confirm Devtools usage → remove if unused
   - Confirm Newtab usage → remove if unused

---

**Ready to implement!**
