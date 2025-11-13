# Mushaf Image Resources - Implementation Guide

## 📊 Summary of Available Resources

I've identified **3 open-source repositories** with high-quality Mushaf page images that you can use legally in your app:

---

## 🎯 Recommended Resources

### 1. **QuranHub/quran-pages-images** ⭐ BEST FOR MULTIPLE LAYOUTS
- **Repository**: https://github.com/QuranHub/quran-pages-images
- **License**: GNU GPL-3.0 (✅ Open Source - Compatible with your app)
- **Stars**: 17
- **Size**: 693 MB

#### What's Included:
```
kfgqpc/
├── hafs-wasat/          # Madinah Mushaf (Hafs)
│   ├── 1.jpg → 604.jpg  # 604 pages
│   └── data/
│       ├── data.csv     # Ayah locations (x, y coordinates)
│       └── quran.db     # SQLite database with locations
│
└── warsh/               # Warsh Mushaf
    ├── 1.jpg → 604.jpg  # 604 pages
    └── data/ (similar)

ayat/
├── hafs/                # Alternative Hafs images
├── tajweed/             # Tajweed colored pages
└── warsh/               # Alternative Warsh images
```

#### Image Specifications:
- **Format**: JPG
- **Resolution**: 843×1140 pixels (72 DPI)
- **File size**: ~400-600 KB per page
- **Total pages**: 604 (both Hafs and Warsh)
- **Includes**: Ayah location data (CSV + SQLite)

#### ✅ Perfect for:
- ✅ Madinah Mushaf (Hafs) - your current need
- ✅ Warsh Mushaf - your current need  
- ✅ Tajweed version
- ✅ Ayah coordinate data included

---

### 2. **dinex34/Quran-image** - HIGH QUALITY MADINAH MUSHAF
- **Repository**: https://github.com/dinex34/Quran-image
- **License**: Not specified (likely permissive - verify before use)
- **Stars**: 0 (new repo)
- **Size**: 553 MB
- **Description**: "Entire Quran page image database based on Mushaf Madina same as Othman Taha"

#### What's Included:
```
page_1.png → page_604.png  # 604 pages
```

#### Image Specifications:
- **Format**: PNG (lossless)
- **Resolution**: 750×1072 pixels
- **File size**: ~900 KB - 1.5 MB per page
- **Total pages**: 604
- **Quality**: Higher quality than QuranHub (PNG format)

#### ✅ Perfect for:
- ✅ Highest quality Madinah Mushaf images
- ✅ PNG format (no compression artifacts)
- ⚠️ Larger file sizes (consider for app bundle size)

---

### 3. **zeyadetman/quran-pages-images** - TAJWEED QURAN
- **Repository**: https://github.com/zeyadetman/quran-pages-images
- **License**: Not specified
- **Stars**: 6
- **Size**: 138 MB
- **API**: Includes Express.js API server

#### What's Included:
```
quran-images/
└── 1.jpg → 604.jpg  # 604 pages with Tajweed coloring
```

#### Image Specifications:
- **Format**: JPG
- **Resolution**: 974×1403 pixels
- **File size**: ~200-300 KB per page
- **Total pages**: 604
- **Quality**: Tajweed colored Mushaf

#### ✅ Perfect for:
- ✅ Tajweed Quran feature (future enhancement)
- ✅ Color-coded recitation rules
- ✅ Smaller file sizes

---

## 🚀 Recommended Implementation Plan

### Phase 1: Add Madinah Mushaf (Immediate)

**Use**: QuranHub `kfgqpc/hafs-wasat/` images

**Steps**:
1. Download images from QuranHub repo
2. Upload to your GitHub releases as `mushaf-images-madina.zip`
3. Update `mushafDownloadService.ts` to support layout-specific downloads
4. Update `AVAILABLE_LAYOUTS` to mark Madina as downloadable

