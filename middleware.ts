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
  // Only treat the last segment's dot as a static file extension
  const lastSegment = pathname.split('/').pop() || '';
  const looksLikeStaticFile = lastSegment.includes('.') && !pathname.startsWith('/api/');

  if (
    isPublic(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    looksLikeStaticFile
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
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Admin users should go to /admin, not the main upload page
  if (pathname === '/' && payload.role === 'admin') {
    return NextResponse.redirect(new URL('/admin', request.url));
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
