import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageService } from './messages';

// Mock the api module
vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { api } from './api';

describe('messageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConversations', () => {
    it('should fetch all conversations', async () => {
      const mockConversations = [
        { id: 1, listingId: 1, role: 'buying' },
        { id: 2, listingId: 2, role: 'selling' },
      ];
      vi.mocked(api.get).mockResolvedValueOnce(mockConversations);

      const result = await messageService.getConversations();

      expect(api.get).toHaveBeenCalledWith('/marketplace/conversations');
      expect(result).toEqual(mockConversations);
    });
  });

  describe('getConversation', () => {
    it('should fetch a single conversation by ID', async () => {
      const mockConversation = {
        id: 1,
        listingId: 1,
        messages: [],
      };
      vi.mocked(api.get).mockResolvedValueOnce(mockConversation);

      const result = await messageService.getConversation(1);

      expect(api.get).toHaveBeenCalledWith('/marketplace/conversations/1');
      expect(result).toEqual(mockConversation);
    });
  });

  describe('getOrCreateConversationForListing', () => {
    it('should get or create conversation for a listing', async () => {
      const mockConversation = { id: 1, listingId: 5 };
      vi.mocked(api.get).mockResolvedValueOnce(mockConversation);

      const result = await messageService.getOrCreateConversationForListing(5);

      expect(api.get).toHaveBeenCalledWith('/marketplace/conversations/listing/5');
      expect(result).toEqual(mockConversation);
    });
  });

  describe('sendMessage', () => {
    it('should send a message to a conversation', async () => {
      const mockMessage = {
        id: 1,
        conversationId: 1,
        messageText: 'Hello!',
        userId: 1,
        isRead: false,
        createdAt: '2024-01-15T10:00:00Z',
      };
      vi.mocked(api.post).mockResolvedValueOnce(mockMessage);

      const result = await messageService.sendMessage(1, 'Hello!');

      expect(api.post).toHaveBeenCalledWith('/marketplace/messages', {
        conversationId: 1,
        messageText: 'Hello!',
      });
      expect(result).toEqual(mockMessage);
    });
  });

  describe('sendMessageToListing', () => {
    it('should send a message to a listing', async () => {
      const mockMessage = {
        id: 1,
        conversationId: 1,
        messageText: 'Is this available?',
        userId: 1,
        isRead: false,
        createdAt: '2024-01-15T10:00:00Z',
      };
      vi.mocked(api.post).mockResolvedValueOnce(mockMessage);

      const result = await messageService.sendMessageToListing(5, 'Is this available?');

      expect(api.post).toHaveBeenCalledWith('/marketplace/messages', {
        listingId: 5,
        messageText: 'Is this available?',
      });
      expect(result).toEqual(mockMessage);
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce(undefined);

      await messageService.markAsRead(1);

      expect(api.patch).toHaveBeenCalledWith('/marketplace/messages/read', {
        conversationId: 1,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread message count', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ count: 5 });

      const result = await messageService.getUnreadCount();

      expect(api.get).toHaveBeenCalledWith('/marketplace/messages/unread-count');
      expect(result).toEqual({ count: 5 });
    });
  });
});
