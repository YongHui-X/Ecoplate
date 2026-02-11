import { By } from 'selenium-webdriver';
import { BasePage } from '../BasePage';

export class EcoLockerLoginPage extends BasePage {
  private emailInput = By.css('input#email');
  private passwordInput = By.css('input#password');
  private submitButton = By.css('button[type="submit"]');
  private errorMessage = By.css('[role="alert"]');
  private pageTitle = By.xpath("//h1[contains(text(), 'EcoLocker')]");
  private ecoPlateRef = By.xpath("//*[contains(text(), 'EcoPlate')]");

  async goto(): Promise<void> {
    await this.navigate('/ecolocker/login');
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
    return this.isVisible(this.ecoPlateRef);
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
