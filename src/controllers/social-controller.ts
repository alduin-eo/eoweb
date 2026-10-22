import {
  BookRequestClientPacket,
  type CharacterDetails,
  type EquipmentPaperdoll,
  type OnlinePlayer,
  PaperdollRequestClientPacket,
  PlayersRequestClientPacket,
} from 'eolib';

export type CharacterTab = 'paperdoll' | 'stats' | 'book';

import type { Client } from '@/client';

type PaperdollOpenedData = {
  details: CharacterDetails;
  equipment: EquipmentPaperdoll;
};

type BookOpenedData = {
  details: CharacterDetails;
};

type PlayerListSubscriber = (players: OnlinePlayer[]) => void;

const FRIENDS_KEY = 'eoweb:social:friends';
const IGNORE_KEY = 'eoweb:social:ignore';

// Character names are case-insensitive (the server sends them lower-case).
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function loadNameList(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }
    const names = parsed
      .filter((n): n is string => typeof n === 'string')
      .map(normalizeName)
      .filter(Boolean);
    return [...new Set(names)];
  } catch {
    return [];
  }
}

function saveNameList(key: string, names: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(names));
  } catch {
    // storage full or blocked: the list still works for this session
  }
}

export class SocialController {
  private client: Client;
  naughtyWords: string[] = [];
  playerList: OnlinePlayer[] = [];
  friendList: string[];
  ignoreList: string[];

  // Tracks which tab should be shown when CharacterDialog mounts.
  // Set before notifying subscribers so useState initializers can read it.
  pendingCharacterTab: CharacterTab | null = null;

  private playerListSubscribers: PlayerListSubscriber[] = [];

  constructor(client: Client) {
    this.client = client;

    this.friendList = loadNameList(FRIENDS_KEY);
    this.ignoreList = loadNameList(IGNORE_KEY);
  }

  private paperdollOpenedSubscribers: ((data: PaperdollOpenedData) => void)[] =
    [];
  subscribePaperdollOpened(callback: (data: PaperdollOpenedData) => void) {
    this.paperdollOpenedSubscribers.push(callback);
  }

  unsubscribePaperdollOpened(callback: (data: PaperdollOpenedData) => void) {
    this.paperdollOpenedSubscribers = this.paperdollOpenedSubscribers.filter(
      (s) => s !== callback,
    );
  }

  notifyPaperdollOpened(data: PaperdollOpenedData) {
    this.pendingCharacterTab = 'paperdoll';

    if (data.details.playerId === this.client.playerId) {
      this.client.home = data.details.home;
      this.client.partner = data.details.partner;
    }

    for (const subscriber of this.paperdollOpenedSubscribers) {
      subscriber(data);
    }
  }

  private bookOpenedSubscribers: ((data: BookOpenedData) => void)[] = [];

  subscribeBookOpened(cb: (data: BookOpenedData) => void) {
    this.bookOpenedSubscribers.push(cb);
  }

  unsubscribeBookOpened(cb: (data: BookOpenedData) => void) {
    this.bookOpenedSubscribers = this.bookOpenedSubscribers.filter(
      (s) => s !== cb,
    );
  }

  notifyBookOpened(details: CharacterDetails): void {
    this.pendingCharacterTab = 'book';
    for (const subscriber of this.bookOpenedSubscribers) {
      subscriber({ details });
    }
  }

  requestPaperdoll(playerId: number): void {
    const packet = new PaperdollRequestClientPacket();
    packet.playerId = playerId;
    this.client.bus!.send(packet);
  }

  requestBook(playerId: number): void {
    const packet = new BookRequestClientPacket();
    packet.playerId = playerId;
    this.client.bus!.send(packet);
  }

  requestOnlinePlayers(): void {
    this.client.bus?.send(new PlayersRequestClientPacket());
  }

  subscribePlayerList(callback: PlayerListSubscriber) {
    this.playerListSubscribers.push(callback);
  }

  unsubscribePlayerList(callback: PlayerListSubscriber) {
    this.playerListSubscribers = this.playerListSubscribers.filter(
      (cb) => cb !== callback,
    );
  }

  notifyPlayersList(players: OnlinePlayer[]) {
    this.playerList = players;
    for (const subscriber of this.playerListSubscribers) {
      subscriber(players);
    }
  }

  private listSubscribers: (() => void)[] = [];

  /** Friend/ignore list changed (from the Social dialog or the right-click player menu). */
  subscribeLists(cb: () => void): void {
    this.listSubscribers.push(cb);
  }

  unsubscribeLists(cb: () => void): void {
    this.listSubscribers = this.listSubscribers.filter((s) => s !== cb);
  }

  private notifyLists(): void {
    for (const cb of this.listSubscribers) cb();
  }

  addFriend(playerName: string): void {
    const name = normalizeName(playerName);
    if (!name || this.friendList.includes(name)) {
      return;
    }

    this.friendList.push(name);
    saveNameList(FRIENDS_KEY, this.friendList);
    this.notifyLists();
  }

  removeFriend(playerName: string): void {
    const name = normalizeName(playerName);
    this.friendList = this.friendList.filter((n) => n !== name);
    saveNameList(FRIENDS_KEY, this.friendList);
    this.notifyLists();
  }

  addIgnore(playerName: string): void {
    const name = normalizeName(playerName);
    if (!name || this.ignoreList.includes(name)) {
      return;
    }

    this.ignoreList.push(name);
    saveNameList(IGNORE_KEY, this.ignoreList);
    this.notifyLists();
  }

  removeIgnore(playerName: string): void {
    const name = normalizeName(playerName);
    this.ignoreList = this.ignoreList.filter((n) => n !== name);
    saveNameList(IGNORE_KEY, this.ignoreList);
    this.notifyLists();
  }

  isFriend(playerName: string): boolean {
    return this.friendList.includes(normalizeName(playerName));
  }

  isIgnored(playerName: string): boolean {
    return this.ignoreList.includes(normalizeName(playerName));
  }

  filterNaughtyWords(message: string): string {
    if (
      !this.client.configController.profanityFilter ||
      this.naughtyWords.length === 0
    ) {
      return message;
    }

    let filteredMessage = message;
    for (const word of this.naughtyWords) {
      const regex = new RegExp(word, 'gi');
      filteredMessage = filteredMessage.replace(regex, '*'.repeat(word.length));
    }
    return filteredMessage;
  }
}
