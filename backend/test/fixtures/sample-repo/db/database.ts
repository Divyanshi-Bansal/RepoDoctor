export class DatabaseClient {
  private isConnected = false;

  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async query(sql: string): Promise<any[]> {
    return [];
  }
}

export function createDatabaseClient(): DatabaseClient {
  return new DatabaseClient();
}
