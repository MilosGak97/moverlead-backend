import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { Request, Response } from 'express';
import { UserId } from '../auth/user-id.decorator';
import { CreateCheckoutSessionResponseDto } from './dto/create-checkout-session-response.dto';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('checkout-session/multiple')
  @ApiOkResponse({ type: CreateCheckoutSessionResponseDto })
  @ApiOperation({ summary: 'Create stripe checkout' })
  async createCheckoutSessionMultiple(
    @Body() createCheckoutSessionDto: CreateCheckoutSessionDto,
    @UserId() userId: string,
  ): Promise<CreateCheckoutSessionResponseDto> {
    console.log('Read User ID: ' + userId);

    console.log('Read Type User ID: ' + typeof userId);
    return await this.stripeService.createCheckoutSessionMultiple(
      createCheckoutSessionDto,
      userId,
    );
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook for stripe' })
  async handleStripeWebhook(@Req() req: Request, @Res() res: Response) {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      return res.status(400).json({
        message: 'Something went wrong with Stripe signature',
      });
    }
    try {
      // Pass the raw body (req.body) to Stripe for signature verification
      // Ensure raw body is correctly passed
      const rawBody = (req as any).rawBody || req.body;

      console.log('Raw body type:', typeof rawBody);
      await this.stripeService.processWebhook(rawBody, sig);
      //await this.stripeService.processWebhook(req.body, sig);
      res.status(200).send(rawBody);
    } catch (err) {
      console.error('Webhook processing error:', err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
}
