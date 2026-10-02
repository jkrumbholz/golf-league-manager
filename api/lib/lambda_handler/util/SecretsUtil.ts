import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

export class SecretsUtil {
  private client: SecretsManagerClient;

  constructor() {
    this.client = new SecretsManagerClient({ region: 'us-east-1' });
  }

  public async getSecretObject(secretName: string): Promise<Record<string, any>> {
    const command = new GetSecretValueCommand({ SecretId: secretName });

    try {
      const response = await this.client.send(command);

      if (response.SecretString) {
        return JSON.parse(response.SecretString);
      } else if (response.SecretBinary) {
        const buff = Buffer.from(response.SecretBinary as Uint8Array);
        return JSON.parse(buff.toString('ascii'));
      } else {
        throw new Error('Secret contains no string or binary data.');
      }
    } catch (error) {
      console.error(`Failed to retrieve secret "${secretName}":`, error);
      throw error;
    }
  }
}
