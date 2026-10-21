import { type EoReader, PacketAction } from 'eolib';
import type { Client } from '@/client';
import { FAMILY_MODERATION } from '@/controllers';

/** Alduin moderation packets: official warnings and in-game report replies. */
export function registerModerationHandlers(client: Client) {
  client.bus!.registerPacketHandler(
    FAMILY_MODERATION,
    PacketAction.Open,
    (reader: EoReader) => client.moderationController.handleWarningOpen(reader),
  );
  client.bus!.registerPacketHandler(
    FAMILY_MODERATION,
    PacketAction.Reply,
    (reader: EoReader) => client.moderationController.handleReportReply(reader),
  );
}
