# Marketplace Listing Image Upload - Implementation Guide

## Overview

This document describes the implementation of image upload functionality for marketplace listings in the EcoPlate app. Users can now upload up to 5 product images when creating or editing marketplace listings, either by selecting from their gallery or taking photos with their device camera (mobile only).

## Architecture

### Storage Strategy

The implementation uses a **dual-environment approach**:

- **Development (Local)**: Images stored in `backend/public/uploads/marketplace/`
- **Production (Cloud)**: Extendable to cloud storage (AWS S3, Cloudflare R2, etc.)

This allows seamless migration from local development to cloud deployment without schema changes.

### Database Schema

Images are stored as **JSON arrays of URLs** in a text field:

```typescript
// backend/src/db/schema.ts
export const marketplaceListings = sqliteTable("marketplace_listings", {
  // ... other fields
  images: text("images"), // JSON: ["uploads/marketplace/abc.jpg", "uploads/marketplace/xyz.jpg"]
  // ... other fields
});
```

**Why JSON text field?**
- Works in both SQLite (dev) and MySQL (production)
- No schema changes needed when migrating databases
- Easy to query and update
- Keeps database lightweight (stores URLs, not binary data)

---

## Backend Implementation

### 1. Database Migration

After modifying `schema.ts`, you need to generate and apply migrations:

```bash
cd backend

# Stop the server first to avoid database locks!

# Delete old migrations (as per project rules)
rm -rf src/db/migrations

# Generate new migration
bunx drizzle-kit generate:sqlite

# Update migrate.ts to reference the new migration file
# Edit src/db/migrate.ts and update the import path

# Run migration
bun run db:migrate

# Seed data if needed
bun run db:seed
```

**CRITICAL**: Remember that `ecoplate.db` is committed to git. Coordinate with your team when applying migrations.

### 2. Image Upload Service

**File**: `backend/src/services/image-upload.ts`

Key functions:

- `initializeUploadDir()` - Creates upload directory on server start
- `validateImage(file)` - Validates file type and size (max 5MB, jpg/png/webp)
- `saveImageLocally(file)` - Saves to `public/uploads/marketplace/` in development
- `uploadToCloud(file)` - Placeholder for cloud upload in production
- `uploadProductImage(file)` - Main upload function (auto-detects environment)
- `uploadProductImages(files)` - Batch upload (max 5 images)
- `deleteImage(url)` / `deleteImages(urls)` - Cleanup functions

**Environment Variables** (for production):

```env
NODE_ENV=production
USE_CLOUD_STORAGE=true
# Add cloud provider credentials (S3_BUCKET, AWS_ACCESS_KEY_ID, etc.)
```

### 3. Upload Routes

**File**: `backend/src/routes/upload.ts`

**Endpoints**:

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/v1/upload/image` | Upload single image | `multipart/form-data` with `image` field | `{ imageUrl: string }` |
| POST | `/api/v1/upload/images` | Upload multiple images (max 5) | `multipart/form-data` with `image0`, `image1`, etc. | `{ imageUrls: string[] }` |

**Authentication**: Both routes require JWT token (protected routes).

### 4. Marketplace Routes Updates

**File**: `backend/src/routes/marketplace.ts`

**Changes**:
- Added `images` field to `listingSchema` validation (Zod)
- Create listing: Accepts `images` array, stores as JSON string
- Update listing: Can update images array
- Get listings: Returns `images` field (JSON string)

**Example Request**:
```json
{
  "title": "Fresh Apples",
  "description": "Organic apples, slightly bruised",
  "category": "produce",
  "quantity": 5,
  "price": 3.50,
  "images": ["uploads/marketplace/123-abc.jpg", "uploads/marketplace/456-def.jpg"]
}
```

### 5. Static File Serving

**File**: `backend/src/index.ts`

Updated `serveStatic()` to serve images from `public/uploads/`:

```typescript
// Serves: http://localhost:3000/uploads/marketplace/image.jpg
// From: backend/public/uploads/marketplace/image.jpg
```

### 6. .gitignore

Added to `.gitignore`:

```
# Uploaded files (local development)
backend/public/uploads/
```

This prevents committing user-uploaded images to git (only URL references are in the database).

---

## Frontend Implementation

### 1. TypeScript Types

**File**: `frontend/src/types/marketplace.ts`

Updated interfaces:

```typescript
export interface MarketplaceListing {
  // ... other fields
  images: string | null; // JSON string from database
}

