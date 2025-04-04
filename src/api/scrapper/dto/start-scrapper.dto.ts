import {ApiProperty} from "@nestjs/swagger";
import {IsNotEmpty} from "class-validator";

export class StartScrapperDto{
    @ApiProperty()
    @IsNotEmpty()
    initialScrapper: boolean;
}