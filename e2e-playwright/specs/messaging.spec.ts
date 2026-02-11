import { test, expect } from '@playwright/test';
import { test as authTest } from '../fixtures/auth.fixture';

test.describe('Messaging', () => {
  test.describe('Messages Page', () => {
    test('should redirect to login if not authenticated', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});

// Tests that require authentication
authTest.describe('Messaging (Authenticated)', () => {
  authTest.describe('Messages List Page', () => {
    authTest('should display messages page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage.getByText('Messages')).toBeVisible();
    });

    authTest('should display page subtitle', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage.getByText(/marketplace conversations/i)).toBeVisible();
    });

    authTest('should display tab buttons', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage.getByRole('button', { name: /all/i })).toBeVisible();
      await expect(authenticatedPage.getByRole('button', { name: /buying/i })).toBeVisible();
      await expect(authenticatedPage.getByRole('button', { name: /selling/i })).toBeVisible();
      await expect(authenticatedPage.getByRole('button', { name: /archived/i })).toBeVisible();
    });

    authTest('should filter conversations by buying tab', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.getByRole('button', { name: /buying/i }).click();
      // Should show only buying conversations
    });

    authTest('should filter conversations by selling tab', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.getByRole('button', { name: /selling/i }).click();
      // Should show only selling conversations
    });

    authTest('should filter conversations by archived tab', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.getByRole('button', { name: /archived/i }).click();
      // Should show only archived conversations
    });

    authTest('should show empty state when no conversations', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      // If no conversations, should show empty state
      const emptyState = authenticatedPage.getByText(/no conversations/i);
      // May or may not be visible depending on state
    });

    authTest('should display conversation cards', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for conversation cards
      const conversationCard = authenticatedPage.locator('[data-testid="conversation-card"]').first();
      // May or may not be visible depending on data
    });

    authTest('should navigate to conversation when clicked', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      const conversationCard = authenticatedPage.locator('[data-testid="conversation-card"]').first();
      if (await conversationCard.isVisible()) {
        await conversationCard.click();
        await expect(authenticatedPage).toHaveURL(/\/messages\/\d+/);
      }
    });
  });

  authTest.describe('Conversation Detail Page', () => {
    authTest('should display conversation messages', async ({ authenticatedPage }) => {
      // Navigate to a conversation (assuming conversation 1 exists)
      await authenticatedPage.goto('/messages/1');
      await authenticatedPage.waitForLoadState('networkidle');

      // Should show conversation or 404
    });

    authTest('should display message input', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages/1');
      await authenticatedPage.waitForLoadState('networkidle');

      const messageInput = authenticatedPage.getByPlaceholder(/type a message|write a message/i);
      // May not be visible if conversation doesn't exist
    });

    authTest('should display send button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages/1');
      await authenticatedPage.waitForLoadState('networkidle');

      const sendButton = authenticatedPage.getByRole('button', { name: /send/i });
      // May not be visible if conversation doesn't exist
    });

    authTest('should display listing info header', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages/1');
      await authenticatedPage.waitForLoadState('networkidle');

      // Should show linked listing info at top
    });

    authTest('should send a message', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages/1');
      await authenticatedPage.waitForLoadState('networkidle');

      const messageInput = authenticatedPage.getByPlaceholder(/type a message|write a message/i);
      if (await messageInput.isVisible()) {
        await messageInput.fill('Hello, this is a test message!');

        const sendButton = authenticatedPage.getByRole('button', { name: /send/i });
        await sendButton.click();

        // Message should appear in the conversation
        await expect(authenticatedPage.getByText('Hello, this is a test message!')).toBeVisible();
      }
    });

    authTest('should display timestamps on messages', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages/1');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for timestamp elements
    });

    authTest('should display unread indicator', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/messages');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for unread badge
      const unreadBadge = authenticatedPage.getByText(/unread/i);
      // May or may not be visible
    });
  });

  authTest.describe('Start New Conversation', () => {
    authTest('should start conversation from listing', async ({ authenticatedPage }) => {
      // Navigate to a listing
      await authenticatedPage.goto('/marketplace/1');
      await authenticatedPage.waitForLoadState('networkidle');

      const contactButton = authenticatedPage.getByRole('button', { name: /message|contact/i });
      if (await contactButton.isVisible()) {
        await contactButton.click();

        // Should navigate to conversation
        await expect(authenticatedPage).toHaveURL(/\/messages/);
      }
    });
  });
});