export interface CreateListingRequest {
  // ... other fields
  images?: string[]; // Array of image URLs to send to backend
}

export interface UpdateListingRequest {
  // ... other fields
  images?: string[]; // Array of image URLs
}
```

### 2. Upload Service

**File**: `frontend/src/services/upload.ts`

Key functions:

- `uploadImage(file)` - Upload single image, returns URL
- `uploadImages(files)` - Upload multiple images (max 5), returns URL array
- `getImageUrl(url)` - Convert relative URL to full URL
- `parseImages(json)` - Parse JSON string to array
- `getListingImageUrls(json)` - Get full URLs for all images in a listing

**Example Usage**:

```typescript
import { uploadService } from "@/services/upload";

// Upload single image
const file = event.target.files[0];
const imageUrl = await uploadService.uploadImage(file);

// Upload multiple images
const files = Array.from(event.target.files);
const imageUrls = await uploadService.uploadImages(files);

// Display images in a listing
const listing = await marketplaceService.getListing(id);
const imageUrls = uploadService.getListingImageUrls(listing.images);
```

### 3. ImagePicker Component

**File**: `frontend/src/components/common/ImagePicker.tsx`

A reusable React component for image selection and upload.

**Features**:
- File picker (web + mobile)
- Camera capture (mobile only, using Capacitor)
- Image preview grid with delete buttons
- Loading states
- Error handling
- Max 5 images limit
- Responsive design

**Props**:

```typescript
interface ImagePickerProps {
  maxImages?: number;           // Default: 5
  onImagesChange: (urls: string[]) => void; // Callback when images change
  initialImages?: string[];     // Pre-populate images (for editing)
}
```

**Usage Example**:

```tsx
import { ImagePicker } from "@/components/common/ImagePicker";

function CreateListingForm() {
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const handleSubmit = async () => {
    await marketplaceService.createListing({
      title: "Fresh Apples",
      // ... other fields
      images: imageUrls, // Pass array of URLs
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Other form fields */}

      <ImagePicker
        maxImages={5}
        onImagesChange={setImageUrls}
        initialImages={[]} // Empty for new listing
      />

      <button type="submit">Create Listing</button>
    </form>
  );
}
```

### 4. Displaying Images

**In Listing Cards**:

```tsx
import { uploadService } from "@/services/upload";

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const imageUrls = uploadService.getListingImageUrls(listing.images);
  const primaryImage = imageUrls[0]; // First image as thumbnail

  return (
    <div className="card">
      {primaryImage ? (
        <img src={primaryImage} alt={listing.title} />
      ) : (
        <div className="no-image-placeholder">No image</div>
      )}
      <h3>{listing.title}</h3>
      <p>${listing.price}</p>
    </div>
  );
}
```

**In Listing Detail Page (Image Gallery)**:

```tsx
function ListingDetail({ listing }: { listing: MarketplaceListing }) {
  const imageUrls = uploadService.getListingImageUrls(listing.images);

  return (
    <div>
      {imageUrls.length > 0 ? (
        <div className="image-gallery">
          {imageUrls.map((url, index) => (
            <img key={index} src={url} alt={`${listing.title} ${index + 1}`} />
          ))}
        </div>
      ) : (
        <div className="no-images">No images available</div>
      )}

      <h1>{listing.title}</h1>
      <p>{listing.description}</p>
    </div>
  );
}
```

---

## UI Integration

The image upload feature has been fully integrated into all marketplace listing pages.

### Pages Updated

#### 1. Create Listing Page
**File**: `frontend/src/pages/CreateListingPage.tsx`
**Route**: `/marketplace/create`

**Integration**:
- ImagePicker component added below "Pickup Location" field
- Images are uploaded when user selects/captures them
- Image URLs are saved in form state
- Submitted with listing data to backend

**Code**:
```tsx
import { ImagePicker } from "../components/common/ImagePicker";

