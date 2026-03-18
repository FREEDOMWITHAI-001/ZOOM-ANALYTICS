export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateWorkflowJSON } from '@/lib/n8n-workflow-template';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Verify admin role from middleware-injected header
  const role = request.headers.get('x-client-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const clientName = decodeURIComponent(params.id);

    const result = await pool.query(
      `SELECT
         client_name,
         zoom_account_id,
         zoom_client_id,
         zoom_client_secret,
         zoom_webhook_secret,
         ghl_token,
         ghl_location_id,
         db_client_name,
         ai_provider,
         ai_api_key
       FROM client_credentials
       WHERE client_name = $1`,
      [clientName]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const row = result.rows[0];

    // Validate required fields
    const missing: string[] = [];
    if (!row.zoom_account_id) missing.push('zoom_account_id');
    if (!row.zoom_client_id) missing.push('zoom_client_id');
    if (!row.zoom_client_secret) missing.push('zoom_client_secret');
    if (!row.zoom_webhook_secret) missing.push('zoom_webhook_secret');
    if (!row.ghl_token) missing.push('ghl_token');
    if (!row.ghl_location_id) missing.push('ghl_location_id');

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot generate workflow — missing fields: ${missing.join(', ')}`,
          missing,
        },
        { status: 400 }
      );
    }

    // Load template from DB if an admin has edited it, otherwise use bundled file
    let overrideBase: object | undefined;
    try {
      const tpl = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'workflow_template'"
      );
      if (tpl.rows.length > 0) overrideBase = JSON.parse(tpl.rows[0].value);
    } catch { /* fall back to bundled */ }

    const workflow = generateWorkflowJSON({
      clientName: row.client_name,
      dbClientName: row.db_client_name || row.client_name,
      zoomAccountId: row.zoom_account_id,
      zoomClientId: row.zoom_client_id,
      zoomClientSecret: row.zoom_client_secret,
      zoomWebhookSecret: row.zoom_webhook_secret,
      ghlToken: row.ghl_token,
      ghlLocationId: row.ghl_location_id,
      aiProvider: row.ai_provider || 'openai',
      aiApiKey: row.ai_api_key || '',
    }, overrideBase);

    const fileName = `${row.client_name.replace(/\s+/g, '_')}_n8n_workflow.json`;

    return new NextResponse(JSON.stringify(workflow, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
