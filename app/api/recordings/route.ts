import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Get distinct meeting_ids
    const meetingIdsResult = await pool.query(
      'SELECT DISTINCT meeting_id FROM zoom_meeting_analytics ORDER BY meeting_id'
    );

    const meetings = [];

    for (const row of meetingIdsResult.rows) {
      const meetingId = row.meeting_id;

      // Fetch latest record per meeting
      const latestResult = await pool.query(
        `SELECT * FROM zoom_meeting_analytics
         WHERE meeting_id = $1
         ORDER BY generated_at DESC NULLS LAST, id DESC
         LIMIT 1`,
        [meetingId]
      );

      if (latestResult.rows.length > 0) {
        const r = latestResult.rows[0];

        const recordingFiles = [
          { file_type: 'ANALYTICS', status: 'completed' },
        ];

        meetings.push({
          id: r.meeting_id,
          meeting_id: r.meeting_id,
          uuid: r.meeting_id,
          topic: r.meeting_name || `Meeting ${r.meeting_id}`,
          start_time: r.meeting_start_time ? r.meeting_start_time.toISOString() : null,
          duration: r.meeting_duration_minutes,
          total_participants: r.total_unique_participants,
          recording_count: 1,
          total_size: 0,
          type: r.meeting_type,
          status: r.status,
          recording_files: recordingFiles,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total_records: meetings.length,
      meetings,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: `Database query failed: ${e.message}`,
    });
  }
}
