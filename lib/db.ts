import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
});

/**
 * Resolve the db_client_name used in zoom_meeting_analytics
 * from the display client_name stored in the JWT / client_credentials.
 */
export async function resolveDbClientName(clientName: string): Promise<string> {
  const result = await pool.query(
    'SELECT db_client_name FROM client_credentials WHERE client_name = $1',
    [clientName]
  );
  return result.rows[0]?.db_client_name || clientName;
}

export default pool;
