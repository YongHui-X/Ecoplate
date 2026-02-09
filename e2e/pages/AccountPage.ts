/**
 * Account/Profile Page Object
 */

import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage';
import { sleep } from '../helpers/wait';

export class AccountPage extends BasePage {
  protected path = '/account';

  // Element locators
  private locators = {
    // Page elements
    pageTitle: By.css('h1, h2'),

    // Profile info
    profileSection: By.css('.profile-section, .account-info, [data-testid="profile"]'),
    userName: By.css('.user-name, .profile-name, [data-testid="user-name"]'),
    userEmail: By.css('.user-email, .profile-email, [data-testid="user-email"]'),
    userAvatar: By.css('.avatar, img[alt*="avatar"], img[alt*="profile"]'),

    // Edit profile form
    editButton: By.css('button:contains("Edit"), a:contains("Edit Profile"), [data-testid="edit-profile"]'),
    nameInput: By.css('input[name="name"]'),
    emailInput: By.css('input[name="email"]'),
    locationInput: By.css('input[name="location"], input[name="userLocation"]'),
    saveButton: By.css('button[type="submit"], button:contains("Save")'),
    cancelButton: By.css('button:contains("Cancel")'),

    // Settings sections
    settingsSection: By.css('.settings-section, [data-testid="settings"]'),
    notificationSettings: By.css('.notification-settings, [data-testid="notifications"]'),
    privacySettings: By.css('.privacy-settings, [data-testid="privacy"]'),

    // Logout
    logoutButton: By.css('button:contains("Log out"), button:contains("Logout"), a:contains("Log out"), [data-testid="logout"]'),

    // Delete account
    deleteAccountButton: By.css('button:contains("Delete Account"), [data-testid="delete-account"]'),
    confirmDeleteButton: By.css('button:contains("Confirm"), button:contains("Delete")'),

    // Messages
    successMessage: By.css('.success, .success-message, [role="alert"].success'),
    errorMessage: By.css('.error, .error-message, [role="alert"].error'),
  };

  /**
   * Check if page is loaded
   */
  async isPageLoaded(): Promise<boolean> {
    const hasProfile = await this.exists(this.locators.profileSection);
    const hasName = await this.exists(this.locators.userName);
    return hasProfile || hasName;
  }

  /**
   * Get user name
   */
  async getUserName(): Promise<string> {
    return this.getText(this.locators.userName);
  }

  /**
   * Get user email
   */
  async getUserEmail(): Promise<string> {
    return this.getText(this.locators.userEmail);
  }

  /**
   * Click edit profile button
   */
  async clickEditProfile(): Promise<void> {
    await this.click(this.locators.editButton);
    await sleep(500);
  }

  /**
   * Update name
   */
  async updateName(name: string): Promise<void> {
    await this.type(this.locators.nameInput, name);
  }

  /**
   * Update location
   */
  async updateLocation(location: string): Promise<void> {
    await this.type(this.locators.locationInput, location);
  }

  /**
   * Save profile changes
   */
  async saveProfile(): Promise<void> {
    await this.click(this.locators.saveButton);
    await sleep(1000);
  }

  /**
   * Cancel profile edit
   */
  async cancelEdit(): Promise<void> {
    await this.click(this.locators.cancelButton);
    await sleep(300);
  }

  /**
   * Update profile (complete flow)
   */
  async updateProfile(updates: {
    name?: string;
    location?: string;
  }): Promise<void> {
    await this.clickEditProfile();

    if (updates.name) {
      await this.updateName(updates.name);
    }

    if (updates.location) {
      await this.updateLocation(updates.location);
    }

    await this.saveProfile();
    await this.waitForLoading();
  }

  /**
   * Click logout button
   */
  async clickLogout(): Promise<void> {
    await this.click(this.locators.logoutButton);
    await sleep(1000);
  }

  /**
   * Logout and wait for redirect
   */
  async logoutAndWait(): Promise<void> {
    await this.clickLogout();
    await this.waitForLoading();
    // Should redirect to login or home
    await sleep(1000);
  }

  /**
   * Check if settings section is displayed
   */
  async isSettingsDisplayed(): Promise<boolean> {
    return this.isDisplayed(this.locators.settingsSection);
  }

  /**
   * Check if notification settings are available
   */
  async hasNotificationSettings(): Promise<boolean> {
    return this.exists(this.locators.notificationSettings);
  }

  /**
   * Check for success message after update
   */
  async hasSuccessMessage(): Promise<boolean> {
    const visible = await this.isDisplayed(this.locators.successMessage);
    if (visible) return true;

    // Also check for toast
    const toast = await this.waitForToast(3000);
    return toast !== null && !toast.toLowerCase().includes('error');
  }

  /**
   * Check for error message
   */
  async hasErrorMessage(): Promise<boolean> {
    return this.isDisplayed(this.locators.errorMessage);
  }

  /**
   * Get current profile values
   */
  async getProfileValues(): Promise<{
    name: string;
    email: string;
  }> {
    const name = await this.getUserName();
    const email = await this.getUserEmail();
    return { name, email };
  }
}

export const accountPage = new AccountPage();
