import { useEffect, useState } from 'preact/hooks';
import {
  REPORT_CATEGORIES,
  REPORT_MAX_LENGTH,
  REPORT_MIN_LENGTH,
} from '@/controllers';
import { formatLocaleString } from '@/locale';
import { Button } from '@/ui/components';
import { UI_BLUR, UI_MODAL_BG } from '@/ui/consts';
import { useClient, useLocale } from '@/ui/context';

/** Above every game dialog and HUD element: warnings must be acknowledged before playing on. */
const MODERATION_Z = 70;

/**
 * Alduin moderation UI: official warnings (blocking until acknowledged) and the Report Player form.
 * While either is open the game ignores movement/hotkeys (client.typing), like the chat box does.
 */
export function ModerationOverlay() {
  const client = useClient();
  const { locale } = useLocale();
  const moderation = client.moderationController;
  const [, setTick] = useState(0);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    moderation.subscribe(update);
    return () => moderation.unsubscribe(update);
  }, [moderation]);

  const warning = moderation.warnings[0];
  const report = moderation.reportTarget;
  const active = !!warning || !!report;

  useEffect(() => {
    if (!active) return;
    client.typing = true;
    return () => {
      client.typing = false;
    };
  }, [active, client]);

  useEffect(() => {
    if (report) {
      setCategory('');
      setDescription('');
    }
  }, [report?.playerId]);

  if (warning) {
    const t = locale.moderation;
    return (
      <dialog
        class='modal'
        open
        role='alertdialog'
        aria-labelledby='warning-title'
        style={{ zIndex: MODERATION_Z }}
      >
        <div
          class={`modal-box max-w-md border-2 border-error ${UI_MODAL_BG} ${UI_BLUR}`}
        >
          <h3 id='warning-title' class='font-bold text-error text-lg'>
            {t.warningTitle}
          </h3>
          <p class='pt-3'>{t.warningIntro}</p>
          <p class='pt-1 font-bold text-lg'>{warning.category}</p>
          <p class='pt-3 font-semibold'>{t.warningReason}</p>
          <p class='whitespace-pre-wrap pt-1'>{warning.reason}</p>
          <p class='pt-4 text-sm opacity-80'>{t.warningFooter}</p>
          {warning.issuedAt && (
            <p class='pt-1 text-xs opacity-60'>
              {formatLocaleString(t.warningIssued, { date: warning.issuedAt })}
            </p>
          )}
          <div class='modal-action'>
            <Button
              variant='primary'
              onClick={() => moderation.acknowledgeWarning(warning.id)}
            >
              {t.acknowledge}
            </Button>
          </div>
        </div>
      </dialog>
    );
  }

  if (!report) return null;

  const t = locale.moderation;
  const status = moderation.reportStatus;
  const length = description.trim().length;
  const valid =
    category !== '' &&
    length >= REPORT_MIN_LENGTH &&
    length <= REPORT_MAX_LENGTH;
  const errorText =
    status.state === 'error'
      ? status.code === 2
        ? t.tooMany
        : status.code === 3
          ? t.notFound
          : t.invalid
      : '';

  return (
    <dialog
      class='modal'
      open
      aria-labelledby='report-title'
      style={{ zIndex: MODERATION_Z }}
    >
      <div class={`modal-box max-w-md ${UI_MODAL_BG} ${UI_BLUR}`}>
        <h3 id='report-title' class='font-bold text-lg'>
          {formatLocaleString(t.reportTitle, { name: report.name })}
        </h3>
        {status.state === 'sent' ? (
          <>
            <p class='py-4'>
              {formatLocaleString(t.sent, {
                reference: status.reference,
                code: status.trackingCode,
              })}
            </p>
            <div class='modal-action'>
              <Button
                variant='primary'
                onClick={() => moderation.closeReport()}
              >
                {locale.shared.btnOK}
              </Button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && status.state !== 'sending') {
                moderation.submitReport(category, description.trim());
              }
            }}
          >
            <label class='form-control mt-3 w-full'>
              <span class='label-text pb-1'>{t.category}</span>
              <select
                class='select select-bordered select-sm w-full'
                value={category}
                onChange={(e) =>
                  setCategory((e.target as HTMLSelectElement).value)
                }
              >
                <option value=''>{t.chooseCategory}</option>
                {REPORT_CATEGORIES.map((value, i) => (
                  <option key={value} value={value}>
                    {t.categoryLabels[i] ?? value}
                  </option>
                ))}
              </select>
            </label>
            <label class='form-control mt-3 w-full'>
              <span class='label-text pb-1'>{t.description}</span>
              <textarea
                class='textarea textarea-bordered h-28 w-full'
                maxLength={REPORT_MAX_LENGTH}
                value={description}
                onInput={(e) =>
                  setDescription((e.target as HTMLTextAreaElement).value)
                }
              />
              <span class='label-text-alt pt-1 opacity-70'>
                {t.descriptionHint} ({length}/{REPORT_MAX_LENGTH})
              </span>
            </label>
            {errorText && <p class='pt-2 text-error text-sm'>{errorText}</p>}
            <div class='modal-action'>
              <Button variant='ghost' onClick={() => moderation.closeReport()}>
                {t.cancel}
              </Button>
              <Button
                variant='primary'
                type='submit'
                disabled={!valid || status.state === 'sending'}
              >
                {status.state === 'sending' ? t.sending : t.submit}
              </Button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
