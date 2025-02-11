import { DataSource, Repository } from 'typeorm';
import { County } from '../entities/county.entity';
import { Injectable } from '@nestjs/common';
import { GetProductsDto } from '../api/properties/dto/get-products-dto';

@Injectable()
export class CountyRepository extends Repository<County> {
  constructor(private readonly dataSource: DataSource) {
    super(County, dataSource.createEntityManager());
  }

  async getProducts(getProductsDto: GetProductsDto) {
    return await this.find({ where: { state: getProductsDto.state } });
  }
}
