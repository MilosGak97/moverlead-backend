import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum } from 'class-validator';
import { State } from '../../../enums/state.enum';

export class StateResponseDto {
  @ApiProperty({ enum: State, isArray: true })
  @IsEnum(State, { each: true })
  @IsArray()
  states: State[];
}
