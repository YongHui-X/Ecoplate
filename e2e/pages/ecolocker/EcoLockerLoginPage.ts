import { By } from 'selenium-webdriver';
import { BasePage } from '../BasePage';

/**
 * EcoLocker now uses the main app's login page (/login)
 * since it's integrated into the main EcoPlate app
 */
export class EcoLockerLoginPage extends BasePage {
  private emailInput = By.css('input#email');
  private passwordInput = By.css('input#password');
  private submitButton = By.css('button[type="submit"]');
  private errorMessage = By.css('[role="alert"]');
  private pageTitle = By.xpath("//*[contains(text(), 'EcoPlate')]");

  async goto(): Promise<void> {
    // EcoLocker is now part of main app, use main login page
    await this.navigate('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.type(this.emailInput, email);
    await this.type(this.passwordInput, password);
    await this.click(this.submitButton);
  }

  async isPageTitleVisible(): Promise<boolean> {
    return this.isVisible(this.pageTitle);
  }

  async hasEcoPlateReference(): Promise<boolean> {
    return this.isVisible(this.pageTitle);
  }

  async isErrorVisible(): Promise<boolean> {
    return this.isVisible(this.errorMessage);
  }

  async getErrorMessage(): Promise<string> {
    return this.getText(this.errorMessage);
  }

  async isSubmitButtonVisible(): Promise<boolean> {
    return this.isVisible(this.submitButton);
  }
}
