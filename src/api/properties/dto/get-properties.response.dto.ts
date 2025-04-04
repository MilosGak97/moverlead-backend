import {ApiExtraModels, ApiProperty} from "@nestjs/swagger";
import {IsArray, IsNotEmpty, IsNumber} from "class-validator";
import {GetPropertyObjectDto} from "./get-property.object.dto";
import {Type} from "class-transformer";

@ApiExtraModels(GetPropertyObjectDto)
export class GetPropertiesResponseDto {
    @ApiProperty({type: [GetPropertyObjectDto]})
    @IsNotEmpty()
    @IsArray()
    result: GetPropertyObjectDto[];

    @ApiProperty()
    @IsNumber()
    @Type((): NumberConstructor=> Number)
    totalRecords: number;

    @ApiProperty()
    @IsNumber()
    @Type((): NumberConstructor=> Number)
    currentPage: number;

    @ApiProperty()
    @IsNumber()
    @Type((): NumberConstructor=> Number)
    totalPages: number;

    @ApiProperty()
    @IsNumber()
    @Type((): NumberConstructor=> Number)
    limit: number;

    @ApiProperty()
    @IsNumber()
    @Type((): NumberConstructor=> Number)
    offset: number;
}