import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class LoginPage extends BasePage {
  private emailInput = By.css('input[type="email"]');
  private passwordInput = By.css('input[type="password"]');
  private submitButton = By.css('button[type="submit"]');
  private registerLink = By.css('a[href="/register"]');
  private errorMessage = By.css('[role="alert"]');

  async goto(): Promise<void> {
    await this.navigate('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.type(this.emailInput, email);
    await this.type(this.passwordInput, password);
    await this.click(this.submitButton);
  }

  async getEmailValue(): Promise<string> {
    const element = await this.waitForElement(this.emailInput);
    return element.getAttribute('value');
  }

  async isRegisterLinkVisible(): Promise<boolean> {
    return this.isVisible(this.registerLink);
  }

  async clickRegisterLink(): Promise<void> {
    await this.click(this.registerLink);
  }

  async isErrorVisible(): Promise<boolean> {
    return this.isVisible(this.errorMessage);
  }

  async getErrorMessage(): Promise<string> {
    return this.getText(this.errorMessage);
  }
}
