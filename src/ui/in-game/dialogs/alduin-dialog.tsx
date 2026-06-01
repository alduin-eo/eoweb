import type { TransactionEntry } from 'eolib';
import { TransactionAction, TransactionStatus } from 'eolib';
import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import {
  FaArrowDown,
  FaArrowUp,
  FaChevronDown,
  FaChevronRight,
  FaCoins,
  FaCopy,
  FaQrcode,
  FaTrash,
  FaWallet,
} from 'react-icons/fa';
import { ALDUIN_ITEM_ID } from '@/consts';
import { UI_ITEM_BG, UI_PANEL_BORDER } from '@/ui/consts';
import { useClient, useLocale } from '@/ui/context';
import { DialogBase } from './dialog-base';

const ADDRESS_STORAGE_KEY = 'eoweb:alduin-address';

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(addr: string): boolean {
  return SOLANA_ADDRESS_REGEX.test(addr);
}

function loadSavedAddress(): string {
  try {
    return localStorage.getItem(ADDRESS_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveAddress(addr: string): void {
  try {
    localStorage.setItem(ADDRESS_STORAGE_KEY, addr);
  } catch {
    /* ignore */
  }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AlduinDialog() {
  const client = useClient();
  const { locale } = useLocale();

  const [balance, setBalance] = useState(() =>
    client.inventoryController.getItemAmount(ALDUIN_ITEM_ID),
  );
  const [depositWallet, setDepositWallet] = useState(
    () => client.alduinController.depositWallet,
  );
  const [depositMin, setDepositMin] = useState(
    () => client.alduinController.depositMin,
  );
  const [depositMax, setDepositMax] = useState(
    () => client.alduinController.depositMax,
  );
  const [withdrawMin, setWithdrawMin] = useState(
    () => client.alduinController.withdrawMin,
  );
  const [withdrawMax, setWithdrawMax] = useState(
    () => client.alduinController.withdrawMax,
  );
  const [page, setPage] = useState(() => client.alduinController.page);
  const [totalPages, setTotalPages] = useState(
    () => client.alduinController.totalPages,
  );
  const [transactions, setTransactions] = useState(
    () => client.alduinController.transactions,
  );

  const [userAddress, setUserAddress] = useState(loadSavedAddress);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [expandedTxs, setExpandedTxs] = useState<Set<number>>(new Set());

  const numDepositAmount = Number.parseInt(depositAmount, 10) || 0;
  const numWithdrawAmount = Number.parseInt(withdrawAmount, 10) || 0;

  useEffect(() => {
    const sync = () => {
      const c = client.alduinController;
      setBalance(client.inventoryController.getItemAmount(ALDUIN_ITEM_ID));
      setDepositWallet(c.depositWallet);
      setDepositMin(c.depositMin);
      setDepositMax(c.depositMax);
      setWithdrawMin(c.withdrawMin);
      setWithdrawMax(c.withdrawMax);
      setPage(c.page);
      setTotalPages(c.totalPages);
      setTransactions(c.transactions);
    };

    const handleInventoryChanged = () => {
      setBalance(client.inventoryController.getItemAmount(ALDUIN_ITEM_ID));
    };

    const handleNotify = () => {
      client.alduinController.requestWalletInfo(page);
    };

    client.alduinController.subscribeWalletInfo(sync);
    client.alduinController.subscribeNotify(handleNotify);
    client.inventoryController.subscribeInventoryChanged(
      handleInventoryChanged,
    );

    return () => {
      client.alduinController.unsubscribeWalletInfo(sync);
      client.alduinController.unsubscribeNotify(handleNotify);
      client.inventoryController.unsubscribeInventoryChanged(
        handleInventoryChanged,
      );
    };
  }, [client, page]);

  useEffect(() => {
    client.alduinController.requestWalletInfo(page);
  }, [client, page]);

  useEffect(() => {
    if (!depositWallet) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(depositWallet, { width: 160, margin: 1 }).then(
      (url) => {
        if (!cancelled) setQrDataUrl(url);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [depositWallet]);

  const handleAddressBlur = () => {
    saveAddress(userAddress);
  };

  const handleDeposit = () => {
    if (!numDepositAmount || numDepositAmount <= 0) return;
    if (!depositAmount) return;
    if (!userAddress || !isValidSolanaAddress(userAddress)) return;
    client.alduinController.deposit(numDepositAmount, userAddress);
    setDepositAmount('');
  };

  const handleWithdraw = () => {
    if (!numWithdrawAmount || numWithdrawAmount <= 0) return;
    if (!withdrawAmount) return;
    if (!userAddress || !isValidSolanaAddress(userAddress)) return;
    client.alduinController.withdraw(numWithdrawAmount, userAddress);
    setWithdrawAmount('');
  };

  const handleCancel = (txId: number) => {
    client.alduinController.cancelTransaction(txId);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(depositWallet).catch(() => {});
  };

  const addressValid =
    userAddress.length === 0 || isValidSolanaAddress(userAddress);

  const sliderMaxDeposit = depositMax > 0 ? depositMax : balance;
  const sliderMaxWithdraw = withdrawMax > 0 ? withdrawMax : balance;

  return (
    <DialogBase id='alduin' title={locale.alduin.title} size='lg'>
      <div class='space-y-2 p-2' onKeyDown={(e) => e.stopPropagation()}>
        <div
          class={`rounded border ${UI_PANEL_BORDER} ${UI_ITEM_BG} space-y-1 p-2`}
        >
          <span class='font-semibold text-primary/70 text-xs'>
            {locale.alduin.yourWallet}
          </span>
          <input
            type='text'
            placeholder={locale.alduin.walletAddress}
            class={`input input-bordered input-xs w-full ${!addressValid ? 'input-error' : ''}`}
            value={userAddress}
            onInput={(e) =>
              setUserAddress((e.target as HTMLInputElement).value)
            }
            onBlur={handleAddressBlur}
          />
          {!addressValid && (
            <span class='text-error text-xs'>
              {locale.alduin.invalidAddress}
            </span>
          )}
        </div>

        <div class={`rounded border ${UI_PANEL_BORDER} ${UI_ITEM_BG} p-2`}>
          <div class='flex items-center justify-between text-sm'>
            <span class='flex items-center gap-1 text-primary/60'>
              <span class='text-warning'>
                <FaCoins size={11} />
              </span>
              {locale.alduin.balance}
            </span>
            <span class='font-semibold text-warning tabular-nums'>
              {balance.toLocaleString()}
            </span>
          </div>
          <div class='mt-1 flex items-center justify-between text-primary/50 text-xs'>
            <div class='flex items-center gap-1'>
              <FaWallet size={10} />
              <span class='max-w-40 truncate' title={depositWallet}>
                {depositWallet || locale.alduin.noWallet}
              </span>
              {depositWallet && (
                <>
                  <button
                    type='button'
                    class='btn btn-ghost btn-xs px-1'
                    onClick={handleCopyAddress}
                    aria-label={locale.alduin.copyAddress}
                  >
                    <FaCopy size={10} />
                  </button>
                  <button
                    type='button'
                    class='btn btn-ghost btn-xs px-1'
                    onClick={() => setShowQr((v) => !v)}
                    aria-label={locale.alduin.scanToDeposit}
                  >
                    <FaQrcode size={10} />
                  </button>
                </>
              )}
            </div>
            <span class='text-primary/40'>{locale.alduin.depositAddress}</span>
          </div>
          {showQr && qrDataUrl && (
            <div class='mt-2 flex justify-center'>
              <img
                src={qrDataUrl}
                alt={locale.alduin.scanToDeposit}
                class='rounded'
                width={160}
                height={160}
              />
            </div>
          )}
        </div>

        <div class='grid grid-cols-2 gap-2'>
          <div
            class={`rounded border ${UI_PANEL_BORDER} ${UI_ITEM_BG} space-y-1.5 p-2`}
          >
            <span class='font-semibold text-primary/70 text-xs'>
              {locale.alduin.deposit}
            </span>
            <div class='flex items-center gap-2'>
              <input
                type='range'
                min={depositMin}
                max={sliderMaxDeposit}
                step={1}
                value={numDepositAmount}
                class='range range-xs flex-1'
                onInput={(e) =>
                  setDepositAmount(String((e.target as HTMLInputElement).value))
                }
              />
              <input
                type='number'
                min={depositMin}
                max={sliderMaxDeposit}
                step={1}
                placeholder={locale.alduin.amount}
                class='input input-bordered input-xs w-20'
                value={depositAmount}
                onInput={(e) =>
                  setDepositAmount((e.target as HTMLInputElement).value)
                }
              />
            </div>
            <div class='flex flex-wrap gap-1'>
              {[10, 50, 100, 1000].map((n) => (
                <button
                  key={n}
                  type='button'
                  class='btn btn-ghost btn-xs flex-1'
                  onClick={() =>
                    setDepositAmount(
                      String(Math.min(numDepositAmount + n, sliderMaxDeposit)),
                    )
                  }
                >
                  +{n}
                </button>
              ))}
            </div>
            <button
              type='button'
              class='btn btn-primary btn-xs w-full'
              disabled={!userAddress || !addressValid || !numDepositAmount}
              onClick={handleDeposit}
            >
              <FaArrowDown size={10} />
              {locale.alduin.depositBtn}
            </button>
          </div>

          <div
            class={`rounded border ${UI_PANEL_BORDER} ${UI_ITEM_BG} space-y-1.5 p-2`}
          >
            <span class='font-semibold text-primary/70 text-xs'>
              {locale.alduin.withdraw}
            </span>
            <div class='flex items-center gap-2'>
              <input
                type='range'
                min={withdrawMin}
                max={sliderMaxWithdraw}
                step={1}
                value={numWithdrawAmount}
                class='range range-xs flex-1'
                onInput={(e) =>
                  setWithdrawAmount(
                    String((e.target as HTMLInputElement).value),
                  )
                }
              />
              <input
                type='number'
                min={withdrawMin}
                max={sliderMaxWithdraw}
                step={1}
                placeholder={locale.alduin.amount}
                class='input input-bordered input-xs w-20'
                value={withdrawAmount}
                onInput={(e) =>
                  setWithdrawAmount((e.target as HTMLInputElement).value)
                }
              />
            </div>
            <div class='flex flex-wrap gap-1'>
              {[10, 50, 100, 1000].map((n) => (
                <button
                  key={n}
                  type='button'
                  class='btn btn-ghost btn-xs flex-1'
                  onClick={() =>
                    setWithdrawAmount(
                      String(
                        Math.min(numWithdrawAmount + n, sliderMaxWithdraw),
                      ),
                    )
                  }
                >
                  +{n}
                </button>
              ))}
            </div>
            <button
              type='button'
              class='btn btn-secondary btn-xs w-full'
              disabled={!userAddress || !addressValid || !numWithdrawAmount}
              onClick={handleWithdraw}
            >
              <FaArrowUp size={10} />
              {locale.alduin.withdrawBtn}
            </button>
          </div>
        </div>

        <div
          class={`rounded border ${UI_PANEL_BORDER} ${UI_ITEM_BG} space-y-1 p-2`}
        >
          <div class='flex items-center justify-between'>
            <span class='font-semibold text-primary/70 text-xs'>
              {locale.alduin.transactionHistory}
            </span>
            {totalPages > 1 && (
              <div class='flex items-center gap-1 text-primary/50 text-xs'>
                <button
                  type='button'
                  class='btn btn-ghost btn-xs px-1'
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  prev
                </button>
                <span class='tabular-nums'>
                  {page}/{totalPages}
                </span>
                <button
                  type='button'
                  class='btn btn-ghost btn-xs px-1'
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  next
                </button>
              </div>
            )}
          </div>

          {transactions.length === 0 ? (
            <div class='py-4 text-center text-primary/40 text-xs'>
              {locale.alduin.noTransactions}
            </div>
          ) : (
            <div class='overflow-x-auto'>
              <table class='table-xs table'>
                <thead>
                  <tr class='text-primary/50 text-xs'>
                    <th>{locale.alduin.colDate}</th>
                    <th>{locale.alduin.colType}</th>
                    <th class='text-right'>{locale.alduin.colAmount}</th>
                    <th>{locale.alduin.colStatus}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: TransactionEntry) => {
                    const isExpanded = expandedTxs.has(tx.id);
                    const toggle = () => {
                      setExpandedTxs((prev) => {
                        const next = new Set(prev);
                        if (next.has(tx.id)) {
                          next.delete(tx.id);
                        } else {
                          next.add(tx.id);
                        }
                        return next;
                      });
                    };

                    return (
                      <>
                        <tr
                          key={tx.id}
                          class='cursor-pointer text-xs'
                          onClick={toggle}
                        >
                          <td>
                            <span class='inline-flex items-center gap-1'>
                              {isExpanded ? (
                                <FaChevronDown size={8} />
                              ) : (
                                <FaChevronRight size={8} />
                              )}
                              <span class='text-primary/60 tabular-nums'>
                                {formatTimestamp(tx.timestamp)}
                              </span>
                            </span>
                          </td>
                          <td>
                            <span
                              class={
                                tx.action === TransactionAction.Deposit
                                  ? 'text-success'
                                  : 'text-info'
                              }
                            >
                              {tx.action === TransactionAction.Deposit
                                ? locale.alduin.txDeposit
                                : locale.alduin.txWithdraw}
                            </span>
                          </td>
                          <td class='text-right tabular-nums'>
                            {tx.amount.toLocaleString()}
                          </td>
                          <td>
                            <span
                              class={
                                tx.status === TransactionStatus.Pending
                                  ? 'text-warning'
                                  : tx.status === TransactionStatus.Approved
                                    ? 'text-success'
                                    : 'text-error'
                              }
                            >
                              {tx.status === TransactionStatus.Pending
                                ? locale.alduin.statusPending
                                : tx.status === TransactionStatus.Approved
                                  ? locale.alduin.statusApproved
                                  : locale.alduin.statusCancelled}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {tx.status === TransactionStatus.Pending && (
                              <button
                                type='button'
                                class='btn btn-ghost btn-xs px-1 text-error'
                                onClick={() => handleCancel(tx.id)}
                                aria-label={locale.alduin.cancelTx}
                              >
                                <FaTrash size={10} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${tx.id}-detail`} class='text-xs'>
                            <td colSpan={5} class='p-0'>
                              <div class='space-y-0.5 px-6 pt-0.5 pb-1.5'>
                                {tx.walletAddress && (
                                  <div class='flex items-center gap-1 text-primary/50'>
                                    <FaWallet size={9} />
                                    <span
                                      class='max-w-56 truncate'
                                      title={tx.walletAddress}
                                    >
                                      {tx.walletAddress}
                                    </span>
                                  </div>
                                )}
                                {tx.comment && (
                                  <div class='text-primary/50 italic'>
                                    {tx.comment}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DialogBase>
  );
}
