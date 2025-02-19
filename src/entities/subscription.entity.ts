import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { User } from './user.entity';
import { County } from './county.entity';
import { Type } from 'class-transformer';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { Payment } from './payment.entity';

@Entity('subscriptions')
export class Subscription {
  @ApiProperty({ required: true })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ name: 'county_id' })
  countyId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ name: 'stripe_subscription_id' })
  stripeSubscriptionId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ name: 'stripe_product_id' })
  stripeProductId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ name: 'stripe_price_id' })
  stripePriceId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Type((): NumberConstructor => Number)
  @Column()
  amount: number;

  @ApiProperty({ required: true })
  @IsDate()
  @IsNotEmpty()
  @Type((): DateConstructor => Date)
  @Column({ name: 'current_period_start' })
  periodStart: Date;

  @ApiProperty({ required: true })
  @IsDate()
  @IsNotEmpty()
  @Type((): DateConstructor => Date)
  @Column({ name: 'current_period_end' })
  periodEnd: Date;

  @ApiProperty({ required: true, enum: SubscriptionStatus })
  @IsEnum(SubscriptionStatus)
  @IsNotEmpty()
  @Column()
  status: SubscriptionStatus;

  @ApiProperty({ required: true })
  @ManyToOne((): typeof User => User, (user: User) => user.subscriptions)
  user: User;

  @ApiProperty({ required: true })
  @ManyToOne(
    (): typeof County => County,
    (county: County) => county.subscriptions,
  )
  county: County;

  @ApiProperty({ required: false })
  @OneToMany(() => Payment, (payment) => payment.subscription)
  payments: Payment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
