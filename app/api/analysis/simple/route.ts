import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const totalAttendees = Number(body.totalAttendees || 0);
    const averageRetention = Number(body.averageRetention || 0);
    const peaks: any[] = body.peaks || [];
    const dropoffs: any[] = body.dropoffs || [];

    const insights: string[] = [];
    const recommendations: string[] = [];

    if (totalAttendees > 0) {
      insights.push(
        `Total attendance was ${totalAttendees} with average retention of ${averageRetention.toFixed(1)}%.`
      );
    }

    if (peaks.length > 0) {
      const p = peaks[0];
      insights.push(
        `Highest engagement occurred at ${p.timeInterval} with ${p.count} participants.`
      );
    }

    if (dropoffs.length > 0) {
      const d = dropoffs[0];
      insights.push(
        `Largest drop-off of ${Math.abs(Number(d.percentageChange))}% occurred at ${d.timeInterval}.`
      );
    }

    if (dropoffs.length > 0) {
      recommendations.push('Reduce long monologues during drop-off segments.');
      recommendations.push('Improve pacing when engagement declines.');
      recommendations.push('Add interactive elements to maintain audience interest.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain current structure as engagement is stable.');
      recommendations.push('Consider adding Q&A sessions to further boost engagement.');
      recommendations.push('Experiment with different content formats for future webinars.');
    }

    return NextResponse.json({
      success: true,
      insights,
      recommendations,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: `Simple analysis failed: ${e.message}`,
      insights: ['Analysis error occurred'],
      recommendations: ['Please try again or check your data'],
    });
  }
}
