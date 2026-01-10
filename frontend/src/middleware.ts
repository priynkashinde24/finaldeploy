import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Frontend route protection middleware
 * Protects routes based on authentication and role
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get access token from cookie or header (if available)
  // In Next.js middleware, we can't access localStorage, so we check cookies
  const accessToken = request.cookies.get('accessToken')?.value;
  
  // Try to get user info from cookie (set by client-side after login)
  const userCookie = request.cookies.get('user')?.value;
  let user: { role?: string } | null = null;
  
  if (userCookie) {
    try {
      user = JSON.parse(userCookie);
    } catch {
      user = null;
    }
  }

  // Protected admin routes
  if (pathname.startsWith('/admin')) {
    if (!accessToken) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user?.role !== 'admin') {
      // Redirect to unauthorized page
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Protected supplier routes (ONLY suppliers can access)
  if (pathname.startsWith('/supplier')) {
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user?.role !== 'supplier') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Protected reseller routes (ONLY resellers can access)
  if (pathname.startsWith('/reseller')) {
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user?.role !== 'reseller') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Protected affiliate routes (ONLY affiliates can access)
  if (pathname.startsWith('/affiliate')) {
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user?.role !== 'affiliate') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Protected dashboard routes (resellers, affiliates, and admins)
  if (pathname.startsWith('/dashboard')) {
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Allow resellers, affiliates, and admins
    if (user?.role !== 'reseller' && user?.role !== 'affiliate' && user?.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    '/admin/:path*',
    '/supplier/:path*',
    '/dashboard/:path*',
    '/reseller/:path*',
    '/affiliate/:path*',
  ],
};