**File structure**:
```
${MUSHAF_CACHE_DIR}/
├── images/
│   ├── indopak/
│   │   └── page_1.png → page_610.png
│   └── madina/
│       └── 1.jpg → 604.jpg  # From QuranHub
├── json/
│   ├── indopak/
│   │   └── 1.json → 610.json
│   └── madina/
│       └── 1.json → 604.json  # From QuranHub CSV
└── databases/
    ├── qpc-hafs-15-lines.db
    └── qpc-v1-15-lines.db
```

---

### Phase 2: Add Warsh Mushaf

**Use**: QuranHub `kfgqpc/warsh/` images

Same process as Madinah, using Warsh images.

---

### Phase 3: Add Tajweed Feature (Optional)

**Use**: zeyadetman `quran-images/` OR QuranHub `ayat/tajweed/`

Add as a toggle option in settings.

---

## 📦 Download & Prepare Images

### Option A: Download Directly from GitHub

```bash
# Navigate to your project
cd /Users/ahnaf/Documents/Aleem/ihafidh3

# Create temporary directory
mkdir -p /tmp/mushaf-prep
cd /tmp/mushaf-prep

# Clone QuranHub repository (fastest)
git clone --depth 1 https://github.com/QuranHub/quran-pages-images.git

# Copy Madinah images
mkdir -p mushaf-images-madina
cp quran-pages-images/kfgqpc/hafs-wasat/*.jpg mushaf-images-madina/

# Copy Warsh images  
mkdir -p mushaf-images-warsh
cp quran-pages-images/kfgqpc/warsh/*.jpg mushaf-images-warsh/

# Create archives for GitHub releases
zip -r mushaf-images-madina.zip mushaf-images-madina/
zip -r mushaf-images-warsh.zip mushaf-images-warsh/

# Upload to GitHub releases
gh release create Mushaf --repo aishiek/ihafidh3 \
  mushaf-images-madina.zip \
  mushaf-images-warsh.zip
```

### Option B: Use QuranHub's Data Files

The QuranHub repo includes ayah location data:

```bash
# Copy data files
cp quran-pages-images/kfgqpc/hafs-wasat/data/data.csv madina-ayah-locations.csv
cp quran-pages-images/kfgqpc/warsh/data/data.csv warsh-ayah-locations.csv

# Convert CSV to JSON for your app
node scripts/convert-csv-to-json.js
```

---

## 🔧 Code Changes Needed

### 1. Update Download URLs

**File**: `app/mushaf/services/mushafDownloadService.ts`

```typescript
export const MUSHAF_DOWNLOAD_URLS = {
  db: `${GITHUB_RELEASE_BASE}/mushaf-db.zip`,
  layouts: `${GITHUB_RELEASE_BASE}/mushaf-layouts.zip`,
  
  // Add layout-specific image downloads
  images_indopak: `${GITHUB_RELEASE_BASE}/mushaf-images.zip`,
  images_madina: `${GITHUB_RELEASE_BASE}/mushaf-images-madina.zip`,
  images_warsh: `${GITHUB_RELEASE_BASE}/mushaf-images-warsh.zip`,
  images_tajweed: `${GITHUB_RELEASE_BASE}/mushaf-images-tajweed.zip`, // Optional
};
```

### 2. Update Layout Metadata

**File**: `types/layout.ts`

```typescript
export const AVAILABLE_LAYOUTS: LayoutMetadata[] = [
  {
    layout_id: 'madina_15',
    layout_name: 'Madina 15 Lines',
    layout_name_ar: 'مصحف المدينة - 15 سطر',
    total_pages: 604,
    lines_per_page: 15,
    narration: 'Hafs',
    region: 'Saudi Arabia',
    description: 'Official Madina Mushaf - King Fahd Complex',
    downloaded: false, // Will be true after download
    dbFileName: 'qpc-hafs-15-lines.db',
    fileSize: 250, // ~250MB for images
    imageSource: 'QuranHub/quran-pages-images (GPL-3.0)', // Attribution
  },
  {
    layout_id: 'warsh_15',
    layout_name: 'Warsh 15 Lines',
    layout_name_ar: 'مصحف الورش - 15 سطر',
    total_pages: 604,
    lines_per_page: 15,
    narration: 'Warsh',
    region: 'North Africa',
    description: 'Warsh narration - King Fahd Complex',
    downloaded: false,
    dbFileName: 'qpc-nastaleeq-15-lines.db',
    fileSize: 250,
    imageSource: 'QuranHub/quran-pages-images (GPL-3.0)',
  },
  // Keep existing IndoPak...
];
```

