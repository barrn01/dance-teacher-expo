import "server-only";
import { createServiceClient } from "../supabase/server";
import {
  XERO_TOKEN_URL,
  XERO_CONNECTIONS_URL,
  XERO_API_BASE,
  XERO_SCOPES,
  xeroRedirectUri,
} from "./config";

/**
 * Xero OAuth2 token management. One org, so a single `xero_connection` row
 * holds the current tokens. Access tokens last ~30 min; refresh tokens rotate
 * on every use (we always persist the newest). All reads/writes use the
 * service client — the tokens are secrets and the table denies everyone else.
 */

export type XeroConnection = {
  tenant_id: string;
  tenant_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

function clientCredentials(): { id: string; secret: string } | null {
  const id = process.env.XERO_CLIENT_ID;
  const secret = process.env.XERO_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

function basicAuthHeader(id: string, secret: string): string {
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const creds = clientCredentials();
  if (!creds) throw new Error("Xero client credentials not configured.");
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(creds.id, creds.secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    throw new Error(
      `Xero token request failed: ${json.error ?? res.status} ${
        json.error_description ?? ""
      }`.trim(),
    );
  }
  return json;
}

/** Build the consent URL the admin is sent to (one-time authorisation). */
export function buildAuthorizeUrl(state: string): string {
  const creds = clientCredentials();
  if (!creds) throw new Error("Xero client credentials not configured.");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.id,
    redirect_uri: xeroRedirectUri(),
    scope: XERO_SCOPES,
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${params}`;
}

/** Exchange the authorization code for tokens + resolve the org tenant, persist. */
export async function completeConnection(
  code: string,
  connectedBy: string | null,
): Promise<XeroConnection> {
  const token = await postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: xeroRedirectUri(),
    }),
  );

  // Resolve which org these tokens are for (we expect exactly one).
  const connRes = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
  });
  const connections = (await connRes.json()) as Array<{
    tenantId: string;
    tenantName: string;
  }>;
  if (!connRes.ok || !connections?.length) {
    throw new Error("Xero returned no connected organisation.");
  }
  const org = connections[0];

  return persistTokens({
    tenant_id: org.tenantId,
    tenant_name: org.tenantName ?? null,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    scope: token.scope ?? XERO_SCOPES,
    connected_by: connectedBy,
  });
}

async function persistTokens(row: {
  tenant_id: string;
  tenant_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
  connected_by?: string | null;
}): Promise<XeroConnection> {
  const sb = createServiceClient();
  const update: Record<string, unknown> = {
    id: "default",
    tenant_id: row.tenant_id,
    tenant_name: row.tenant_name,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_at: row.expires_at,
    scope: row.scope,
    updated_at: new Date().toISOString(),
  };
  if (row.connected_by !== undefined) update.connected_by = row.connected_by;
  const { error } = await sb.from("xero_connection").upsert(update);
  if (error) throw new Error(`Failed to persist Xero tokens: ${error.message}`);
  return {
    tenant_id: row.tenant_id,
    tenant_name: row.tenant_name,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_at: row.expires_at,
    scope: row.scope,
  };
}

/** The stored connection, or null if Xero has never been authorised. */
export async function getConnection(): Promise<XeroConnection | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("xero_connection")
    .select(
      "tenant_id, tenant_name, access_token, refresh_token, expires_at, scope",
    )
    .eq("id", "default")
    .maybeSingle<XeroConnection>();
  return data ?? null;
}

export async function isConnected(): Promise<boolean> {
  return (await getConnection()) !== null;
}

/**
 * A valid access token for the connected org, refreshing if it is within 2 min
 * of expiry. Returns null when Xero was never connected. Throws if a refresh
 * fails (e.g. the refresh token lapsed after 60 days idle) so callers can
 * surface a "reconnect" prompt.
 */
async function getValidConnection(): Promise<XeroConnection | null> {
  const conn = await getConnection();
  if (!conn) return null;
  const expiresMs = new Date(conn.expires_at).getTime();
  if (expiresMs - Date.now() > 120_000) return conn;

  const token = await postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    }),
  );
  return persistTokens({
    tenant_id: conn.tenant_id,
    tenant_name: conn.tenant_name,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    scope: token.scope ?? conn.scope,
  });
}

/** Force a token refresh (used by the weekly keep-alive). No-op if unconnected. */
export async function keepAlive(): Promise<boolean> {
  const conn = await getConnection();
  if (!conn) return false;
  const token = await postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    }),
  );
  await persistTokens({
    tenant_id: conn.tenant_id,
    tenant_name: conn.tenant_name,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    scope: token.scope ?? conn.scope,
  });
  return true;
}

export class XeroNotConnectedError extends Error {
  constructor() {
    super("Xero is not connected. Authorise it at /admin/xero first.");
    this.name = "XeroNotConnectedError";
  }
}

/**
 * Authed JSON request against the Xero Accounting API for the connected org.
 * Adds the bearer token + Xero-tenant-id header and refreshes as needed.
 */
export async function xeroFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const conn = await getValidConnection();
  if (!conn) throw new XeroNotConnectedError();
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.access_token}`,
      "Xero-tenant-id": conn.tenant_id,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xero API ${path} failed (${res.status}): ${text.slice(0, 800)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}
