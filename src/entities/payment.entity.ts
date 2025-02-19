import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { User } from './user.entity';
import { Subscription } from './subscription.entity';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../enums/payment-status.enum';

@Entity('payments')
export class Payment {
  @ApiProperty({ required: true })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ name: 'subscription_id' })
  subscriptionId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ name: 'stripe_checkout_session_id' })
  stripeCheckoutSessionId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ name: 'stripe_payment_id' })
  stripePaymentId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Type((): NumberConstructor => Number)
  @Column()
  amount: number;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column({ length: 3 })
  currency: string;

  @ApiProperty({ required: true, enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  @Column()
  status: PaymentStatus;

  @ApiProperty({ required: true })
  @ManyToOne((): typeof User => User, (user: User) => user.payments)
  user: User;

  @ApiProperty({ required: true })
  @ManyToOne(
    (): typeof Subscription => Subscription,
    (subscription: Subscription) => subscription.payments,
  )
  subscription: Subscription;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
