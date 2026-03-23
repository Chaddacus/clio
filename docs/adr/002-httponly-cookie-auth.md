# ADR-002: httpOnly Cookie Authentication

## Status
Accepted

## Context
JWT tokens stored in localStorage are accessible to any JavaScript running on the page. Combined with XSS vulnerabilities (even accidental console.log of sensitive data), this creates a token theft vector.

## Decision
Store both access and refresh tokens as httpOnly cookies set by the backend. The frontend uses `withCredentials: true` and never touches tokens directly.

- Access token: httpOnly, Secure (prod), SameSite=Lax, path=/
- Refresh token: httpOnly, Secure (prod), SameSite=Lax, path=/api/auth/

The refresh token path is scoped to `/api/auth/` so it's only sent on auth endpoints, reducing exposure.

## Alternatives Considered
- **Access token in cookie, refresh in localStorage:** Simpler but leaves refresh token XSS-accessible.
- **Full session-based auth:** Would require rearchitecting the API; JWT is already well-integrated.

## Consequences
- Zero localStorage usage for authentication (verified by grep)
- Frontend cannot read token expiry — relies on 401 interceptor for refresh
- CORS must set `credentials: true` and expose `Set-Cookie` headers
- CookieJWTAuthentication class reads from cookie, falls back to Authorization header for API clients
