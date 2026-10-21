import {
  type EoReader,
  EoWriter,
  PacketAction,
  type PacketFamily,
} from 'eolib';

import type { Client } from '@/client';

/** Alduin moderation packets (custom family, see reoserv src/deep/moderation_packets.rs). */
export const FAMILY_MODERATION = 56 as PacketFamily;

/** Categories exactly as the server accepts them (labels are localised separately, same order). */
export const REPORT_CATEGORIES = [
  'Text harassment',
  'Hate speech / racism',
  'Cheating / hacking',
  'Bug exploitation',
  'Scamming',
  'Advertising / spam',
  'Impersonation',
  'Threats',
  'Inappropriate character name',
  'Griefing',
  'Real-world money trading',
  'Other',
] as const;

export const REPORT_MIN_LENGTH = 10;
export const REPORT_MAX_LENGTH = 1000;

export interface PendingWarning {
  id: number;
  category: string;
  reason: string;
  issuedAt: string;
}

export interface ReportTarget {
  playerId: number;
  name: string;
}

export type ReportStatus =
  | { state: 'editing' }
  | { state: 'sending' }
  | { state: 'sent'; reference: string; trackingCode: string }
  | { state: 'error'; code: number };

export class ModerationController {
  private client: Client;
  /** unacknowledged warnings, oldest first; the first one is shown */
  warnings: PendingWarning[] = [];
  reportTarget: ReportTarget | null = null;
  reportStatus: ReportStatus = { state: 'editing' };
  private subscribers: (() => void)[] = [];

  constructor(client: Client) {
    this.client = client;
  }

  subscribe(cb: () => void): void {
    this.subscribers.push(cb);
  }

  unsubscribe(cb: () => void): void {
    this.subscribers = this.subscribers.filter((s) => s !== cb);
  }

  private notify(): void {
    for (const cb of this.subscribers) cb();
  }

  // ---------- warnings ----------

  /** Moderation_Open: int id, then chunks category, reason, issued date. */
  handleWarningOpen(reader: EoReader): void {
    reader.chunkedReadingMode = true;
    const id = reader.getInt();
    reader.nextChunk();
    const category = reader.getString();
    reader.nextChunk();
    const reason = reader.getString();
    reader.nextChunk();
    const issuedAt = reader.getString();
    if (this.warnings.some((w) => w.id === id)) return;
    this.warnings.push({ id, category, reason, issuedAt });
    this.notify();
  }

  acknowledgeWarning(id: number): void {
    const writer = new EoWriter();
    writer.addInt(id);
    this.client.bus?.sendBuf(
      FAMILY_MODERATION,
      PacketAction.Accept,
      writer.toByteArray(),
    );
    this.warnings = this.warnings.filter((w) => w.id !== id);
    this.notify();
  }

  // ---------- reports ----------

  openReport(playerId: number): void {
    const character = this.client.getCharacterById(playerId);
    if (!character || playerId === this.client.playerId) return;
    this.reportTarget = { playerId, name: character.name };
    this.reportStatus = { state: 'editing' };
    this.notify();
  }

  closeReport(): void {
    this.reportTarget = null;
    this.reportStatus = { state: 'editing' };
    this.notify();
  }

  submitReport(category: string, description: string): void {
    if (!this.reportTarget) return;
    const writer = new EoWriter();
    writer.addShort(this.reportTarget.playerId);
    writer.addByte(0xff);
    writer.addString(category);
    writer.addByte(0xff);
    writer.addString(description.slice(0, REPORT_MAX_LENGTH));
    this.client.bus?.sendBuf(
      FAMILY_MODERATION,
      PacketAction.Report,
      writer.toByteArray(),
    );
    this.reportStatus = { state: 'sending' };
    this.notify();
  }

  /** Moderation_Reply: char code, then chunks reference, tracking code. */
  handleReportReply(reader: EoReader): void {
    reader.chunkedReadingMode = true;
    const code = reader.getChar();
    reader.nextChunk();
    const reference = reader.getString();
    reader.nextChunk();
    const trackingCode = reader.getString();
    this.reportStatus =
      code === 0
        ? { state: 'sent', reference, trackingCode }
        : { state: 'error', code };
    this.notify();
  }
}
