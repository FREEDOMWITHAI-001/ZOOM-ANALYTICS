import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Return only the authenticated client's name
    const clientName = request.headers.get('x-client-name');

    if (!clientName) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      clients: [clientName],
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: `Failed: ${e.message}`,
    });
  }
}
