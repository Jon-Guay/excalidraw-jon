/**
 * Unauthenticated handlers for the local demo drawings API (no session layer).
 * New public endpoints must be listed here and carry a justification comment
 * on the route registration.
 */
export const PUBLIC_ROUTE_PATHS = [
  "POST /drawings/:id/duplicate",
] as const;
