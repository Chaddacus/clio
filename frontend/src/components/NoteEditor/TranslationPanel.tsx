// TranslationPanel: request and show translations of a note's transcript.
// Owns its own query/mutation state; it never edits the note. The panel renders
// nothing until the note is transcribed, a notice when the server has no
// translation provider, and otherwise a target picker plus the stored
// translations with their pending / failed / completed states.
import React, { useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { ArrowPathIcon, LanguageIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { translationsAPI } from '../../services/api';
import { NoteTranslation, Speaker, TranscriptionSegment, VoiceNote } from '../../types';
import { LANGUAGE_OPTIONS, formatTimestamp, groupBySpeaker, languageLabel } from '../../utils/transcript';

interface Props {
  noteId: number;
  noteStatus: VoiceNote['status'];
  sourceLanguage: string;
  segments: TranscriptionSegment[];
  speakers: Speaker[];
}

const defaultTarget = (sourceLanguage: string): string => (sourceLanguage === 'en' ? 'es' : 'en');

const TranslationPanel: React.FC<Props> = ({ noteId, noteStatus, sourceLanguage, segments, speakers }) => {
  const [target, setTarget] = useState(() => defaultTarget(sourceLanguage));
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery(
    ['translations', noteId],
    () => translationsAPI.list(noteId),
    {
      enabled: noteStatus === 'completed',
      // Poll while any translation is in flight; stop when all are terminal.
      refetchInterval: (res) =>
        res?.data?.data?.some((t) => t.status === 'pending') ? 2500 : false,
    }
  );

  const requestMutation = useMutation(
    (language: string) => translationsAPI.request(noteId, language),
    {
      onSuccess: (res, language) => {
        setSelected(language);
        if (res.status === 202) toast.success(`Translating to ${languageLabel(language)}…`);
        refetch();
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Translation request failed');
      },
    }
  );

  if (noteStatus !== 'completed' || isLoading || !data) return null;

  const enabled = data.data.enabled;
  const translations: NoteTranslation[] = data.data.data ?? [];
  const targets = LANGUAGE_OPTIONS.filter((o) => o.value !== 'auto' && o.value !== sourceLanguage);

  const byRecency = [...translations].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const current =
    translations.find((t) => t.target_language === selected) ?? byRecency[0] ?? null;

  const translatedBySegment = new Map<number, string>(
    (current?.segments ?? []).map((s) => [s.segment_id, s.text])
  );

  return (
    <div className="card p-6" data-testid="translation-panel">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-editorial text-xl font-light text-on-surface">Translation</h3>
      </div>

      {!enabled ? (
        <p className="text-sm text-on-surface-variant" data-testid="translation-disabled">
          Translation is not enabled on this server.
        </p>
      ) : (
        <>
          <p className="text-xs text-on-surface-variant mb-4">
            The transcript stays in {languageLabel(sourceLanguage)}. A translation is stored beside it.
          </p>

          <form
            className="flex flex-wrap items-end gap-3 mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              requestMutation.mutate(target);
            }}
          >
            <div>
              <label htmlFor="translation-target" className="block text-xs uppercase tracking-wider text-on-surface-variant mb-1">
                Translate to
              </label>
              <select
                id="translation-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="input-field text-sm py-1.5"
              >
                {targets.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={requestMutation.isLoading}
              className="flex items-center space-x-2 btn-primary text-xs py-1.5 px-4"
            >
              {requestMutation.isLoading ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <LanguageIcon className="h-4 w-4" />
              )}
              <span>Translate</span>
            </button>
          </form>

          {translations.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Stored translations">
              {translations.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={current?.id === t.id}
                  onClick={() => setSelected(t.target_language)}
                  className={`px-3 py-1 rounded-sm text-xs font-medium ${
                    current?.id === t.id
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface'
                  }`}
                >
                  {languageLabel(t.target_language)}
                  {t.status === 'pending' ? '…' : t.status === 'failed' ? ' (failed)' : ''}
                </button>
              ))}
            </div>
          )}

          {!current && (
            <p className="text-sm text-on-surface-variant" data-testid="translation-empty">
              No translations yet. Pick a language and press Translate.
            </p>
          )}

          {current?.status === 'pending' && (
            <div role="status" className="flex items-center space-x-2 text-sm text-on-surface-variant" data-testid="translation-pending">
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              <span>Translating to {languageLabel(current.target_language)}…</span>
            </div>
          )}

          {current?.status === 'failed' && (
            <div role="alert" className="flex items-center justify-between text-sm" data-testid="translation-failed">
              <span className="text-error">{current.error_message || 'Translation failed.'}</span>
              <button
                type="button"
                onClick={() => requestMutation.mutate(current.target_language)}
                disabled={requestMutation.isLoading}
                className="btn-secondary text-xs py-1 px-3"
              >
                Retry
              </button>
            </div>
          )}

          {current?.status === 'completed' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                  {languageLabel(current.source_language)} → {languageLabel(current.target_language)}
                </span>
              </div>
              <p
                className="whitespace-pre-wrap text-on-surface font-sans leading-relaxed"
                data-testid="translation-text"
                data-language={current.target_language}
              >
                {current.text}
              </p>

              {current.segments.length > 0 && (
                <div className="space-y-3" data-testid="translation-turns">
                  {speakers.length > 0
                    ? groupBySpeaker(segments).map((turn, index) => {
                        const speaker = speakers.find((s) => s.label === turn.speakerLabel);
                        return (
                          <div key={index} className="p-3 bg-surface-container-high rounded-lg">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-on-surface">
                                {speaker?.name || turn.speakerLabel || 'Unknown speaker'}
                              </span>
                              <span className="flex-shrink-0 text-xs text-on-surface-variant font-mono uppercase tracking-wider">
                                {formatTimestamp(turn.start)}
                              </span>
                            </div>
                            <div className="text-sm text-on-surface font-sans leading-relaxed">
                              {turn.segments.map((s) => translatedBySegment.get(s.id) ?? '').join(' ')}
                            </div>
                          </div>
                        );
                      })
                    : segments.map((segment) => (
                        <div key={segment.id} className="flex items-start space-x-3 p-3 bg-surface-container-high rounded-lg">
                          <div className="flex-shrink-0 text-xs text-on-surface-variant font-mono uppercase tracking-wider mt-1">
                            {formatTimestamp(segment.start_time)}
                          </div>
                          <div className="flex-1 text-sm text-on-surface font-sans leading-relaxed">
                            {translatedBySegment.get(segment.id) ?? ''}
                          </div>
                        </div>
                      ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TranslationPanel;