const [imageUrls, setImageUrls] = useState<string[]>([]);

// In form JSX:
<div className="space-y-2">
  <Label>Product Images</Label>
  <ImagePicker
    maxImages={5}
    onImagesChange={setImageUrls}
    initialImages={[]}
  />
  <p className="text-sm text-gray-500">
    Add up to 5 images. You can take photos or choose from your gallery.
  </p>
</div>

// On submit:
const data = {
  // ... other fields
  images: imageUrls.length > 0 ? imageUrls : undefined,
};
await marketplaceService.createListing(data);
```

---

#### 2. Edit Listing Page
**File**: `frontend/src/pages/EditListingPage.tsx`
**Route**: `/marketplace/:id/edit`

**Integration**:
- Loads existing images from listing
- ImagePicker pre-populated with current images
- Users can add/remove images
- Updated images saved on form submission

**Code**:
```tsx
import { uploadService } from "../services/upload";

// Load existing images
const loadListing = async () => {
  const listing = await marketplaceService.getListing(Number(id));
  const existingImages = uploadService.parseImages(listing.images);
  setImageUrls(existingImages);
};

// In form JSX:
<ImagePicker
  maxImages={5}
  onImagesChange={setImageUrls}
  initialImages={imageUrls}
/>
```

---

#### 3. Listing Detail Page (Image Gallery)
**File**: `frontend/src/pages/ListingDetailPage.tsx`
**Route**: `/marketplace/:id`

**Features**:
- Full-size image viewer with navigation
- Thumbnail gallery below main image
- Left/Right navigation arrows
- Image counter (e.g., "1 / 3")
- Graceful fallback to placeholder if no images

**Code**:
```tsx
import { uploadService } from "../services/upload";
import { ChevronLeft, ChevronRight } from "lucide-react";

const [currentImageIndex, setCurrentImageIndex] = useState(0);

// Get images
const imageUrls = uploadService.getListingImageUrls(listing.images);
const hasImages = imageUrls.length > 0;

// Navigation
const handlePrevImage = () => {
  setCurrentImageIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
};

const handleNextImage = () => {
  setCurrentImageIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
};

// JSX:
<div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border">
  {hasImages ? (
    <>
      <img
        src={imageUrls[currentImageIndex]}
        alt={`${listing.title} - Image ${currentImageIndex + 1}`}
        className="w-full h-full object-cover"
      />
      {imageUrls.length > 1 && (
        <>
          {/* Navigation Arrows */}
          <button onClick={handlePrevImage} className="absolute left-2 top-1/2 ...">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={handleNextImage} className="absolute right-2 top-1/2 ...">
            <ChevronRight className="h-5 w-5" />
          </button>
          {/* Image Counter */}
          <div className="absolute bottom-4 right-4 bg-black/70 text-white ...">
            {currentImageIndex + 1} / {imageUrls.length}
          </div>
        </>
      )}
    </>
  ) : (
    <div className="text-center text-gray-400">
      <p className="text-4xl mb-2">📦</p>
      <p className="text-sm">No image</p>
    </div>
  )}
</div>

{/* Thumbnail Gallery */}
{imageUrls.length > 1 && (
  <div className="grid grid-cols-5 gap-2">
    {imageUrls.map((url, index) => (
      <button
        key={index}
        onClick={() => setCurrentImageIndex(index)}
        className={index === currentImageIndex ? "border-primary ring-2" : ""}
      >
        <img src={url} alt={`Thumbnail ${index + 1}`} />
      </button>
    ))}
  </div>
)}
```

---

#### 4. Marketplace Page (Listing Cards)
**File**: `frontend/src/pages/MarketplacePage.tsx`
**Route**: `/marketplace`

**Integration**:
- Listing cards show first image as thumbnail
- Falls back to placeholder emoji if no images

**Code**:
```tsx
import { uploadService } from "../services/upload";

