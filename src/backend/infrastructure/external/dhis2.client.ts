/**
 * DHIS2 API Client
 *
 * Thin wrapper around DHIS2's dataValueSets endpoint. Built fresh per call
 * from a tenant's own config (never a shared/cached instance keyed only by
 * provider — see PaymentGatewayFactory for a cautionary example of that
 * causing cross-tenant cache collisions). Never throws on a DHIS2-side or
 * network failure; always returns a normalized Dhis2PushResult so the
 * caller (the use-case) can persist a sync-log row regardless of outcome.
 */

import axios from 'axios';

export interface Dhis2ClientConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export interface Dhis2ImportCount {
  imported: number;
  updated: number;
  ignored: number;
  deleted: number;
}

export type Dhis2PushResult =
  | { ok: true; status: 'SUCCESS' | 'WARNING'; importCount: Dhis2ImportCount; conflicts?: any[]; raw: any }
  | { ok: false; reason: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'REJECTED'; message: string; raw?: any };

export class Dhis2Client {
  constructor(private config: Dhis2ClientConfig) {}

  async pushDataValueSet(payload: object): Promise<Dhis2PushResult> {
    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');

    try {
      const response = await axios.post(`${baseUrl}/api/dataValueSets`, payload, {
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      const data = response.data;
      const status = data?.status as string | undefined;

      if (status === 'SUCCESS' || status === 'WARNING') {
        return {
          ok: true,
          status,
          importCount: data.importCount ?? { imported: 0, updated: 0, ignored: 0, deleted: 0 },
          conflicts: data.conflicts,
          raw: data,
        };
      }

      // DHIS2 reached and responded, but rejected the submission (status
      // ERROR, or an unrecognized shape) — a real rejection, not a network
      // problem, so it's classified distinctly from NETWORK_ERROR/AUTH_ERROR.
      return {
        ok: false,
        reason: 'REJECTED',
        message: data?.message || `DHIS2 rejected the submission (status: ${status ?? 'unknown'})`,
        raw: data,
      };
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          ok: false,
          reason: 'AUTH_ERROR',
          message: 'DHIS2 rejected the credentials (401/403) — check the username and password in Settings',
          raw: error.response?.data,
        };
      }

      return {
        ok: false,
        reason: 'NETWORK_ERROR',
        message: error.response?.data?.message || error.message || 'Could not reach the DHIS2 server',
        raw: error.response?.data,
      };
    }
  }
}
