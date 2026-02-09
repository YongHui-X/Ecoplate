/**
 * Messages Page Object
 */

import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage';
import { sleep } from '../helpers/wait';

export class MessagesPage extends BasePage {
  protected path = '/messages';

  // Element locators
  private locators = {
    // Page elements
    pageTitle: By.css('h1, h2'),

    // Conversations list
    conversationsList: By.css('.conversations-list, .message-list, [data-testid="conversations"]'),
    conversationItem: By.css('.conversation-item, .message-item, [data-testid="conversation"]'),

    // Conversation details
    conversationTitle: By.css('.conversation-title, .contact-name, h3'),
    lastMessage: By.css('.last-message, .message-preview'),
    timestamp: By.css('.timestamp, .message-time'),
    unreadBadge: By.css('.unread-badge, .unread-count, [data-testid="unread"]'),

    // Chat view
    chatView: By.css('.chat-view, .message-thread, [data-testid="chat"]'),
    messageInput: By.css('input[type="text"], textarea[name="message"], [data-testid="message-input"]'),
    sendButton: By.css('button:contains("Send"), button[type="submit"], [data-testid="send-button"]'),
    chatMessages: By.css('.chat-messages, .message-list'),
    chatMessage: By.css('.chat-message, .message-bubble'),

    // Back button
    backButton: By.css('button:contains("Back"), a[aria-label="Back"], [data-testid="back"]'),

    // Empty state
    emptyState: By.css('.empty-state, .no-messages, [data-testid="empty-state"]'),
    emptyStateMessage: By.css('.empty-state p, .no-messages-text'),

    // Listing info in conversation
    listingInfo: By.css('.listing-info, .conversation-listing, [data-testid="listing-info"]'),
  };

  /**
   * Check if page is loaded
   */
  async isPageLoaded(): Promise<boolean> {
    const hasConversations = await this.exists(this.locators.conversationsList);
    const hasEmpty = await this.exists(this.locators.emptyState);
    const hasChat = await this.exists(this.locators.chatView);
    return hasConversations || hasEmpty || hasChat;
  }

  /**
   * Get conversation count
   */
  async getConversationCount(): Promise<number> {
    return this.getElementCount(this.locators.conversationItem);
  }

  /**
   * Check if empty state is displayed
   */
  async isEmptyStateDisplayed(): Promise<boolean> {
    return this.isDisplayed(this.locators.emptyState);
  }

  /**
   * Get empty state message
   */
  async getEmptyStateMessage(): Promise<string> {
    return this.getText(this.locators.emptyStateMessage);
  }

  /**
   * Click on a conversation by index
   */
  async openConversation(index: number = 0): Promise<void> {
    const conversations = await this.findElements(this.locators.conversationItem);
    if (index < conversations.length) {
      await conversations[index].click();
      await this.waitForLoading();
    } else {
      throw new Error(`Conversation at index ${index} not found`);
    }
  }

  /**
   * Check if chat view is displayed
   */
  async isChatViewDisplayed(): Promise<boolean> {
    return this.isDisplayed(this.locators.chatView);
  }

  /**
   * Get message count in current chat
   */
  async getMessageCount(): Promise<number> {
    return this.getElementCount(this.locators.chatMessage);
  }

  /**
   * Send a message
   */
  async sendMessage(message: string): Promise<void> {
    await this.type(this.locators.messageInput, message);
    await this.click(this.locators.sendButton);
    await sleep(1000); // Wait for message to send
  }

  /**
   * Get conversation details at index
   */
  async getConversationDetails(index: number = 0): Promise<{
    title: string;
    lastMessage?: string;
    timestamp?: string;
    hasUnread: boolean;
  }> {
    const conversations = await this.findElements(this.locators.conversationItem);
    if (index >= conversations.length) {
      throw new Error(`Conversation at index ${index} not found`);
    }

    const conversation = conversations[index];
    const title = await conversation.findElement(this.locators.conversationTitle).getText().catch(() => '');
    const lastMessage = await conversation.findElement(this.locators.lastMessage).getText().catch(() => undefined);
    const timestamp = await conversation.findElement(this.locators.timestamp).getText().catch(() => undefined);

    // Check for unread badge
    let hasUnread = false;
    try {
      const unreadBadge = await conversation.findElement(this.locators.unreadBadge);
      hasUnread = await unreadBadge.isDisplayed();
    } catch {
      hasUnread = false;
    }

    return { title, lastMessage, timestamp, hasUnread };
  }

  /**
   * Go back to conversations list
   */
  async goBackToList(): Promise<void> {
    await this.click(this.locators.backButton);
    await this.waitForLoading();
  }

  /**
   * Check if there are unread messages
   */
  async hasUnreadMessages(): Promise<boolean> {
    const conversations = await this.findElements(this.locators.conversationItem);

    for (const conversation of conversations) {
      try {
        const unreadBadge = await conversation.findElement(this.locators.unreadBadge);
        if (await unreadBadge.isDisplayed()) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Get listing info from current conversation
   */
  async getListingInfo(): Promise<string> {
    try {
      return this.getText(this.locators.listingInfo);
    } catch {
      return '';
    }
  }
}

export const messagesPage = new MessagesPage();
