import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class RegisterPage extends BasePage {
  private nameInput = By.css('input#name');
  private emailInput = By.css('input[type="email"]');
  private passwordInput = By.css('input#password');
  private confirmPasswordInput = By.css('input#confirmPassword');
  private locationInput = By.css('input#userLocation');
  private submitButton = By.css('button[type="submit"]');
  private loginLink = By.css('a[href="/login"]');
  private avatarButtons = By.css('[class*="grid"] button');

  async goto(): Promise<void> {
    await this.navigate('/register');
  }

  async register(name: string, email: string, password: string, location?: string): Promise<void> {
    await this.type(this.nameInput, name);
    await this.type(this.emailInput, email);
    await this.type(this.passwordInput, password);
    await this.type(this.confirmPasswordInput, password);
    if (location) {
      await this.type(this.locationInput, location);
    }
    await this.click(this.submitButton);
  }

  async selectAvatar(index: number): Promise<void> {
    const avatars = await this.driver.findElements(this.avatarButtons);
    if (avatars[index]) {
      await avatars[index].click();
    }
  }

  async isLoginLinkVisible(): Promise<boolean> {
    return this.isVisible(this.loginLink);
  }

  async clickLoginLink(): Promise<void> {
    await this.click(this.loginLink);
  }
}
