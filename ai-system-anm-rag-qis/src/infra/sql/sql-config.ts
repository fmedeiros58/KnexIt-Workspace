export interface SqlConfig {
  connectionString: string;
  poolMin: number;
  poolMax: number;
}

export const sqlConfig: SqlConfig = {
  connectionString: process.env.ANM_SQL_URL || "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  poolMin: 1,
  poolMax: 10,
};
