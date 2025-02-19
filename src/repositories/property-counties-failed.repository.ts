import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PropertyCountiesFailed } from '../entities/property-counties-failed.entity';

@Injectable()
export class PropertyCountiesFailedRepository extends Repository<PropertyCountiesFailed> {
  constructor(private readonly dataSource: DataSource) {
    super(PropertyCountiesFailed, dataSource.createEntityManager());
  }

  async createRecord(county: string, state: string, zpid: string) {
    const record = new PropertyCountiesFailed();
    record.state = state;
    record.zpid = zpid;
    record.county = county;
    await this.save(record);
  }
}
