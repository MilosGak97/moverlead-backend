import { Injectable } from '@nestjs/common';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';

@Injectable()
export class EmailService {
  private sesClient: SESClient;

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async sendWelcomeEmail(email: string, passcode: string) {
    const subject = 'Welcome to Mover Lead';
    const body = `
      <h1>Welcome to Our Service</h1>
      <p>We are excited to have you on board. To verify your email, please use the following passcode:</p>
      <h2>${passcode}</h2>
      <p>If you did not sign up, please ignore this email.</p>
    `;
    try {
      const command = new SendEmailCommand({
        Source: process.env.AWS_SES_EMAIL_FROM,
        Destination: {
          ToAddresses: [email],
        },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: body,
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: subject,
          },
        },
      });
      const data = await this.sesClient.send(command);
      console.log(data);
      return true;
    } catch (err) {
      console.log(err);
      throw new Error('Could not send email');
    }
  }
}
