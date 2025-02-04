import { Controller, Get, Param, Query } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Get('products')
  async getAllProducts() {
    return await this.stripeService.getAllProducts();
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    return await this.stripeService.getProduct(id);
  }

  @Get('prices/:id')
  async getAllPrices(@Param('id') id: string) {
    return await this.stripeService.getAllPrices(id);
  }

  @Get('checkout-session/multiple')
  async createCheckoutSessionMultiple(@Query('priceIds') priceIds: string[]) {
    return await this.stripeService.createCheckoutSessionMultiple(priceIds);
  }

  @Get('checkout-session/single/:id')
  async createCheckoutSession(@Param('id') id: string) {
    return await this.stripeService.createCheckoutSession(id);
  }
}
