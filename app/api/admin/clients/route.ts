export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

// Ensure the role column exists (run once)
async function ensureSchema() {
  await pool.query(`
    ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
    ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'openai';
    ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS ai_api_key TEXT;
  `);
}

// GET /api/admin/clients - list all clients with meeting counts
export async function GET() {
  try {
    await ensureSchema();

    const result = await pool.query(`
      SELECT
        c.client_name,
        c.role,
        c.is_active,
        c.created_at,
        c.zoom_account_id,
        c.zoom_client_id,
        c.zoom_client_secret,
        c.zoom_webhook_secret,
        c.ghl_token,
        c.ghl_location_id,
        c.db_client_name,
        c.n8n_webhook_id,
        c.ai_provider,
        c.ai_api_key,
        COUNT(DISTINCT m.meeting_id) AS meeting_count
      FROM client_credentials c
      LEFT JOIN zoom_meeting_analytics m ON m.client_name = c.client_name
      GROUP BY c.id, c.client_name, c.role, c.is_active, c.created_at,
               c.zoom_account_id, c.zoom_client_id, c.zoom_client_secret,
               c.zoom_webhook_secret, c.ghl_token, c.ghl_location_id,
               c.db_client_name, c.n8n_webhook_id, c.ai_provider, c.ai_api_key
      ORDER BY c.created_at DESC NULLS LAST
    `);

    return NextResponse.json({ success: true, clients: result.rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin/clients - create new client
export async function POST(request: NextRequest) {
  try {
    await ensureSchema();

    const body = await request.json();
    const {
      client_name,
      password,
      role = 'user',
      zoomAccountId,
      zoomClientId,
      zoomClientSecret,
      zoomWebhookSecret,
      ghlToken,
      ghlLocationId,
      dbClientName,
      aiProvider,
      aiApiKey,
    } = body;

    if (!client_name || !password) {
      return NextResponse.json(
        { error: 'client_name and password are required' },
        { status: 400 }
      );
    }

    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'role must be user or admin' }, { status: 400 });
    }

    const existing = await pool.query(
      'SELECT 1 FROM client_credentials WHERE client_name = $1',
      [client_name]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Client already exists' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const resolvedDbClientName = (dbClientName?.trim()) || client_name.trim();

    const insertResult = await pool.query(
      `INSERT INTO client_credentials
         (client_name, password_hash, is_active, role, created_at,
          zoom_account_id, zoom_client_id, zoom_client_secret, zoom_webhook_secret,
          ghl_token, ghl_location_id, db_client_name, ai_provider, ai_api_key)
       VALUES ($1, $2, true, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING client_name, role`,
      [
        client_name,
        password_hash,
        role,
        zoomAccountId || null,
        zoomClientId || null,
        zoomClientSecret || null,
        zoomWebhookSecret || null,
        ghlToken || null,
        ghlLocationId || null,
        resolvedDbClientName,
        aiProvider || 'openai',
        aiApiKey || null,
      ]
    );

    const created = insertResult.rows[0];
    const hasWorkflowData = !!(
      zoomAccountId && zoomClientId && zoomClientSecret &&
      zoomWebhookSecret && ghlToken && ghlLocationId
    );

    return NextResponse.json(
      {
        success: true,
        client_name: created.client_name,
        id: created.client_name,
        role: created.role,
        has_workflow_data: hasWorkflowData,
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
