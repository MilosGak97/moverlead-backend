import {ApiProperty} from "@nestjs/swagger";
import {IsArray, IsNotEmpty} from "class-validator";

export class ListingsExportDto {
    @ApiProperty({isArray: true, required: true})
    @IsNotEmpty()
    @IsArray()
    ids: string[];
}