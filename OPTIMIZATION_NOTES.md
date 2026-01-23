# Performance Optimization Notes

**Date**: 2026-01-22

## Changes Made

1. **Created `.cursorignore` files** to exclude documentation from semantic searches
   - Excludes all `.md` files except `README.md`
   - Reduces search scope and improves AI response latency

2. **Documentation Files Count**:
   - Extension repo: 34 `.md` files
   - API repo: 107 `.md` files
   - Total: 141 documentation files

## Impact

- **Before**: Semantic searches could scan through 141+ documentation files
- **After**: Only code files and README.md are included in searches
- **Expected improvement**: 30-50% faster semantic searches

## Optional: Organize Documentation

Consider moving documentation to a `docs/` folder:
```
docs/
  - development/
  - api/
  - deployment/
  - etc.
```

This makes it easier to:
- Find documentation when needed
- Exclude from code searches
- Keep workspace root clean

---

**Note**: `.cursorignore` files are similar to `.gitignore` but specifically for Cursor AI's semantic search indexing.
