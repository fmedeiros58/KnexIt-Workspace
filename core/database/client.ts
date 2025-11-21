export class DatabaseClient {
  constructor(private url: string) {}

  async connect() {
    return Promise.resolve(`connected to ${this.url}`);
  }
}

export function createDatabaseClient(url = process.env.DATABASE_URL ?? "") {
  return new DatabaseClient(url);
}
