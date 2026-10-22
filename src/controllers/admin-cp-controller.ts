import {
  type EoReader,
  EoWriter,
  PacketAction,
  type PacketFamily,
} from 'eolib';

import type { Client } from '@/client';

/**
 * In-game Admin Control Panel ($admincp). Custom family (see reoserv src/admin_cp): the server sends
 * AdminCp_Open when an authorized staff member types $admincp; each panel operation is an
 * AdminCp_Request { int request id, chunk, JSON } answered by AdminCp_Reply with the same id.
 * The server checks the caller's rights on every request, so this client holds no secrets.
 */
export const FAMILY_ADMIN_CP = 57 as PacketFamily;

const REQUEST_TIMEOUT_MS = 20_000;

export interface AdminCpSession {
  name: string;
  admin_level: number;
  owner: boolean;
  alduin_item_id: number;
  alduin_max_amount: number;
  max_item_amount: number;
  classes: string[];
  report_statuses: string[];
  warning_categories: string[];
  version: string;
}

interface Pending {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** JSON with every non-ASCII character escaped, so EO string encoding can't change it. */
function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\u007f-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

export class AdminCpController {
  private client: Client;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private openedSubscribers: (() => void)[] = [];
  session: AdminCpSession | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  subscribeOpened(cb: () => void): void {
    this.openedSubscribers.push(cb);
  }

  unsubscribeOpened(cb: () => void): void {
    this.openedSubscribers = this.openedSubscribers.filter((s) => s !== cb);
  }

  /** AdminCp_Open: the server allowed this character to open the panel. */
  handleOpen(_reader: EoReader): void {
    for (const cb of this.openedSubscribers) cb();
  }

  /** AdminCp_Reply: int request id, chunk, JSON { ok, data | error }. */
  handleReply(reader: EoReader): void {
    reader.chunkedReadingMode = true;
    const id = reader.getInt();
    reader.nextChunk();
    const body = reader.getString();
    reader.chunkedReadingMode = false;

    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timer);

    let reply: { ok?: boolean; data?: unknown; error?: string };
    try {
      reply = JSON.parse(body);
    } catch {
      pending.reject(new Error('The server sent an unreadable reply.'));
      return;
    }
    if (reply.ok) pending.resolve(reply.data);
    else pending.reject(new Error(reply.error || 'The request failed.'));
  }

  /** Run one panel operation on the server. Rejects with the server's error message. */
  request<T = unknown>(
    op: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    if (!this.client.bus) {
      return Promise.reject(new Error('Not connected to the game server.'));
    }
    const id = this.nextId++;
    const writer = new EoWriter();
    writer.addInt(id);
    writer.addByte(0xff);
    writer.addString(asciiJson({ ...params, op }));

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('The server did not answer in time.'));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: resolve as (data: unknown) => void,
        reject,
        timer,
      });
      this.client.bus!.sendBuf(
        FAMILY_ADMIN_CP,
        PacketAction.Request,
        writer.toByteArray(),
      );
    });
  }

  async loadSession(): Promise<AdminCpSession> {
    this.session = await this.request<AdminCpSession>('session');
    return this.session;
  }

  /** Connection lost: fail everything still waiting and forget the session. */
  reset(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Disconnected from the game server.'));
    }
    this.pending.clear();
    this.session = null;
  }
}
