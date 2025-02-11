import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { State } from '../enums/state.enum';
import { Type } from 'class-transformer';
import { Subscription } from './subscription.entity';

@Entity('counties')
export class County {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column()
  name: string;

  @ApiProperty({ required: true, enum: State })
  @IsEnum(State)
  @IsNotEmpty()
  @Column()
  state: State;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Column({ name: 'product_id', nullable: true })
  productId: string; // prod_RiK83a7Vlhb8sf

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Column({ name: 'price_id', nullable: true })
  priceId: string; //price_1QotUeP0ONo4d0belYeNEfym

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Type((): NumberConstructor => Number)
  @Column({ name: 'amount', nullable: true })
  amount: number;

  @ApiProperty({ required: false })
  @OneToMany(
    (): typeof Subscription => Subscription,
    (subscription) => subscription.county,
    {
      nullable: true,
    },
  )
  subscriptions: Subscription[];

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
