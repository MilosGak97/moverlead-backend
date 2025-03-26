import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  UpdateItemCommandInput,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { StartedScrapperDto } from './dto/started-scrapper.dto';
import { UploadResultsDto } from './dto/upload-results.dto';
import { ScrappingErrorDto } from './dto/scrapping-error.dto';
import { FailedScrapperResponseDto } from './dto/failed-scrapper-response.dto';

@Injectable()
export class AwsService {
  private s3Client: S3Client;
  private dynamoDbClient: DynamoDBClient;
  private dynamoTableName = process.env.AWS_DYNAMODB_TABLE_NAME; // Set in your environment

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    this.dynamoDbClient = new DynamoDBClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadResults(uploadResultsDto: UploadResultsDto): Promise<string> {
    const { key, county_id, results } = uploadResultsDto;

    // Create a tagging string in the format: key1=value1&key2=value2
    // Note: Values are URL-encoded to ensure proper transmission
    const tagging = `status=ready&date=${encodeURIComponent(
      new Date().toISOString(),
    )}&county=${county_id}`;

    // Prepare the S3 PutObject parameters, using Tagging instead of Metadata
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME, // Ensure this is set in your environment variables
      Key: key,
      Body: JSON.stringify(results, null, 2),
      ContentType: 'application/json',
      Tagging: tagging,
    };

