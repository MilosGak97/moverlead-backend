import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PriceIdsDto } from './dto/price-ids-dto';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async getAllProducts() {
    try {
      return await this.stripe.products.list();
    } catch (error) {
      console.log(error);
      throw new Error('Stripe Error: ' + error);
    }
  }

  async getProduct(productId: string) {
    try {
      return await this.stripe.products.retrieve(productId);
    } catch (error) {
      console.error(error);
      throw new Error(`Stripe Error: ${error.message}`);
    }
  }

  async getAllPrices(productId: string) {
    try {
      return await this.stripe.prices.list({ product: productId });
    } catch (error) {
      console.error(error);
      throw new Error(`Stripe Error: ${error.message}`);
    }
  }

  async createCheckoutSession(productId: string) {
    try {
      const prices = await this.stripe.prices.list({ product: productId });
      if (prices.data.length === 0) {
        throw new Error(`Stripe Error: ${productId} not found`);
      }
      const priceId = prices.data[0].id;

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.SUCCESS_URL}`, // Define this in .env
        cancel_url: `${process.env.CANCEL_URL}`, // Define this in .env
      });
      return { checkoutUrl: session.url }; // Return the checkout URL to redirect the user
    } catch (error) {
      console.error(error);
      throw new Error(`Stripe Error: ${error.message}`);
    }
  }

  async createCheckoutSessionMultiple(priceIdsDto: PriceIdsDto) {
    try {
      const lineItems = priceIdsDto.priceIds.map((priceId) => {
        return {
          price: priceId,
          quantity: 1,
        };
      });

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'subscription',
        success_url: `${process.env.SUCCESS_URL}`,
        cancel_url: `${process.env.CANCEL_URL}`,
        metadata: {
          // Custom metadata fields
          customer_tag: 'Bergen County Subscriber', // Example custom metadata
          tier: '1', // Custom tier or other data
          county: 'Bergen County, NJ', // County information or other product details
        },
      });

      return { checkoutUrl: session.url };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Stripe Error: Please contact your account manager',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // AFTER THE PAYMENT IS MADE
  async processWebhook(payload: any, sig: string) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Payment Successful:', session);

        // Handle post-payment actions (e.g., create user subscription in DB)
        await this.handleSuccessfulPayment(session);
      }

      return { success: true };
    } catch (err) {
      console.error('Webhook Error:', err.message);
      throw new Error(`Webhook Error: ${err.message}`);
    }
  }

  async handleSuccessfulPayment(session: Stripe.Checkout.Session) {
    const metadata = session.metadata; // Retrieve custom metadata

    console.log('Metadata:', metadata);

    // Check if session.subscription is a valid string
    const subscriptionId = session.subscription;

    if (typeof subscriptionId !== 'string') {
      throw new Error('Invalid subscription ID received.');
    }

    // Save subscription details to the database
    await this.createSubscription({
      customerEmail: session.customer_email,
      subscriptionId: subscriptionId, // Ensure it's a string
      metadata,
    });
  }

  async createSubscription(data: {
    customerEmail: string;
    subscriptionId: string;
    metadata: any;
  }) {
    // Save to database (example logic)
    console.log('Saving subscription to database:', data);
  }
}
