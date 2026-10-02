import { Client } from 'pg';
import { StageUtil } from './StageUtil';
import { SecretsUtil } from './SecretsUtil';

export class DatabaseUtil {
  secretsUtil: SecretsUtil;

  constructor() {
    this.secretsUtil = new SecretsUtil();
  }

  async getLeagueDatabaseClient(): Promise<Client> {
    const env = StageUtil.getStage();
    const secretKey = `${env}/golf-league-manager-database`;
    const connectionSecret = await this.secretsUtil.getSecretObject(secretKey);

    return new Client({
      user: connectionSecret.username,
      host: connectionSecret.host,
      database: connectionSecret.database,
      password: connectionSecret.password,
      port: connectionSecret.port,
      ssl: { rejectUnauthorized: false },
    });
  }
}
