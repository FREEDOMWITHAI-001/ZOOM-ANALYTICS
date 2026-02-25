import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meetingId = params.meetingId;
  const clientName = request.headers.get('x-client-name');

  if (!clientName) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await pool.query(
      `SELECT * FROM zoom_meeting_analytics
       WHERE meeting_id = $1 AND client_name = $2
       ORDER BY generated_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [meetingId, clientName]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        meeting_id: meetingId,
        error: `No analytics found for meeting: ${meetingId}`,
        peaks: [],
        dropoffs: [],
      });
    }

    const row = result.rows[0];

    // pg returns JSONB columns as parsed JS objects automatically
    const engagementGraph = row.engagement_graph;
    const peaks = row.peaks;
    const dropoffs = row.dropoffs;
    const userTimeReport = row.user_time_report;
    const aiAnalysis = row.overall_ai_analysis;

    // engagement_metrics wrapper (matches existing API shape)
    const engagementMetrics = {
      engagement_over_time: engagementGraph,
      peak_concurrent_users: row.peak_concurrent_users,
      participant_details: userTimeReport,
      user_timelines: userTimeReport,
    };

    // engagement_insights wrapper
    const insightsData = {
      success: true,
      peaks: peaks || [],
      dropoffs: dropoffs || [],
      total_participants: row.total_unique_participants,
      engagement_score: row.engagement_score,
      peak_concurrent_users: row.peak_concurrent_users,
      final_active_users: row.final_active_users,
    };

    const analytics: Record<string, any> = {
      meeting_id: row.meeting_id,
      success: true,
      interval_minutes: row.interval_minutes,
      meeting_duration: row.meeting_duration_minutes,
      total_participants: row.total_unique_participants,

      engagement_metrics: engagementMetrics,
      engagement_graph: engagementGraph,
      participant_details: userTimeReport,
      user_timelines: userTimeReport,

      peaks: peaks || [],
      dropoffs: dropoffs || [],

      engagement_insights: insightsData,

      peak_retention: row.peak_concurrent_users,
      average_retention: row.average_retention,

      transcript_available: row.transcript_available,
      transcript_download_url: row.transcript_download_url,

      message: 'Complete analytics with engagement insights',
      data_source: 'postgresql',
    };

    if (aiAnalysis) {
      analytics.overall_ai_analysis = aiAnalysis;
    }

    return NextResponse.json(analytics);
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      meeting_id: meetingId,
      error: `Failed to load analytics: ${e.message}`,
      peaks: [],
      dropoffs: [],
    });
  }
}
