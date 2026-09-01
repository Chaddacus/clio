// Transcript display helpers shared by the note page and the translation panel:
// the language list, label lookup, timestamp formatting, and speaker-turn grouping.
import { TranscriptionSegment } from '../types';

export const formatTimestamp = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export interface SpeakerTurn {
  speakerLabel: string;
  start: number;
  segments: TranscriptionSegment[];
}

// Languages the app offers for transcription. Mirrors VoiceNote.LANGUAGE_CHOICES
// on the backend; the badge, the re-transcribe dialog, and the translation
// target list all read from here.
export const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
];

// Human label for a language code; unknown codes show as-is.
export const languageLabel = (code: string): string =>
  LANGUAGE_OPTIONS.find((o) => o.value === code)?.label ?? code;

// Collapse consecutive same-speaker segments into a single turn for display.
export const groupBySpeaker = (segments: TranscriptionSegment[]): SpeakerTurn[] => {
  const turns: SpeakerTurn[] = [];
  for (const seg of segments) {
    const last = turns[turns.length - 1];
    if (last && last.speakerLabel === seg.speaker_id) {
      last.segments.push(seg);
    } else {
      turns.push({ speakerLabel: seg.speaker_id, start: seg.start_time, segments: [seg] });
    }
  }
  return turns;
};
