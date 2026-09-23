import { PrismaClient } from '../generated/prisma/client.ts';

export class DatabaseService {
  private static instance: PrismaClient;

  public static getClient(): PrismaClient {
    if (!this.instance) {
      this.instance = new PrismaClient();
    }
    return this.instance;
  }
}
