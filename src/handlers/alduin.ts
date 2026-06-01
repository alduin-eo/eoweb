import {
  AlduinReply,
  AlduinReplyServerPacket,
  type EoReader,
  PacketAction,
  PacketFamily,
} from 'eolib';
import type { Client } from '@/client';

function handleAlduinReply(client: Client, reader: EoReader) {
  const packet = AlduinReplyServerPacket.deserialize(reader);

  switch (+packet.reply) {
    case AlduinReply.Wallet: {
      const data = packet.replyData as AlduinReplyServerPacket.ReplyDataWallet;
      client.alduinController.handleWalletInfo(data);
      break;
    }
    case AlduinReply.Notify: {
      const data = packet.replyData as AlduinReplyServerPacket.ReplyDataNotify;
      client.alduinController.handleNotify(data);
      const statusLabel =
        data.status === 1
          ? client.locale.alduin.notifyApproved
          : data.status === 2
            ? client.locale.alduin.notifyCancelled
            : client.locale.alduin.notifyPending;
      const msg = client.locale.alduin.notifyMsg
        .replace('{id}', String(data.transactionId))
        .replace('{status}', statusLabel)
        .replace('{amount}', String(data.transactionAmount));
      client.toastController.show(msg);
      break;
    }
    case AlduinReply.AmountBelowMin:
      client.alertController.show(
        client.locale.alduin.errorTitle,
        client.locale.alduin.amountBelowMin,
      );
      break;
    case AlduinReply.AmountAboveMax:
      client.alertController.show(
        client.locale.alduin.errorTitle,
        client.locale.alduin.amountAboveMax,
      );
      break;
    case AlduinReply.InsufficientFunds:
      client.alertController.show(
        client.locale.alduin.errorTitle,
        client.locale.alduin.insufficientFunds,
      );
      break;
    case AlduinReply.InvalidWalletAddress:
      client.alertController.show(
        client.locale.alduin.errorTitle,
        client.locale.alduin.invalidWalletAddress,
      );
      break;
    case AlduinReply.TransactionNotFound:
      client.alertController.show(
        client.locale.alduin.errorTitle,
        client.locale.alduin.transactionNotFound,
      );
      break;
    case AlduinReply.TransactionNotPending:
      client.alertController.show(
        client.locale.alduin.errorTitle,
        client.locale.alduin.transactionNotPending,
      );
      break;
    case AlduinReply.NotYourTransaction:
      client.alertController.show(
        client.locale.alduin.errorTitle,
        client.locale.alduin.notYourTransaction,
      );
      break;
    case AlduinReply.AlreadyHasPending:
      client.alertController.show(
        client.locale.alduin.errorTitle,
        client.locale.alduin.alreadyHasPending,
      );
      break;
  }
}

export function registerAlduinHandlers(client: Client) {
  client.bus!.registerPacketHandler(
    PacketFamily.Alduin,
    PacketAction.Reply,
    (reader) => handleAlduinReply(client, reader),
  );
}