    try {
      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);
      console.log(`Results written to s3://${params.Bucket}/${key}`);
      return `Results written to s3://${params.Bucket}/${key}`;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error('Could not upload results to S3');
    }
  }

  async scrappingError(scrappingErrorDto: ScrappingErrorDto): Promise<string> {
    const { key, countyId, error } = scrappingErrorDto;

    // Create a tagging string in the format: key1=value1&key2=value2
    // Note: Values are URL-encoded to ensure proper transmission
    const date = new Date().toISOString();
    const tagging = `date=${date}&county=${countyId}&key=${key}`;

    // Prepend "error/" to store the file in the error folder
    const errorKey = `error/${key}_${date}`;

    const body = this.safeStringify(error);

    // Prepare the S3 PutObject parameters, using Tagging instead of Metadata
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME, // Ensure this is set in your environment variables
      Key: errorKey,
      Body: body,
      ContentType: 'application/json',
      Tagging: tagging,
    };

    try {
      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);
      console.log(`Errors written to s3://${params.Bucket}/${key}`);
      return `Results written to s3://${params.Bucket}/${key}`;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error('Could not upload results to S3');
    }
  }

  async startedScrapper(
    startedScrapperDto: StartedScrapperDto,
  ): Promise<string> {
    const { key, countyId, zillowUrl } = startedScrapperDto;

    // Write metadata to DynamoDB for real-time querying
    const dynamoParams = {
      TableName: this.dynamoTableName,
      Item: {
        s3Key: { S: key },
        status: { S: 'running' },
        county: { S: countyId },
        date: { S: new Date().toISOString() },
        ml_read: { BOOL: false },
        test_read: { BOOL: false },
        attempt_count: { N: '1' },
        zillow_url: { S: zillowUrl },
      },
    };
    const putItemCommand = new PutItemCommand(dynamoParams);
    await this.dynamoDbClient.send(putItemCommand);
    console.log(`Metadata for ${key} saved in DynamoDB`);
    return 'Started scrapper attempt is saved in DynamoDB.';
  }

  async successfulScrapper(s3Key: string): Promise<string> {
    // Parameters for getting the item
    const getItemParams = {
      TableName: this.dynamoTableName,
      Key: {
        s3Key: { S: s3Key },
      },
    };

    try {
      // Check if the item exists
      const getItemCommand = new GetItemCommand(getItemParams);
      const getResult = await this.dynamoDbClient.send(getItemCommand);

      if (!getResult.Item) {
        console.log(`Item with key ${s3Key} not found.`);
        return `Item with key ${s3Key} not found.`;
      }

      // Update the status from "running" to "ready"
      const updateParams: UpdateItemCommandInput = {
        TableName: this.dynamoTableName,
        Key: {
          s3Key: { S: s3Key },
        },
        UpdateExpression: 'SET #st = :status',
        ExpressionAttributeNames: {
          '#st': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'ready' },
        },
        ReturnValues: 'UPDATED_NEW' as const,
      };

      const updateCommand = new UpdateItemCommand(updateParams);
      await this.dynamoDbClient.send(updateCommand);

      console.log(`Attempt count for ${s3Key} was successful`);
      return `Attempt count for ${s3Key} was successful`;
    } catch (error: any) {
      console.error('Error updating attempt count:', error);
      throw error;
    }
  }

  async failedScrapper(s3Key: string): Promise<string> {
    // Parameters for getting the item
    const getItemParams = {
      TableName: this.dynamoTableName,
      Key: {
        s3Key: { S: s3Key },
      },
    };

    try {
      // Check if the item exists
      const getItemCommand = new GetItemCommand(getItemParams);
      const getResult = await this.dynamoDbClient.send(getItemCommand);

      if (!getResult.Item) {
        console.log(`Item with key ${s3Key} not found.`);
        return `Item with key ${s3Key} not found.`;
      }

      // Update the status from "running" to "ready"
      const updateParams: UpdateItemCommandInput = {
        TableName: this.dynamoTableName,
        Key: {
          s3Key: { S: s3Key },
        },
        UpdateExpression: 'SET #st = :status',
        ExpressionAttributeNames: {
          '#st': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'failed' },
        },
        ReturnValues: 'UPDATED_NEW' as const,
      };

      const updateCommand = new UpdateItemCommand(updateParams);
      await this.dynamoDbClient.send(updateCommand);

      console.log(`Attempt count for ${s3Key} was successful`);
      return `Attempt count for ${s3Key} was successful`;
    } catch (error: any) {
      console.error('Error updating attempt count:', error);
      throw error;
    }
  }

  async updateAttemptCount(s3Key: string): Promise<string> {
    // Parameters for getting the item
    const getItemParams = {
      TableName: this.dynamoTableName,
      Key: {
        s3Key: { S: s3Key },
      },
    };

    try {
      // Check if the item exists
      const getItemCommand = new GetItemCommand(getItemParams);
      const getResult = await this.dynamoDbClient.send(getItemCommand);

      if (!getResult.Item) {
        console.log(`Item with key ${s3Key} not found.`);
        return `Item with key ${s3Key} not found.`;
      }

      // Use the ADD operation to increment attempt_count by 1
      const updateParams: UpdateItemCommandInput = {
        TableName: this.dynamoTableName,
        Key: {
          s3Key: { S: s3Key },
        },
        UpdateExpression: 'ADD attempt_count :inc',
        ExpressionAttributeValues: {
          ':inc': { N: '1' },
        },
        ReturnValues: 'UPDATED_NEW' as const,
      };

      const updateCommand = new UpdateItemCommand(updateParams);
      await this.dynamoDbClient.send(updateCommand);

      console.log(`Attempt count for ${s3Key} incremented by 1`);
      return `Attempt count for ${s3Key} incremented by 1`;
    } catch (error: any) {
      console.error('Error updating attempt count:', error);
      throw error;
    }
  }

  async checkFailedScrapper(): Promise<FailedScrapperResponseDto[] | []>{
    try {
      // Parameters for scanning the DynamoDB table
      const scanParams = {
        TableName: this.dynamoTableName,
        FilterExpression: '#st = :status',
        ExpressionAttributeNames: {
          '#st': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'failed' },
        },
      };

      // Execute the scan command
      const { Items } = await this.dynamoDbClient.send(
        new ScanCommand(scanParams),
      );

      if (!Items || Items.length === 0) {
        console.log('No failed scrappers found');
        return [];
      }

      // Convert DynamoDB items to a more readable format
      const failedScrappers = Items.map((item) => ({
        s3Key: item.s3Key?.S,
        zillowUrl: item.zillow_url?.S,
        countyId: item.county?.S,
      }));

      console.log(`Found ${failedScrappers.length} failed scrappers`);
      return failedScrappers;
    } catch (error: any) {
      console.error('Error checking failed scrappers:', error);
      throw error;
    }
  }

  private safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return;
          }
          seen.add(value);
        }
        return value;
      },
      2,
    );
  }
}
