import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PriceIdsDto } from './dto/price-ids-dto';
import { Request, Response } from 'express'; // Ensure this is correct

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

  @Post('checkout-session/multiple')
  async createCheckoutSessionMultiple(@Body() priceIds: PriceIdsDto) {
    return await this.stripeService.createCheckoutSessionMultiple(priceIds);
  }

  @Get('checkout-session/single/:id')
  async createCheckoutSession(@Param('id') id: string) {
    return await this.stripeService.createCheckoutSession(id);
  }

  @Post('webhook')
  async handleStripeWebhook(@Req() req: Request, @Res() res: Response) {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      return res.status(400).json({
        message: 'Something went wrong with Stripe signature',
      });
    }
    try {
      // Pass the raw body (req.body) to Stripe for signature verification
      const rawBody = req.body; // The body is raw here, not parsed
      await this.stripeService.processWebhook(rawBody, sig);
      //await this.stripeService.processWebhook(req.body, sig);
      res.status(200).send('Received');
    } catch (err) {
      console.error('Webhook processing error:', err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
}
