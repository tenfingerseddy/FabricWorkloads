/**
 * Observability Workbench - Authentication
 *
 * Handles OAuth2 client-credentials flow for Fabric API access.
 * Caches tokens and refreshes them automatically before expiry.
 */

import type { FabricConfig } from "./config.ts";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  ext_expires_in?: number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

export class FabricAuthProvider {
  private cache: CachedToken | null = null;
  /** Refresh the token 2 minutes before actual expiry */
  private static readonly EXPIRY_BUFFER_MS = 2 * 60 * 1000;

  constructor(private readonly config: FabricConfig) {}

  /**
   * Returns a valid access token, refreshing if needed.
   */
  async getToken(): Promise<string> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.accessToken;
    }
    return this.acquireToken();
  }

  /**
   * Forces a fresh token acquisition. Useful after a 401.
   */
  async forceRefresh(): Promise<string> {
    this.cache = null;
    return this.acquireToken();
  }

  private async acquireToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: this.config.scope,
      grant_type: this.config.grantType,
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Token acquisition failed (${response.status}): ${errorText}`
      );
    }

    const data: TokenResponse = (await response.json()) as TokenResponse;

    this.cache = {
      accessToken: data.access_token,
      expiresAt:
        Date.now() +
        data.expires_in * 1000 -
        FabricAuthProvider.EXPIRY_BUFFER_MS,
    };

    return this.cache.accessToken;
  }
}