function ListingCard({ listing }) {
  const imageUrls = uploadService.getListingImageUrls(listing.images);
  const thumbnailUrl = imageUrls[0];

  return (
    <Card>
      <div className="aspect-video bg-gray-100 relative">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400 text-4xl">📦</div>
        )}
      </div>
      {/* ... rest of card */}
    </Card>
  );
}
```

---

#### 5. My Listings Page
**File**: `frontend/src/pages/MyListingsPage.tsx`
**Route**: `/marketplace/my-listings`

**Integration**:
- Same as Marketplace page
- Shows user's own listings with image thumbnails
- Status badge overlay on images

---

### User Flow

#### Creating a Listing with Images:

1. Navigate to `/marketplace/create`
2. Fill in listing details (title, price, etc.)
3. Scroll to "Product Images" section
4. Click **"Choose Images"** to select from gallery
   - OR click **"Take Photo"** (mobile only) to use camera
5. See image previews appear in grid
6. Click **X button** on any image to remove it
7. Add more images (up to 5 total)
8. Submit the form
9. Images are uploaded and saved with listing
10. Redirected to listing detail page showing all images

#### Editing a Listing:

1. Go to `/marketplace/my-listings`
2. Click **"Edit"** on any listing
3. Scroll to "Product Images" section
4. See existing images loaded in the picker
5. Add new images or remove existing ones
6. Save changes
7. Updated images are reflected immediately

#### Viewing Listings:

1. Browse marketplace at `/marketplace`
2. See listing cards with image thumbnails
3. Click a listing to view full details
4. Navigate between multiple images:
   - Click left/right arrows
   - Click thumbnails to jump to specific image
5. Images display full-size with zoom capability

---

### Component Features

#### ImagePicker Component
**File**: `frontend/src/components/common/ImagePicker.tsx`

**Props**:
```tsx
interface ImagePickerProps {
  maxImages?: number;           // Default: 5
  onImagesChange: (urls: string[]) => void;
  initialImages?: string[];     // Pre-load existing images
}
```

**Features**:
- ✅ File picker (web + mobile)
- ✅ Camera capture (mobile only, auto-detected)
- ✅ Image preview grid
- ✅ Delete individual images
- ✅ Upload progress indication
- ✅ Error handling with user-friendly messages
- ✅ Max images limit enforcement
- ✅ File type and size validation
- ✅ Responsive design (mobile-first)

**Platform Detection**:
```tsx
import { Capacitor } from "@capacitor/core";

{Capacitor.isNativePlatform() && (
  <Button onClick={handleCameraCapture}>
    <Camera className="w-4 h-4 mr-2" />
    Take Photo
  </Button>
)}
```

---

### Upload Service Helper Functions

**File**: `frontend/src/services/upload.ts`

#### `uploadImage(file: File): Promise<string>`
Upload single image, returns URL

#### `uploadImages(files: File[]): Promise<string[]>`
Upload multiple images (max 5), returns URL array

#### `getImageUrl(url: string): string`
Convert relative URL to full URL
- Input: `"uploads/marketplace/image.jpg"`
- Output: `"http://localhost:3000/uploads/marketplace/image.jpg"`

#### `parseImages(json: string | null): string[]`
Parse JSON string from database to array
- Input: `'["img1.jpg", "img2.jpg"]'`
- Output: `["img1.jpg", "img2.jpg"]`

#### `getListingImageUrls(json: string | null): string[]`
Get full URLs for all images in a listing (combines parse + getImageUrl)
- Input: `'["uploads/marketplace/a.jpg", "uploads/marketplace/b.jpg"]'`
- Output: `["http://localhost:3000/uploads/marketplace/a.jpg", "http://localhost:3000/uploads/marketplace/b.jpg"]`

**Usage Example**:
```tsx
// Display images in a listing
const listing = await marketplaceService.getListing(id);
const imageUrls = uploadService.getListingImageUrls(listing.images);

// Show first image
{imageUrls[0] && <img src={imageUrls[0]} alt="Product" />}

// Show all images
{imageUrls.map((url, i) => (
  <img key={i} src={url} alt={`Product ${i + 1}`} />
))}
```

---

## Mobile (Capacitor) Setup

### Camera Permissions

**Android**: `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

The `@capacitor/camera` plugin is already installed in `package.json`.

### Camera API

The `ImagePicker` component automatically detects the platform:

- **Web**: Shows file picker only
- **Mobile**: Shows both file picker and camera button

```typescript
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform()) {
  // Running on iOS/Android - show camera button
  const { Camera } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
  });
}
```

