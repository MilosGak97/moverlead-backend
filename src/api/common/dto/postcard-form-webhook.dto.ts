import {ApiProperty} from "@nestjs/swagger";
import {IsEmail, IsNotEmpty, IsString} from "class-validator";

export class PostcardFormWebhookDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    firstName: string

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    lastName: string

    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    email: string

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    phone: string

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    postcardId: string


    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    message: string;
}