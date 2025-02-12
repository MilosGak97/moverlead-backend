import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PriceIdsDto } from './dto/price-ids-dto';
import { CountyRepository } from '../../repositories/county.repository';
import { UserRepository } from '../../repositories/user.repository';
import { CheckoutResponseDto } from './dto/checkout-response.dto';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private readonly countyRepository: CountyRepository,
    private readonly userRepository: UserRepository,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async createCheckoutSessionMultiple(
    priceIdsDto: PriceIdsDto,
    userId: string,
  ): Promise<CheckoutResponseDto> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });

      let userStripeId = user?.stripeId;
      if (!userStripeId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          metadata: {
            userId: user.id,
          },
        });
        userStripeId = customer.id;

        user.stripeId = userStripeId;
        await this.userRepository.save(user);
      }

      const lineItems = priceIdsDto.priceIds.map((priceId) => {
        return {
          price: priceId,
          quantity: 1,
        };
      });

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer: userStripeId,
        line_items: lineItems,
        mode: 'subscription',
        success_url: `${process.env.SUCCESS_URL}`,
        cancel_url: `${process.env.CANCEL_URL}`,
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

      if (event.type === 'checkout.session.expired') {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Payment Session has expired:', session);
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
