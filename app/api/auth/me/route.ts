import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientName = request.headers.get('x-client-name');

  if (!clientName) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }

  const role = request.headers.get('x-client-role') || 'user';

  return NextResponse.json({
    authenticated: true,
    client_name: clientName,
    role,
  });
}
