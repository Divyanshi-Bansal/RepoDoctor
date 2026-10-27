import { DatabaseClient } from '../db/database.js';

export interface User {
  id: string;
  name: string;
}

export class UserService {
  constructor(private readonly db: DatabaseClient) {}

  async getUser(id: string): Promise<User | null> {
    await this.db.query('SELECT 1');
    return { id, name: 'Alice' };
  }
}

export function formatUserName(user: User): string {
  return user.name.toUpperCase();
}
