import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {PropertiesService} from "../properties/properties.service";
import {FillBrightdataDto} from "./dto/fill-brightdata-dto";

@Injectable()
export class HasdataService {
    private readonly logger = new Logger(HasdataService.name);

    constructor(
        private readonly propertiesService: PropertiesService,
    ) {}

    async hasdataEnrichmentTrigger(){
        const urls = await this.propertiesService.getEnrichmentUrls();
        if(!Array.isArray(urls) || urls.length == 0 || !urls){
            return null;
        }

        for(const item of urls){
            const raw = await this.sendRequest(item.url);
            if(raw.requestMetadata.status == "ok"){
                if (!raw.property.id) {
                    console.warn('Skipping record due to missing zpid:', raw);
                    continue;
                }
                const data: FillBrightdataDto = {
                    zpid: raw.property.id.toString(),
                    parcelId: raw.property.parcelNumber,
                    realtorName: raw.property.agentName,
                    realtorPhone: raw.property.agentPhoneNumber,
                    brokerageName: raw.property.brokerName,
                    brokeragePhone: raw.property.brokerPhoneNumber,
                    countyZillow: raw.property.county,
                    photoCount: raw.property.photo_count,
                    photos: Array.isArray(raw.property.photos)
                        ? raw.property.photos.filter((url) => url) // optional: removes any falsy values
                        : [],
                };

                await this.propertiesService.fillHasdata(data)
            }
        }
    }

    async sendRequest(propertyUrl: string): Promise<any> {
        const options = {
            method: 'GET',
            url: 'https://api.hasdata.com/scrape/zillow/property',
            params: {
                // Use the function parameter to specify the property URL:
                url: propertyUrl,
            },
            headers: {
                'x-api-key': process.env.HASDATA_API_KEY,
            },
        };

        try {
            const { data } = await axios.request(options);
            //this.logger.log(data);
            return data;
        } catch (error) {
            this.logger.error('Error during Axios request', error);
            throw error;
        }
    }
}
