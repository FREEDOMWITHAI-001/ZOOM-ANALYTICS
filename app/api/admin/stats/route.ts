export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/admin/stats - system-wide stats
export async function GET() {
  try {
    const [clientStats, meetingStats, recentActivity] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_clients,
          COUNT(*) FILTER (WHERE is_active = true) AS active_clients,
          COUNT(*) FILTER (WHERE role = 'admin') AS admin_count
        FROM client_credentials
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total_meetings,
          COUNT(DISTINCT client_name) AS clients_with_data,
          ROUND(AVG(average_retention)::numeric, 1) AS avg_retention,
          ROUND(AVG(engagement_score)::numeric, 1) AS avg_engagement_score,
          SUM(total_unique_participants) AS total_participants
        FROM zoom_meeting_analytics
      `),
      pool.query(`
        SELECT
          m.meeting_id,
          m.meeting_name,
          m.client_name,
          m.generated_at,
          m.total_unique_participants,
          m.average_retention
        FROM zoom_meeting_analytics m
        ORDER BY m.generated_at DESC
        LIMIT 10
      `),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        ...clientStats.rows[0],
        ...meetingStats.rows[0],
      },
      recent_activity: recentActivity.rows,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
