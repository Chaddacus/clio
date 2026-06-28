import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { ChatBubbleLeftRightIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { supportAPI } from '../../services/api';
import { SupportKind, SupportRequest } from '../../types';

const KINDS: { value: SupportKind; label: string }[] = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'change', label: 'Change how it works' },
  { value: 'feature', label: 'New capability' },
];

const SupportWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SupportKind>('bug');
  const [body, setBody] = useState('');
  const [needsDetail, setNeedsDetail] = useState('');
  const [done, setDone] = useState<SupportRequest | null>(null);

  const mutation = useMutation(
    () => supportAPI.create({ kind, body }),
    {
      onSuccess: (resp) => {
        const sr = resp.data;
        if (sr.status === 'needs_detail') {
          setNeedsDetail(sr.gate_reason);
        } else {
          setDone(sr);
        }
      },
    }
  );

  const reset = () => {
    setBody('');
    setNeedsDetail('');
    setDone(null);
    setKind('bug');
    mutation.reset();
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setNeedsDetail('');
    mutation.mutate();
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Get help or request a change"
          onClick={() => setOpen(true)}
          data-testid="support-fab"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-surface shadow-lg hover:opacity-90 transition-opacity"
        >
          <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-medium">Support</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Support"
            data-testid="support-modal"
            className="relative w-full sm:w-[26rem] bg-surface-container-low rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-editorial text-xl font-light text-on-surface">
                {done ? 'Thanks — we’re on it' : 'Tell us what to change'}
              </h2>
              <button
                type="button"
                aria-label="Close support"
                onClick={close}
                className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {done ? (
              <div data-testid="support-done" className="text-sm text-on-surface-variant space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p>
                    Your request was filed{done.github_issue_number ? ` as issue #${done.github_issue_number}` : ''} and
                    handed to the codex pipeline to ground, build, test, and ship.
                  </p>
                </div>
                {done.github_issue_url && (
                  <a
                    href={done.github_issue_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-primary hover:underline"
                  >
                    Track it on GitHub →
                  </a>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="block w-full mt-2 px-4 py-2 rounded-lg bg-surface-container-high text-on-surface text-sm font-medium hover:bg-surface-container-highest"
                >
                  Submit another
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type of request">
                  {KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      role="radio"
                      aria-checked={kind === k.value}
                      onClick={() => setKind(k.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        kind === k.value
                          ? 'bg-primary text-surface'
                          : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={5}
                  data-testid="support-body"
                  placeholder="What were you doing, what happened, and what should happen instead? Mention the screen or feature (transcription, speakers, folders, recording…)."
                  className="w-full rounded-lg bg-surface-container-high border border-outline-variant/20 p-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
                />

                {needsDetail && (
                  <p data-testid="support-needs-detail" className="text-sm text-amber-600 dark:text-amber-400">
                    {needsDetail}
                  </p>
                )}
                {mutation.isError && (
                  <p className="text-sm text-red-500">Something went wrong. Please try again.</p>
                )}

                <button
                  type="submit"
                  disabled={mutation.isLoading || body.trim().length === 0}
                  data-testid="support-submit"
                  className="w-full px-4 py-2.5 rounded-lg bg-primary text-surface text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {mutation.isLoading ? 'Sending…' : 'Send request'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SupportWidget;