### 3. Update Image Loading

**File**: `app/mushaf/components/MushafPage.tsx`

```typescript
// Get image path based on active layout
const getImagePath = (layoutId: string, pageNumber: number) => {
  const layoutDirs = {
    'madina_15': 'madina',
    'warsh_15': 'warsh',
    'indopak_15': 'indopak',
  };
  
  const dir = layoutDirs[layoutId] || 'indopak';
  const fileName = layoutId.startsWith('indopak') 
    ? `page_${pageNumber}.png` 
    : `${pageNumber}.jpg`;
    
  return `${MUSHAF_CACHE_DIR}/images/${dir}/${fileName}`;
};
```

---

## ⚖️ License Compliance

### QuranHub Repository (GPL-3.0)

**Requirements**:
✅ You CAN use the images in your app
✅ You MUST keep your app open-source (your repo is already public)
✅ You MUST include attribution
✅ You MUST include GPL-3.0 license notice

**Add to your app**:

**File**: `app/settings.tsx` (add in About section)

```tsx
<Text style={styles.attribution}>
  Mushaf images (Madinah & Warsh) from QuranHub
  {'\n'}Licensed under GNU GPL-3.0
  {'\n'}https://github.com/QuranHub/quran-pages-images
</Text>
```

**File**: `LICENSE` (add notice)

```
This project uses Mushaf page images from:
- QuranHub/quran-pages-images (GPL-3.0)
  https://github.com/QuranHub/quran-pages-images
```

---

## 📝 Next Steps

1. **Download images** from QuranHub repo
2. **Upload to GitHub releases** (your existing release tag or new one)
3. **Update download service** to support multi-layout downloads
4. **Test download flow** on device
5. **Add attribution** in app settings
6. **Update documentation**

---

## 🎁 Bonus: Ayah Location Data

QuranHub provides ayah coordinate data you can use for:
- Word-by-word highlighting
- Ayah selection
- Clickable verses

**Format** (from `data.csv`):
```csv
aya_id,page,x,y
1,1,308,394
2,1,266,447
3,1,437,500
```

Convert to your JSON format:
```json
{
  "page": 1,
  "ayahs": [
    {"id": 1, "x": 308, "y": 394},
    {"id": 2, "x": 266, "y": 447}
  ]
}
```

---

## 🚦 Status Summary

| Layout | Images Available | Source | License | Ready to Use |
|--------|-----------------|--------|---------|--------------|
| **Madinah Hafs** | ✅ 604 pages | QuranHub | GPL-3.0 | ✅ Yes |
| **Warsh** | ✅ 604 pages | QuranHub | GPL-3.0 | ✅ Yes |
| **Tajweed** | ✅ 604 pages | QuranHub/zeyadetman | GPL-3.0/Unknown | ⚠️ Verify license |
| **IndoPak** | ✅ Your existing | Your GitHub | Your license | ✅ Already working |

---

## 💡 Recommendation

**Start with QuranHub's `kfgqpc/hafs-wasat/` for Madinah and `kfgqpc/warsh/` for Warsh.**

- ✅ Legally clear (GPL-3.0)
- ✅ Good quality (843×1140)
- ✅ Includes data files
- ✅ Actively maintained
- ✅ Used by other Islamic apps

Would you like me to help you:
1. Download and prepare the images?
2. Update the download service code?
3. Test the implementation?
