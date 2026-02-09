import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadService } from './upload';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('uploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadImage', () => {
    it('should upload a single image successfully', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ imageUrl: '/uploads/test.jpg', message: 'Success' }),
      });

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = await uploadService.uploadImage(file);

      expect(result).toBe('/uploads/test.jpg');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/upload/image'),
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      await expect(uploadService.uploadImage(file)).rejects.toThrow('Not authenticated');
    });

    it('should throw error on upload failure', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Upload failed' }),
      });

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      await expect(uploadService.uploadImage(file)).rejects.toThrow('Upload failed');
    });

    it('should use default error message when no message provided', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      await expect(uploadService.uploadImage(file)).rejects.toThrow('Failed to upload image');
    });
  });

  describe('uploadImages', () => {
    it('should upload multiple images successfully', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ imageUrls: ['/uploads/1.jpg', '/uploads/2.jpg'], message: 'Success' }),
      });

      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
      ];
      const result = await uploadService.uploadImages(files);

      expect(result).toEqual(['/uploads/1.jpg', '/uploads/2.jpg']);
    });

    it('should throw error when no files provided', async () => {
      await expect(uploadService.uploadImages([])).rejects.toThrow('No files provided');
    });

    it('should throw error when more than 5 files provided', async () => {
      const files = Array(6).fill(null).map((_, i) => 
        new File(['test'], `test${i}.jpg`, { type: 'image/jpeg' })
      );
      await expect(uploadService.uploadImages(files)).rejects.toThrow('Maximum 5 images allowed');
    });

    it('should throw error when not authenticated', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      await expect(uploadService.uploadImages(files)).rejects.toThrow('Not authenticated');
    });

    it('should throw error on upload failure', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Upload failed' }),
      });

      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      await expect(uploadService.uploadImages(files)).rejects.toThrow('Upload failed');
    });
  });

  describe('getImageUrl', () => {
    it('should return absolute URL unchanged', () => {
      expect(uploadService.getImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
      expect(uploadService.getImageUrl('http://example.com/image.jpg')).toBe('http://example.com/image.jpg');
    });

    it('should prepend base URL to relative path starting with /', () => {
      const result = uploadService.getImageUrl('/uploads/image.jpg');
      expect(result).toContain('/uploads/image.jpg');
    });

    it('should prepend base URL with slash to relative path not starting with /', () => {
      const result = uploadService.getImageUrl('uploads/image.jpg');
      expect(result).toContain('/uploads/image.jpg');
    });
  });

  describe('parseImages', () => {
    it('should return empty array for null input', () => {
      expect(uploadService.parseImages(null)).toEqual([]);
    });

    it('should parse valid JSON array', () => {
      expect(uploadService.parseImages('["img1.jpg", "img2.jpg"]')).toEqual(['img1.jpg', 'img2.jpg']);
    });

    it('should return empty array for invalid JSON', () => {
      expect(uploadService.parseImages('invalid json')).toEqual([]);
    });

    it('should return empty array for non-array JSON', () => {
      expect(uploadService.parseImages('{"key": "value"}')).toEqual([]);
    });
  });

  describe('getListingImageUrls', () => {
    it('should return full URLs for all images', () => {
      const result = uploadService.getListingImageUrls('["/uploads/1.jpg", "/uploads/2.jpg"]');
      expect(result.length).toBe(2);
      expect(result[0]).toContain('/uploads/1.jpg');
      expect(result[1]).toContain('/uploads/2.jpg');
    });

    it('should return empty array for null input', () => {
      expect(uploadService.getListingImageUrls(null)).toEqual([]);
    });
  });
});
