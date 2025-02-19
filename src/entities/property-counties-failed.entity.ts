import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsNotEmpty } from 'class-validator';

@Entity('property-counties-failed')
export class PropertyCountiesFailed {
  @ApiProperty({ required: true })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @Column()
  county: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @Column()
  state: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @Column()
  zpid: string;

  @ApiProperty({ required: true })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ required: true })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