### Sync to Mobile

After making changes:

```bash
cd frontend

# Build frontend
bun run build

# Sync to Capacitor
npx cap sync

# Open in Android Studio
npx cap open android
```

---

## Cloud Deployment (Production)

### Migrating to Cloud Storage

When deploying to production, follow these steps:

#### 1. Choose a Cloud Provider

**Recommended: Cloudflare R2** (S3-compatible, no egress fees)

Alternatives: AWS S3, Google Cloud Storage, Azure Blob Storage

#### 2. Install SDK

```bash
cd backend
bun add @aws-sdk/client-s3  # Works with R2 too (S3-compatible)
```

#### 3. Update Environment Variables

```env
NODE_ENV=production
USE_CLOUD_STORAGE=true

# Cloudflare R2 / AWS S3
S3_BUCKET=your-bucket-name
S3_REGION=auto  # or us-east-1 for AWS
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com  # R2 only
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# CDN URL (optional, for faster delivery)
CDN_URL=https://cdn.yourdomain.com
```

#### 4. Implement uploadToCloud()

**File**: `backend/src/services/image-upload.ts`

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function uploadToCloud(file: File): Promise<string> {
  const s3Client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT, // For R2
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const filename = generateFilename(file.name);
  const buffer = await file.arrayBuffer();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: `marketplace/${filename}`,
      Body: Buffer.from(buffer),
      ContentType: file.type,
    })
  );

  // Return CDN URL or direct bucket URL
  const baseUrl = process.env.CDN_URL || `https://${process.env.S3_BUCKET}.s3.amazonaws.com`;
  return `${baseUrl}/marketplace/${filename}`;
}
```

#### 5. Database Migration (SQLite to MySQL)

No schema changes needed! The `images` text field works the same:

**SQLite**:
```sql
CREATE TABLE marketplace_listings (
  images TEXT
);
```

**MySQL**:
```sql
CREATE TABLE marketplace_listings (
  images TEXT
);
```

Both store JSON strings identically.

#### 6. Update Frontend API URL

```env
# frontend/.env.production
VITE_API_URL=https://api.yourdomain.com
```

---

## File Size & Limits

### Backend Validation

- **Max file size**: 5MB per image
- **Allowed types**: JPEG, JPG, PNG, WebP
- **Max images**: 5 per listing

### Frontend Validation

The `ImagePicker` component enforces the same limits and provides user-friendly error messages.

### Adjusting Limits

To change limits, update:

1. Backend: `backend/src/services/image-upload.ts`
   ```typescript
   const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
   ```

2. Frontend: `frontend/src/components/common/ImagePicker.tsx`
   ```tsx
   <ImagePicker maxImages={10} />
   ```

3. Backend validation: `backend/src/routes/marketplace.ts`
   ```typescript
   images: z.array(z.string()).max(10).optional()
   ```

---

## Testing

### Local Testing (Development)

1. **Start backend**:
   ```bash
   cd backend
   bun run dev
   ```

2. **Start frontend**:
   ```bash
   cd frontend
   bun run dev
   ```

3. **Test UI Integration - Create Listing**:
   - Navigate to `http://localhost:5173/marketplace/create`
   - Fill in required fields (title, quantity)
   - Scroll to "Product Images" section
   - Click "Choose Images" button
   - Select 1-5 images from file system
   - Verify images appear in preview grid
   - Try removing an image by clicking X button
   - Submit form
   - Verify redirect to listing detail page
   - Verify images display correctly in detail view

4. **Test UI Integration - Edit Listing**:
   - Go to `http://localhost:5173/marketplace/my-listings`
   - Click "Edit" on any listing
   - Scroll to "Product Images" section
   - Verify existing images are loaded
   - Add new images or remove existing ones
   - Save changes
   - Verify updates on detail page

5. **Test UI Integration - View Listings**:
   - Go to `http://localhost:5173/marketplace`
   - Verify listing cards show image thumbnails
   - Click a listing with multiple images
   - Test image navigation (left/right arrows)
   - Click thumbnails to jump to specific image
   - Verify image counter updates correctly

