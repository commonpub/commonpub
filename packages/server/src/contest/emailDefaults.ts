import type { BlockTuple } from '@commonpub/editor';

/**
 * Default block bodies for the per-contest email editor. When a contest has no
 * saved override, the editor is seeded with these so it opens with a real,
 * editable starter template (rather than a blank canvas) — organizers tweak from
 * a working default. `{token}` placeholders (username, contestTitle, deadline,
 * timeRemaining) are interpolated by renderEmailBlocks at send/preview time, so
 * the defaults mirror the built-in inline copy in the email templates.
 */
export type ContestEmailKind = 'confirmation' | 'reminder';

export function defaultContestEmailBlocks(kind: ContestEmailKind): BlockTuple[] {
  if (kind === 'reminder') {
    return [
      ['heading', { text: 'Hi {username},', level: 2 }],
      [
        'text',
        {
          text: 'The submission deadline for {contestTitle} is in about {timeRemaining}. Make sure your entry is in before then.',
        },
      ],
    ];
  }
  return [
    ['heading', { text: 'Hi {username},', level: 2 }],
    [
      'text',
      {
        text: 'You are now registered for {contestTitle}. We will send you reminders as the submission deadline approaches.',
      },
    ],
  ];
}
