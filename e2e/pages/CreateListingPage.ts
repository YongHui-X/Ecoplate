import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class CreateListingPage extends BasePage {
  private titleInput = By.css('input[name="title"], input#title');
  private descriptionInput = By.css('textarea[name="description"], textarea#description');
  private priceInput = By.css('input[name="price"], input#price');
  private quantityInput = By.css('input[name="quantity"], input#quantity');
  private categorySelect = By.css('select[name="category"], [data-testid="category-select"]');
  private expiryDateInput = By.css('input[type="date"]');
  private submitButton = By.css('button[type="submit"]');
  private cancelButton = By.xpath("//button[contains(text(), 'Cancel')]");
  private imageUpload = By.css('input[type="file"]');

  async goto(): Promise<void> {
    await this.navigate('/marketplace/create');
  }

  async fillListingForm(data: {
    title: string;
    description: string;
    price: string;
    quantity?: string;
    expiryDate?: string;
  }): Promise<void> {
    await this.type(this.titleInput, data.title);
    await this.type(this.descriptionInput, data.description);
    await this.type(this.priceInput, data.price);
    if (data.quantity) {
      await this.type(this.quantityInput, data.quantity);
    }
    if (data.expiryDate) {
      await this.type(this.expiryDateInput, data.expiryDate);
    }
  }

  async submitListing(): Promise<void> {
    await this.click(this.submitButton);
  }

  async cancel(): Promise<void> {
    await this.click(this.cancelButton);
  }

  async isTitleInputVisible(): Promise<boolean> {
    return this.isVisible(this.titleInput);
  }
}
