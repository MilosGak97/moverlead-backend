import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Property } from './property.entity';
import { Subscription } from './subscription.entity';
import { Payment } from './payment.entity';

@Entity('users')
export class User {
  @ApiProperty({ required: true })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Type(() => String)
  @Column({ name: 'first_name' })
  firstName: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Type(() => String)
  @Column({ name: 'last_name' })
  lastName: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Column({ name: 'stripe_id', nullable: true })
  stripeId: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Type(() => String)
  @Column({ name: 'company_name' })
  companyName: string;

  @ApiProperty({ required: true })
  @IsEmail()
  @IsNotEmpty()
  @Type(() => String)
  @Column()
  email: string;

  @ApiProperty({ required: true })
  @IsBoolean()
  @Type(() => Boolean)
  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Type(() => String)
  @Column()
  password: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Type(() => String)
  @Column({ name: 'email_passcode', nullable: true })
  emailPasscode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Type(() => String)
  @Column({ name: 'password_passcode', nullable: true })
  passwordPasscode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Type(() => String)
  @Column({ nullable: true })
  address: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Type(() => String)
  @Column({ nullable: true })
  address2: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Type(() => String)
  @Column({ nullable: true })
  city: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Type(() => String)
  @Column({ nullable: true })
  state: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Type(() => String)
  @Column({ nullable: true })
  zip: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Type(() => String)
  @Column({ nullable: true })
  website: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Type(() => String)
  @Column({ name: 'phone_number', nullable: true })
  phoneNumber: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ManyToMany((): typeof Property => Property, (property) => property.users)
  properties: Promise<Property[]>;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @OneToMany(
    (): typeof Subscription => Subscription,
    (subscription) => subscription.user,
    { nullable: true },
  )
  subscriptions: Subscription[];

  @ApiProperty({ required: false })
  @IsOptional()
  @OneToMany(
    (): typeof Payment => Payment,
    (payment: Payment) => payment.subscription,
    {
      nullable: true,
    },
  )
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