6. **Check uploaded files**:
   ```bash
   ls backend/public/uploads/marketplace/
   ```

7. **Check database**:
   ```bash
   cd backend
   bunx drizzle-kit studio
   # Open browser to view database
   # Check "images" column in marketplace_listings table
   ```

### Mobile Testing (Android)

1. **Build and sync**:
   ```bash
   cd frontend
   bun run build:android
   ```

2. **Open Android Studio**:
   ```bash
   npx cap open android
   ```

3. **Run on emulator/device**:
   - Click "Run" in Android Studio
   - Test both gallery selection and camera capture
   - Verify images upload to backend

4. **Check backend logs**:
   ```bash
   cd backend
   bun run dev
   # Watch for upload requests in terminal
   ```

### Production Testing (Cloud)

1. **Deploy backend with cloud storage configured**
2. **Upload test image**
3. **Verify image URL in response**:
   ```json
   {
     "imageUrl": "https://cdn.yourdomain.com/marketplace/123-abc.jpg"
   }
   ```
4. **Verify image is accessible via URL**

---

## Troubleshooting

### Issue: "Failed to upload image"

**Causes**:
- User not authenticated (missing JWT token)
- File type not allowed
- File too large (> 5MB)
- Upload directory doesn't exist

**Solutions**:
- Check browser console for error details
- Verify JWT token in localStorage
- Check backend logs for detailed error
- Ensure `backend/public/uploads/marketplace/` exists

### Issue: "Camera is only available on mobile devices"

**Cause**: Trying to use camera on web browser

**Solution**: Camera button only appears on mobile (Capacitor). Use file picker on web.

### Issue: Images not displaying

**Causes**:
- Image URL is relative but API_BASE_URL not set
- CORS blocking image requests
- Image file deleted from server

**Solutions**:
- Use `uploadService.getImageUrl()` to get full URLs
- Check CORS headers in backend
- Verify image files exist on server

### Issue: "Maximum 5 images allowed"

**Cause**: User trying to upload more than allowed

**Solution**: This is expected behavior. User must remove existing images before adding more.

### Issue: Database migration fails

**Causes**:
- Backend server still running (database locked)
- Conflicting migrations

**Solutions**:
```bash
# Stop backend server first!
cd backend

# Remove old migrations
rm -rf src/db/migrations

# Generate fresh migration
bunx drizzle-kit generate:sqlite

# Update migrate.ts with new migration filename

# Run migration
bun run db:migrate
```

---

## Cost Estimation (Production)

### Cloud Storage (Cloudflare R2)

