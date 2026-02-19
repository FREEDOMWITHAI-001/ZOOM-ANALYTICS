import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meetingId = params.meetingId;

  try {
    const result = await pool.query(
      `SELECT * FROM zoom_meeting_analytics
       WHERE meeting_id = $1
       ORDER BY generated_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [meetingId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        meeting_id: meetingId,
        error: `No record found for meeting: ${meetingId}`,
        transcript_available: false,
      });
    }

    const row = result.rows[0];
    const transcriptContent = row.transcript;
    const hasContent = !!transcriptContent && transcriptContent.trim().length > 0;

    const response: Record<string, any> = {
      success: hasContent,
      meeting_id: meetingId,
      transcript_available: hasContent,
      has_content: hasContent,
    };

    if (hasContent) {
      response.content = transcriptContent;
      response.content_length = transcriptContent.length;
    } else {
      response.error = 'No transcript content available for this meeting';
    }

    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      meeting_id: meetingId,
      error: `Database query failed: ${e.message}`,
      transcript_available: false,
    });
  }
}
