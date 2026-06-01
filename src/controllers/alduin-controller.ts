import {
  AlduinAddClientPacket,
  AlduinRemoveClientPacket,
  type AlduinReplyServerPacket,
  AlduinRequestClientPacket,
  AlduinSpecClientPacket,
  type TransactionEntry,
} from 'eolib';

import type { Client } from '@/client';

export class AlduinController {
  private client: Client;

  depositWallet = '';
  depositMin = 0;
  depositMax = 0;
  withdrawMin = 0;
  withdrawMax = 0;
  page = 1;
  totalPages = 1;
  transactions: TransactionEntry[] = [];

  private walletInfoSubscribers: (() => void)[] = [];
  private notifySubscribers: ((
    data: AlduinReplyServerPacket.ReplyDataNotify,
  ) => void)[] = [];

  constructor(client: Client) {
    this.client = client;
  }

  subscribeWalletInfo(cb: () => void): void {
    this.walletInfoSubscribers.push(cb);
  }

  unsubscribeWalletInfo(cb: () => void): void {
    this.walletInfoSubscribers = this.walletInfoSubscribers.filter(
      (s) => s !== cb,
    );
  }

  subscribeNotify(
    cb: (data: AlduinReplyServerPacket.ReplyDataNotify) => void,
  ): void {
    this.notifySubscribers.push(cb);
  }

  unsubscribeNotify(
    cb: (data: AlduinReplyServerPacket.ReplyDataNotify) => void,
  ): void {
    this.notifySubscribers = this.notifySubscribers.filter((s) => s !== cb);
  }

  handleWalletInfo(data: AlduinReplyServerPacket.ReplyDataWallet): void {
    this.depositWallet = data.depositWallet;
    this.depositMin = data.depositMin;
    this.depositMax = data.depositMax;
    this.withdrawMin = data.withdrawMin;
    this.withdrawMax = Math.min(data.withdrawMax, data.balance);
    this.page = data.page;
    this.totalPages = data.totalPages;
    this.transactions = data.transactions;
    for (const cb of this.walletInfoSubscribers) cb();
  }

  handleNotify(data: AlduinReplyServerPacket.ReplyDataNotify): void {
    for (const cb of this.notifySubscribers) cb(data);
  }

  requestWalletInfo(page = 1): void {
    const packet = new AlduinRequestClientPacket();
    packet.page = page;
    this.client.bus!.send(packet);
  }

  deposit(amount: number, walletAddress: string): void {
    const packet = new AlduinAddClientPacket();
    packet.amount = amount;
    packet.walletAddress = walletAddress;
    this.client.bus!.send(packet);
  }

  withdraw(amount: number, walletAddress: string): void {
    const packet = new AlduinRemoveClientPacket();
    packet.amount = amount;
    packet.walletAddress = walletAddress;
    this.client.bus!.send(packet);
  }

  cancelTransaction(transactionId: number): void {
    const packet = new AlduinSpecClientPacket();
    packet.transactionId = transactionId;
    this.client.bus!.send(packet);
  }
}
