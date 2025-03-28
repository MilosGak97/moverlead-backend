import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { safeStringify } from "src/api/common/utils/safe-stringify";

export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadResults(
    results: any,
    key: string,
    countyId: string
  ): Promise<string> {
    // Create a tagging string in the format: key1=value1&key2=value2
    // Note: Values are URL-encoded to ensure proper transmission
    const tagging = `status=ready&date=${encodeURIComponent(
      new Date().toISOString()
    )}&county=${countyId}`;

    // Prepare the S3 PutObject parameters, using Tagging instead of Metadata
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME, // Ensure this is set in your environment variables
      Key: key,
      Body: JSON.stringify(results, null, 2),
      ContentType: "application/json",
      Tagging: tagging,
    };

    try {
      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);

      console.log(`⬆️  + ✅: Results has been written  for${key}`);
      return `s3://${params.Bucket}/${key}`;
    } catch (error) {
      console.error("Error uploading file to S3:", error);
      throw new Error("Could not upload results to S3");
    }
  }

  async readResults(key: string): Promise<any> {
    const params = { Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key };

    try {
      const command = new GetObjectCommand(params);
      const response = await this.s3Client.send(command);

      // Convert stream to string
      const streamToString = (stream: Readable): Promise<string> =>
        new Promise((resolve, reject) => {
          const chunks: Uint8Array[] = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("end", () =>
            resolve(Buffer.concat(chunks).toString("utf-8"))
          );
          stream.on("error", reject);
        });

      const data = await streamToString(response.Body as Readable);
      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Error reading JSON from S3 (${key}):`, error);
      throw new Error("Could not read JSON file from S3");
    }
  }

  async uploadErrorToS3(error: any, countyId: string, key: string) {
    // Create a tagging string in the format: key1=value1&key2=value2
    // Note: Values are URL-encoded to ensure proper transmission
    const date = new Date().toISOString();
    const tagging = `date=${date}&county=${countyId}&key=${key}`;

    // Prepend "error/" to store the file in the error folder
    const errorKey = `error/${key}_${date}`;

    const body = safeStringify(error);

    // Prepare the S3 PutObject parameters, using Tagging instead of Metadata
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME, // Ensure this is set in your environment variables
      Key: errorKey,
      Body: body,
      ContentType: "application/json",
      Tagging: tagging,
    };

    try {
      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);
      return `s3://${params.Bucket}/${key}`;
    } catch (error) {
      console.error("Error uploading file to S3:", error);
      throw new Error("Could not upload results to S3");
    }
  }
}
