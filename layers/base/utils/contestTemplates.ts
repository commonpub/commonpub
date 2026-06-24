import type { ContestStage, ContestSubmissionTemplateField } from '@commonpub/schema';
import { markdownToBlockTuples } from '@commonpub/editor';
import { newStageId } from './contestStages';

/**
 * Starter templates for a NEW contest. A blank create page is intimidating and
 * leaves organisers to discover the (substantial) submission-form / stage / rubric
 * machinery by hand, so create.vue seeds the `standard` template by default
 * (ContestEditor, create mode, onMounted). Pure + flag-adaptive so it unit-tests in
 * isolation and degrades gracefully on instances where the proposal/PII builder
 * features are OFF.
 *
 * A BlockTuple is `[type, attrs]`; bodies are seeded as structured heading/paragraph
 * blocks via `markdownToBlockTuples` (the same path contestBody.ts uses for legacy
 * markdown), so the seeded copy renders identically in the editor canvas AND the
 * public view — a raw `markdown` block would not (its attr key is `source`, not the
 * `content` an ad-hoc tuple would carry).
 */
export type ContestTemplateBlock = [string, Record<string, unknown>];

export interface ContestTemplateSeed {
  stages: ContestStage[];
  currentStageId: string | null;
  judgingCriteria: Array<{ label: string; weight?: number; description?: string }>;
  descriptionBlocks: ContestTemplateBlock[];
  rulesBlocks: ContestTemplateBlock[];
  prizesBlocks: ContestTemplateBlock[];
}

export interface StandardTemplateOptions {
  /** `features.contestProposals` — if on, the entry stage collects a proposal form
   *  (creates a draft project); else it falls back to attaching a published project. */
  proposals: boolean;
  /** `features.contestPii` — if on, seed a rules-acceptance `agreement` field (the
   *  agreement field type is only offered/edited in the builder when this is on). */
  pii: boolean;
}

const RULES_AGREEMENT_TERMS =
  'By entering, I confirm this submission is my own original work and I agree to the contest rules and code of conduct.';

/** The proposal/entry stage's starter submission form (the approved general shape). */
function standardSubmissionTemplate(opts: StandardTemplateOptions): ContestSubmissionTemplateField[] {
  const fields: ContestSubmissionTemplateField[] = [
    { key: 'project_name', label: 'Project name', type: 'text', required: true },
    { key: 'summary', label: 'One-line summary', type: 'text', required: true, help: 'A single sentence describing your idea.' },
    { key: 'description', label: 'Description', type: 'textarea', required: true, help: 'What you are building and the problem it solves.' },
    { key: 'approach', label: 'Approach', type: 'textarea', required: false, help: 'How you plan to build it (optional).' },
  ];
  // The agreement field type is only surfaced in the builder when contestPii is on,
  // so only seed it there — else it would be a hidden, un-editable required field.
  if (opts.pii) {
    fields.push({
      key: 'rules_agreement',
      label: 'Contest rules',
      type: 'agreement',
      required: true,
      terms: RULES_AGREEMENT_TERMS,
      mustAccept: true,
    });
  }
  return fields;
}

/** The default rubric (contest-level; review stages fall back to it). */
function standardCriteria(): ContestTemplateSeed['judgingCriteria'] {
  return [
    { label: 'Innovation', weight: 40, description: 'Originality and creativity of the idea.' },
    { label: 'Feasibility', weight: 30, description: 'How realistic and well-scoped the plan is.' },
    { label: 'Impact', weight: 30, description: 'Potential value to the community.' },
  ];
}

/**
 * The standard new-contest template: a Proposals (submission) stage with a starter
 * form + rules agreement, a Judging (review) stage, and a Results stage, plus a
 * default rubric and starter Overview/Rules copy. Stage dates are intentionally
 * unset — the organiser sets the schedule, then can set per-stage dates in the
 * Stages tab.
 */
export function standardContestTemplate(opts: StandardTemplateOptions): ContestTemplateSeed {
  const stages: ContestStage[] = [
    {
      id: newStageId(),
      name: 'Proposals',
      kind: 'submission',
      description: 'Entrants submit a proposal for review.',
      submissionMode: opts.proposals ? 'proposal' : 'attach',
      submissionTemplate: standardSubmissionTemplate(opts),
    },
    {
      id: newStageId(),
      name: 'Judging',
      kind: 'review',
      description: 'Judges score entries against the rubric.',
    },
    {
      id: newStageId(),
      name: 'Results',
      kind: 'results',
      description: 'Final standings are published.',
    },
  ];
  return {
    stages,
    currentStageId: null,
    judgingCriteria: standardCriteria(),
    descriptionBlocks: markdownToBlockTuples(
      '## About this contest\n\nDescribe who this contest is for, what to build, and why it matters. Replace this overview with your own.',
    ) as ContestTemplateBlock[],
    rulesBlocks: markdownToBlockTuples(
      '## Rules\n\n- Who can enter\n- What counts as a valid entry\n- How judging works\n\nReplace these with your contest rules.',
    ) as ContestTemplateBlock[],
    prizesBlocks: [],
  };
}