- **Storage**: $0.015/GB/month
- **Class B operations** (uploads): $4.50 per million requests
- **Egress**: FREE (R2's main advantage)

**Example**:
- 10,000 listings
- 3 images each @ 500KB = 1.5GB per listing
- Total: 15GB
- **Monthly cost**: ~$0.23

### Alternative: AWS S3

- **Storage**: $0.023/GB/month
- **PUT requests**: $0.005 per 1,000 requests
- **Egress**: $0.09/GB (expensive!)

**Same example**:
- Storage: $0.35/month
- Egress (assume 10GB/month): $0.90/month
- **Monthly cost**: ~$1.25

**Recommendation**: Use Cloudflare R2 for better pricing.

---

## Security Considerations

### 1. File Validation

Always validate on **backend** (frontend validation can be bypassed):

- File type (MIME type + file extension)
- File size
- Image dimensions (optional, can add with image processing library)

### 2. Authentication

All upload endpoints require JWT authentication. Users can only upload images for their own listings.

### 3. Filename Generation

Use random, unpredictable filenames:

```typescript
// Good: timestamp + random string
`1705234567890-xyz123abc.jpg`

// Bad: user-provided filename (can include path traversal)
`../../../etc/passwd.jpg`
```

### 4. Content-Type Headers

Always set correct `Content-Type` when serving images to prevent XSS attacks.

### 5. Cleanup

Implement cleanup for orphaned images:
- Images uploaded but listing not created
- Listings deleted but images not removed

```typescript
// TODO: Implement periodic cleanup job
async function cleanupOrphanedImages() {
  // Find image files not referenced in database
  // Delete files older than 24 hours without listing
}
```

---

## Future Enhancements

### 1. Image Optimization

- **Resize images** on upload (thumbnails, medium, large)
- **Convert to WebP** for better compression
- **Lazy loading** in frontend

**Library**: `sharp` (Node.js) or cloud service (Cloudflare Images)

### 2. Image Compression

Compress images before upload (frontend):

```typescript
// Use browser-image-compression library
import imageCompression from 'browser-image-compression';

const compressedFile = await imageCompression(file, {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
});
```

### 3. Direct Upload to Cloud

Skip backend, upload directly from frontend to S3 using pre-signed URLs:

```typescript
// Backend generates pre-signed URL
const uploadUrl = await s3.getSignedUrl('putObject', {
  Bucket: 'bucket',
  Key: 'image.jpg',
  Expires: 60, // 1 minute
});

// Frontend uploads directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
});
```

**Benefits**: Reduces backend load, faster uploads

### 4. Image Gallery Component

Create a full-featured image gallery with:
- Lightbox/modal view
- Swipe navigation
- Zoom
- Download

**Library**: `react-image-gallery` or `photoswipe`

### 5. Image Sorting

Allow users to reorder images (primary image first):

```typescript
interface ImagePickerProps {
  onImagesChange: (urls: string[]) => void;
  onReorder?: (from: number, to: number) => void;
}
```

### 6. Progress Indicators

Show upload progress for large files:

```typescript
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (e) => {
  const percent = (e.loaded / e.total) * 100;
  setUploadProgress(percent);
});
```

---

## API Reference

### Backend Endpoints

#### POST /api/v1/upload/image

Upload single image.

**Headers**:
- `Authorization: Bearer <token>` (required)

**Body** (multipart/form-data):
- `image`: File

**Response**:
```json
{
  "imageUrl": "uploads/marketplace/123-abc.jpg",
  "message": "Image uploaded successfully"
}
```

**Errors**:
- `401`: Unauthorized
- `400`: No file provided / Invalid file type / File too large
- `500`: Upload failed

---

#### POST /api/v1/upload/images

Upload multiple images (max 5).

**Headers**:
- `Authorization: Bearer <token>` (required)

**Body** (multipart/form-data):
- `image0`: File
- `image1`: File
- ...

**Response**:
```json
{
  "imageUrls": [
    "uploads/marketplace/123-abc.jpg",
    "uploads/marketplace/456-def.jpg"
  ],
  "message": "2 images uploaded successfully"
}
```

**Errors**:
- `401`: Unauthorized
- `400`: No files / Too many files (> 5) / Invalid file
- `500`: Upload failed

---

#### POST /api/v1/marketplace/listings

Create listing (now accepts images).

**Body** (JSON):
```json
{
  "title": "Fresh Apples",
  "description": "Organic apples",
  "category": "produce",
  "quantity": 5,
  "price": 3.50,
  "images": [
    "uploads/marketplace/123-abc.jpg",
    "uploads/marketplace/456-def.jpg"
  ]
}
```

**Response**: Returns listing object with `images` field (JSON string).

---

### Frontend Services

#### uploadService.uploadImage(file)

Upload single image.

**Parameters**:
- `file: File` - Image file to upload

**Returns**: `Promise<string>` - Image URL

**Throws**: Error if upload fails

---

#### uploadService.uploadImages(files)

Upload multiple images.

**Parameters**:
- `files: File[]` - Array of image files (max 5)

**Returns**: `Promise<string[]>` - Array of image URLs

**Throws**: Error if upload fails or too many files

---

#### uploadService.getImageUrl(url)

Convert relative URL to full URL.

**Parameters**:
- `url: string` - Relative or absolute URL

**Returns**: `string` - Full URL

**Example**:
```typescript
getImageUrl("uploads/marketplace/image.jpg")
// Returns: "http://localhost:3000/uploads/marketplace/image.jpg"

getImageUrl("https://cdn.example.com/image.jpg")
// Returns: "https://cdn.example.com/image.jpg" (unchanged)
```

---

#### uploadService.parseImages(json)

Parse images JSON string to array.

**Parameters**:
- `json: string | null` - JSON string from database

**Returns**: `string[]` - Array of image URLs (empty array if null/invalid)

**Example**:
```typescript
parseImages('["img1.jpg", "img2.jpg"]')
// Returns: ["img1.jpg", "img2.jpg"]

parseImages(null)
// Returns: []
```

---

#### uploadService.getListingImageUrls(json)

Get full URLs for all images in a listing.

**Parameters**:
- `json: string | null` - Images JSON from listing

**Returns**: `string[]` - Array of full image URLs

**Example**:
```typescript
getListingImageUrls('["uploads/marketplace/a.jpg", "uploads/marketplace/b.jpg"]')
// Returns: [
//   "http://localhost:3000/uploads/marketplace/a.jpg",
//   "http://localhost:3000/uploads/marketplace/b.jpg"
// ]
```

---

## Summary

You now have a **fully implemented and integrated** image upload system for marketplace listings:

- ✅ **Backend**: Handles uploads, stores locally (dev) or cloud (prod)
- ✅ **Frontend UI**: Fully integrated into all marketplace pages
- ✅ **React Component**: ImagePicker with gallery/camera support
- ✅ **Mobile**: Capacitor Camera integration for native photo capture
- ✅ **Database**: JSON text field, works in SQLite and MySQL
- ✅ **Deployment**: Ready for cloud migration (S3/R2)

### Implementation Status

**Completed ✅**:
- Database schema updated with `images` field
- Backend upload endpoints and image service
- Frontend ImagePicker component created
- UI integration in Create Listing page
- UI integration in Edit Listing page
- UI integration in Listing Detail page (gallery viewer)
- UI integration in Marketplace page (thumbnails)
- UI integration in My Listings page (thumbnails)
- Upload service with helper functions
- Static file serving configured
- Mobile camera support (Capacitor)

**Ready to Use**:
The feature is production-ready for local development. Follow the Quick Start Checklist below to get started.

### Quick Start Checklist

- [ ] Run database migration (`bun run db:migrate`)
- [ ] Start backend (`cd backend && bun run dev`)
- [ ] Start frontend (`cd frontend && bun run dev`)
- [ ] Test creating a listing with images
- [ ] Test editing a listing to add/remove images
- [ ] Test viewing listings with image gallery
- [ ] Test on mobile with camera (optional)
- [ ] Configure cloud storage for production deployment (when ready)

### Key Files Modified/Created

**Backend**:
- `backend/src/db/schema.ts` - Added `images` field
- `backend/src/services/image-upload.ts` - Upload service (NEW)
- `backend/src/routes/upload.ts` - Upload routes (NEW)
- `backend/src/routes/marketplace.ts` - Updated to handle images
- `backend/src/index.ts` - Registered upload routes

**Frontend**:
- `frontend/src/types/marketplace.ts` - Added `images` field
- `frontend/src/services/upload.ts` - Upload service (NEW)
- `frontend/src/components/common/ImagePicker.tsx` - Image picker component (NEW)
- `frontend/src/pages/CreateListingPage.tsx` - Integrated ImagePicker (UPDATED)
- `frontend/src/pages/EditListingPage.tsx` - Integrated ImagePicker (UPDATED)
- `frontend/src/pages/ListingDetailPage.tsx` - Image gallery viewer (UPDATED)
- `frontend/src/pages/MarketplacePage.tsx` - Thumbnail display (UPDATED)
- `frontend/src/pages/MyListingsPage.tsx` - Thumbnail display (UPDATED)

**Project**:
- `.gitignore` - Excluded uploads directory

### Where to Find Image Upload UI

| Page | Route | What You'll See |
|------|-------|-----------------|
| Create Listing | `/marketplace/create` | ImagePicker component below location field |
| Edit Listing | `/marketplace/:id/edit` | ImagePicker with existing images loaded |
| Listing Detail | `/marketplace/:id` | Full image gallery with navigation |
| Marketplace | `/marketplace` | Image thumbnails on listing cards |
| My Listings | `/marketplace/my-listings` | Image thumbnails on user's listings |

For questions or issues, refer to the troubleshooting section or check the codebase comments.

---

**Last Updated**: 2026-01-28
**Version**: 1.0.0
**Status**: ✅ Fully Implemented & UI Integrated
