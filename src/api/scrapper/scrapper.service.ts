import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CountyRepository } from '../../repositories/county.repository';
import { In } from 'typeorm';
import { County } from '../../entities/county.entity';
import Stripe from 'stripe';
import { AwsService } from '../../aws/aws.service';

@Injectable()
export class ScrapperService {
  private stripe: Stripe;

  constructor(
    private readonly httpService: HttpService,
    private readonly countyRepository: CountyRepository,
    private readonly s3service: AwsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async getZillowUrls() {
    // check active subscriptions
    const subscriptions = await this.stripe.subscriptions.list({
      status: 'active',
    });
    if (!subscriptions) {
      return;
    }

    const priceIds = [
      ...new Set(
        subscriptions.data.flatMap((subscription) =>
          subscription.items.data.map((item) => item.price.id),
        ),
      ),
    ];

    const counties: County[] = await this.countyRepository.find({
      where: { priceId: In(priceIds) },
    });
    if (counties.length === 0) {
      throw new HttpException('No county found', HttpStatus.BAD_REQUEST);
    }
    // Create an array of objects with both countyId and zillowLink
    const zillowData = counties
      .flatMap((county) =>
        county.zillowLinks.map((link) => ({
          countyId: county.id,
          zillowLink: link,
        })),
      )
      .filter((item) => item.zillowLink != null);

    return zillowData;
  }
}
