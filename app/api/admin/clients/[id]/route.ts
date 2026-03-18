export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

// PUT /api/admin/clients/[id] - update client
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client_name = decodeURIComponent(params.id);
    const body = await request.json();
    const {
      password,
      is_active,
      role,
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

    const existing = await pool.query(
      'SELECT 1 FROM client_credentials WHERE client_name = $1',
      [client_name]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Build dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (password !== undefined && password !== '') {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(is_active);
    }

    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return NextResponse.json({ error: 'role must be user or admin' }, { status: 400 });
      }
      updates.push(`role = $${idx++}`);
      values.push(role);
    }

    // Integration fields — allow explicit null to clear a field
    const integrationFields: [string, string, any][] = [
      ['zoom_account_id',     'zoomAccountId',     zoomAccountId],
      ['zoom_client_id',      'zoomClientId',      zoomClientId],
      ['zoom_client_secret',  'zoomClientSecret',  zoomClientSecret],
      ['zoom_webhook_secret', 'zoomWebhookSecret', zoomWebhookSecret],
      ['ghl_token',           'ghlToken',          ghlToken],
      ['ghl_location_id',     'ghlLocationId',     ghlLocationId],
      ['db_client_name',      'dbClientName',      dbClientName],
      ['ai_provider',         'aiProvider',        aiProvider],
      ['ai_api_key',          'aiApiKey',          aiApiKey],
    ];

    for (const [col, , val] of integrationFields) {
      if (val !== undefined) {
        updates.push(`${col} = $${idx++}`);
        values.push(val || null);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    values.push(client_name);
    await pool.query(
      `UPDATE client_credentials SET ${updates.join(', ')} WHERE client_name = $${idx}`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin/clients/[id] - delete client and all their data
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client_name = decodeURIComponent(params.id);

    const existing = await pool.query(
      'SELECT 1 FROM client_credentials WHERE client_name = $1',
      [client_name]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Delete meetings data and credentials in one transaction
    await pool.query('BEGIN');
    await pool.query('DELETE FROM zoom_meeting_analytics WHERE client_name = $1', [client_name]);
    await pool.query('DELETE FROM client_credentials WHERE client_name = $1', [client_name]);
    await pool.query('COMMIT');

    return NextResponse.json({ success: true });
  } catch (e: any) {
    await pool.query('ROLLBACK');
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
