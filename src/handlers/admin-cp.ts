import { type EoReader, PacketAction } from 'eolib';
import type { Client } from '@/client';
import { FAMILY_ADMIN_CP } from '@/controllers';

/** In-game Admin CP: open permission and request replies. */
export function registerAdminCpHandlers(client: Client) {
  client.bus!.registerPacketHandler(
    FAMILY_ADMIN_CP,
    PacketAction.Open,
    (reader: EoReader) => client.adminCpController.handleOpen(reader),
  );
  client.bus!.registerPacketHandler(
    FAMILY_ADMIN_CP,
    PacketAction.Reply,
    (reader: EoReader) => client.adminCpController.handleReply(reader),
  );
}
