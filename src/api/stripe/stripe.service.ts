import {HttpException, HttpStatus, Injectable} from "@nestjs/common";
import Stripe from "stripe";
import {CreateCheckoutSessionDto} from "./dto/create-checkout-session.dto";
import {CountyRepository} from "../../repositories/county.repository";
import {UserRepository} from "../../repositories/user.repository";
import {CreateCheckoutSessionResponseDto} from "./dto/create-checkout-session-response.dto";
import {MyGateway} from "../../websocket/gateway";

@Injectable()
export class StripeService {
    private stripe: Stripe;

    constructor(
        private readonly countyRepository: CountyRepository,
        private readonly userRepository: UserRepository,
        private readonly gateway: MyGateway
    ) {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }

    async createCheckoutSessionMultiple(
        createCheckoutSessionDto: CreateCheckoutSessionDto,
        userId: string
    ): Promise<CreateCheckoutSessionResponseDto> {
        try {
            const user = await this.userRepository.findOne({where: {id: userId}});

            let stripeUserId = user?.stripeId;
            if (!stripeUserId) {
                const customer = await this.stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    metadata: {
                        userId: user.id,
                    },
                });
                stripeUserId = customer.id;

                user.stripeId = stripeUserId;
                await this.userRepository.save(user);
            }

            const lineItems = createCheckoutSessionDto.priceIds.map((priceId) => {
                return {
                    price: priceId,
                    quantity: 1,
                };
            });

            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                customer: stripeUserId,
                line_items: lineItems,
                mode: "subscription",
                success_url: `${process.env.SUCCESS_URL}`,
                cancel_url: `${process.env.CANCEL_URL}`,
            });

            return {
                checkoutUrl: session.url,
                checkoutId: session.id,
            };
        } catch (error) {
            console.error(error);
            throw new HttpException(
                "Stripe Error: Please contact your account manager",
                HttpStatus.BAD_REQUEST
            );
        }
    }

    async getActiveSubscriptions() {
        return this.stripe.subscriptions.list({
            status: "active",
        });
    }

    // this method gives us a priceIds in array of all active subscriptions from this user
    // then we can use priceIds to get counties
    async getAllUserSubscriptions(stripeCustomerId: string) {
        try {
            // Step 1: Get all subscriptions (with items)
            const allSubs = await this.stripe.subscriptions.list({
                customer: stripeCustomerId,
                status: 'all',
            });

            const countySubscriptions: {
                priceId: string;
                startDate: number;
                endDate: number;
            }[] = [];

            for (const sub of allSubs.data) {
                const startDate = sub.current_period_start;
                const endDate = sub.current_period_end;

                for (const item of sub.items.data) {
                    countySubscriptions.push({
                        priceId: item.price.id,
                        startDate,
                        endDate,
                    });
                }
            }

            return countySubscriptions;
        } catch (error) {
            console.error(`❌ Error fetching subscriptions for ${stripeCustomerId}:`, error);
            throw new Error('Could not fetch subscriptions from Stripe.');
        }
    }


    // AFTER THE PAYMENT IS MADE
    async processWebhook(payload: any, sig: string) {
        try {
            const event = this.stripe.webhooks.constructEvent(
                payload,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );

            if (event.type === "checkout.session.completed") {
                const session = event.data.object as Stripe.Checkout.Session;
                console.log("Payment Successful:", session);
                // Handle post-payment actions (e.g., create user subscription in DB)

                // Emit event to WebSocket clients
                this.gateway.sendPaymentSuccessEvent(session.subscription as string);
            }

            if (event.type === "checkout.session.expired") {
                const session = event.data.object as Stripe.Checkout.Session;
                console.log("Payment Session has expired:", session);
            }

            return {success: true};
        } catch (err) {
            console.error("Webhook Error:", err.message);
            throw new Error(`Webhook Error: ${err.message}`);
        }
    }
}
