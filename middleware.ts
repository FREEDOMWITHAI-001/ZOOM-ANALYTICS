import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifyToken } from '@/lib/auth-edge';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/health'];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and Next.js internals / static assets
  if (
    isPublic(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return handleUnauthenticated(request, pathname);
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return handleUnauthenticated(request, pathname);
  }

  // Admin routes require admin role
  if (isAdminPath(pathname) && payload.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Inject client name and role headers for API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-client-name', payload.client_name);
  requestHeaders.set('x-client-role', payload.role || 'user');

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function handleUnauthenticated(request: NextRequest, pathname: string) {
  // API routes return 401 JSON
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pages redirect to /login
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
