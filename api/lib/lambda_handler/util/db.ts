import { Client } from 'pg';
import { DatabaseUtil } from './DatabaseUtil';

export async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await new DatabaseUtil().getLeagueDatabaseClient();
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.end();
  }
}
