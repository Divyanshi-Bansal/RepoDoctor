import { DatabaseClient, createDatabaseClient } from './db/database.js';
import { UserService, formatUserName } from './services/user.service.js';

export class Application {
  private db: DatabaseClient;
  private userService: UserService;

  constructor() {
    this.db = createDatabaseClient();
    this.userService = new UserService(this.db);
  }

  async start(): Promise<void> {
    await this.db.connect();
  }
}

export const app = new Application();
