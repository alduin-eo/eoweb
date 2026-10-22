import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import {
  FaCoins,
  FaEarthAmericas,
  FaFlag,
  FaGauge,
  FaRobot,
  FaServer,
  FaUsers,
} from 'react-icons/fa6';
import type { AdminCpSession } from '@/controllers';
import { useClient } from '@/ui/context';
import { useViewport, useWindowManager } from '@/ui/in-game';
import { BotsSection } from './admin-cp-bots';
import { ItemsSection } from './admin-cp-items';
import { PlayersSection } from './admin-cp-players';
import { ReportsSection } from './admin-cp-reports';
import { DashboardSection, ServerSection } from './admin-cp-server';
import {
  AdminCpContext,
  ConfirmModal,
  type ConfirmRequest,
  ErrorLine,
  Loading,
  SelectInput,
} from './admin-cp-shared';
import { WorldSection } from './admin-cp-world';
import { DialogBase } from './dialog-base';

type SectionId =
  | 'dashboard'
  | 'players'
  | 'items'
  | 'bots'
  | 'reports'
  | 'server'
  | 'world';

const SECTIONS: { id: SectionId; label: string; Icon: typeof FaGauge }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: FaGauge },
  { id: 'players', label: 'Players', Icon: FaUsers },
  { id: 'items', label: 'Items & Economy', Icon: FaCoins },
  { id: 'bots', label: 'Bots', Icon: FaRobot },
  { id: 'reports', label: 'Reports', Icon: FaFlag },
  { id: 'server', label: 'Server', Icon: FaServer },
  { id: 'world', label: 'World', Icon: FaEarthAmericas },
];

const MOBILE_BREAKPOINT = 640;

export function AdminCpDialog() {
  const client = useClient();
  const { closeDialog } = useWindowManager();
  const { vw } = useViewport();
  const mobile = vw < MOBILE_BREAKPOINT;
  const rootRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<AdminCpSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>('dashboard');
  const [player, setPlayer] = useState<number | null>(null);
  const [report, setReport] = useState<number | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmRequest | null>(
    null,
  );
  const [status, setStatus] = useState<{
    kind: 'ok' | 'error';
    message: string;
  } | null>(null);

  const loadSession = useCallback(() => {
    setSessionError(null);
    client.adminCpController
      .loadSession()
      .then(setSession)
      .catch((e: Error) => setSessionError(e.message));
  }, [client]);

  useEffect(() => {
    loadSession();
    // never leave the game thinking a panel field still has focus
    return () => {
      client.typing = false;
    };
  }, [client, loadSession]);

  // Escape closes the confirmation first, then the panel (not while typing in the chat)
  const confirmRef = useRef(pendingConfirm);
  confirmRef.current = pendingConfirm;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const active = document.activeElement;
      const inPanel = !!active && !!rootRef.current?.contains(active);
      if (!inPanel && active && active !== document.body) return;
      e.preventDefault();
      if (confirmRef.current) setPendingConfirm(null);
      else closeDialog('adminCp');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeDialog]);

  const notify = useCallback(
    (message: string, kind: 'ok' | 'error' = 'ok') => {
      setStatus({ kind, message });
      client.toastController.show(message);
    },
    [client],
  );

  const request = useCallback(
    <T,>(op: string, params: Record<string, unknown> = {}) =>
      client.adminCpController.request<T>(op, params),
    [client],
  );

  const act = useCallback(
    async (
      op: string,
      params: Record<string, unknown>,
      onDone?: (data: { message?: string } & Record<string, unknown>) => void,
    ) => {
      try {
        const data = await client.adminCpController.request<
          { message?: string } & Record<string, unknown>
        >(op, params);
        notify(data?.message ?? 'Done.');
        onDone?.(data ?? {});
        return true;
      } catch (e) {
        notify((e as Error).message, 'error');
        return false;
      }
    },
    [client, notify],
  );

  const openPlayer = useCallback((characterId: number) => {
    setSection('players');
    setPlayer(characterId);
  }, []);

  const context = useMemo(
    () =>
      session && {
        session,
        request,
        act,
        confirm: setPendingConfirm,
        notify,
        openPlayer,
      },
    [session, request, act, notify, openPlayer],
  );

  const go = (id: string) => {
    setSection(id as SectionId);
    if (id === 'players') setPlayer(null);
    if (id === 'reports') setReport(null);
  };

  let body: preact.ComponentChildren;
  if (sessionError)
    body = <ErrorLine error={sessionError} onRetry={loadSession} />;
  else if (!context) body = <Loading what='Opening the Admin CP' />;
  else {
    body = (
      <AdminCpContext.Provider value={context}>
        <div class={`flex min-h-0 gap-2 ${mobile ? 'flex-col' : 'flex-row'}`}>
          {mobile ? (
            <SelectInput
              value={section}
              onChange={go}
              options={SECTIONS.map((s) => ({ value: s.id, label: s.label }))}
            />
          ) : (
            <nav
              class='flex w-36 shrink-0 flex-col gap-0.5'
              aria-label='Admin CP sections'
            >
              {SECTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type='button'
                  class={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${section === id ? 'bg-primary/20 font-semibold text-primary' : 'hover:bg-base-content/10'}`}
                  onClick={() => go(id)}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
              <div class='mt-auto px-2 pt-2 text-[0.6rem] text-base-content/40'>
                {context.session.name} · level {context.session.admin_level}
                {context.session.owner ? ' · owner' : ''}
                <br />
                server {context.session.version}
              </div>
            </nav>
          )}
          <div class='min-w-0 flex-1'>
            {section === 'dashboard' && <DashboardSection goTo={go} />}
            {section === 'players' && (
              <PlayersSection selected={player} onSelect={setPlayer} />
            )}
            {section === 'items' && <ItemsSection />}
            {section === 'bots' && <BotsSection />}
            {section === 'reports' && (
              <ReportsSection selected={report} onSelect={setReport} />
            )}
            {section === 'server' && <ServerSection />}
            {section === 'world' && <WorldSection />}
          </div>
        </div>
        {status && (
          <div
            class={`mt-2 truncate rounded px-2 py-1 text-xs ${status.kind === 'ok' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}
            role='status'
            title={status.message}
          >
            {status.message}
          </div>
        )}
      </AdminCpContext.Provider>
    );
  }

  return (
    <DialogBase
      id='adminCp'
      title='Admin Control Panel'
      width={mobile ? '98vw' : 'min(980px, 94vw)'}
      avoidBottom
    >
      <div ref={rootRef} class='relative p-1'>
        {body}
        {pendingConfirm && (
          <ConfirmModal
            request={pendingConfirm}
            onClose={() => setPendingConfirm(null)}
          />
        )}
      </div>
    </DialogBase>
  );
}
