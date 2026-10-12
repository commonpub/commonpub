<script setup lang="ts">
// Judging, as an organizer sees it (session 261). The judging page showed anyone
// not on the panel "You are not a judge for this contest", admins included, so
// the people running the round had no view of it outside the editor's advancement
// panel. This is that view, read only: how far each judge has got this round, and
// every live entry with the scores and feedback it has so far.
//
// Scores here are the entries route's organizer payload (every judge's score; a
// judge gets only their own). Scoring itself stays with the panel: the server
// refuses a score from anyone who is not an accepted judge.

interface OverviewScore { judgeId: string; score: number; feedback?: string; roundId?: string }
interface OverviewEntry {
  id: string;
  userId: string;
  contentTitle: string;
  authorName: string | null;
  authorUsername: string;
  eliminated?: boolean;
  stageState?: Array<{ stageId: string; status: string }>;
  judgeScores?: OverviewScore[];
}
interface OverviewJudge {
  userId: string;
  role: string;
  acceptedAt: string | Date | null;
  userName: string;
  userUsername: string;
}

const props = defineProps<{
  slug: string;
  entries: OverviewEntry[];
  judges: OverviewJudge[];
  /** The round this view is for (see overviewRound on the judge page). */
  roundId: string | null;
  roundName: string | null;
  /** open: scoring now. closed: its scores are final. upcoming: not started. */
  roundPhase: 'open' | 'closed' | 'upcoming' | null;
}>();

const panel = computed(() => props.judges.filter((j) => j.role !== 'guest'));
const accepted = computed(() => panel.value.filter((j) => !!j.acceptedAt));
// The entries that were in this round: everyone still in, plus (for a closed
// round) those it cut, so its final scores stay readable after the cut.
function cutHere(e: OverviewEntry): boolean {
  return !!props.roundId && (e.stageState ?? []).some((s) => s.stageId === props.roundId && s.status === 'eliminated');
}
const live = computed(() => props.entries.filter((e) => !e.eliminated || cutHere(e)));

// One score per judge per round; pre-round-tagging scores carry no roundId and
// match a null round, the same rule the judge's own view uses.
function roundScores(e: OverviewEntry): OverviewScore[] {
  return (e.judgeScores ?? []).filter((s) => (s.roundId ?? null) === props.roundId);
}
function judgeName(id: string): string {
  const j = props.judges.find((x) => x.userId === id);
  return j ? j.userName || `@${j.userUsername}` : 'Former judge';
}

// A judge never scores their own entry, so it is not in their count.
const judgeRows = computed(() =>
  panel.value.map((j) => {
    const theirs = live.value.filter((e) => e.userId !== j.userId);
    const scored = theirs.filter((e) => roundScores(e).some((s) => s.judgeId === j.userId)).length;
    return { judge: j, scored, total: theirs.length, pending: !j.acceptedAt };
  }),
);

const entryRows = computed(() =>
  live.value.map((e) => {
    const scores = roundScores(e).map((s) => ({ judgeId: s.judgeId, name: judgeName(s.judgeId), score: s.score, feedback: (s.feedback ?? '').trim() }));
    const expected = accepted.value.filter((j) => j.userId !== e.userId).length;
    const average = scores.length ? Math.round((scores.reduce((t, s) => t + s.score, 0) / scores.length) * 10) / 10 : null;
    return { entry: e, scores, expected, average, feedback: scores.filter((s) => s.feedback), cut: cutHere(e) };
  }),
);

const scoresIn = computed(() => entryRows.value.reduce((t, r) => t + r.scores.length, 0));
const scoresExpected = computed(() => entryRows.value.reduce((t, r) => t + r.expected, 0));
const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 100) : 0);
</script>

<template>
  <div class="cpub-jov">
    <p class="cpub-jov-notice" role="note">
      <i class="fa-solid fa-eye" aria-hidden="true"></i>
      <span>
        You're seeing judging as an organizer. Only judges on the panel can score, so this view is read only.
        Advancing entries happens in <NuxtLink :to="`/contests/${slug}/edit`">Edit contest</NuxtLink>, on the Stages tab.
      </span>
    </p>

    <p v-if="!roundId" class="cpub-jov-notice" role="status">
      <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
      <span>This contest has no review round yet, so there is nothing to score.</span>
    </p>
    <p v-else-if="roundPhase === 'upcoming'" class="cpub-jov-notice" role="status">
      <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
      <span>Scoring opens when {{ roundName || 'the next review round' }} starts. Judges can read the entries now.</span>
    </p>
    <p v-else-if="roundPhase === 'closed'" class="cpub-jov-notice" role="status">
      <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
      <span>{{ roundName || 'The last review round' }} has closed. These are its final scores.</span>
    </p>

    <div class="cpub-jov-summary">
      <span v-if="roundName" class="cpub-jov-round">{{ roundName }}</span>
      <span><strong>{{ live.length }}</strong> {{ live.length === 1 ? 'entry' : 'entries' }} in this round</span>
      <span><strong>{{ accepted.length }}</strong> {{ accepted.length === 1 ? 'judge' : 'judges' }} on the panel</span>
      <span><strong>{{ scoresIn }}</strong> of {{ scoresExpected }} scores in</span>
    </div>

    <section class="cpub-jov-section" aria-labelledby="cpub-jov-judges">
      <h2 id="cpub-jov-judges" class="cpub-jov-h">Judges</h2>
      <p v-if="!panel.length" class="cpub-jov-empty">No judges yet. Invite them from the contest page's Judges tab.</p>
      <ul v-else class="cpub-jov-judges">
        <li v-for="row in judgeRows" :key="row.judge.userId" class="cpub-jov-judge">
          <div class="cpub-jov-judge-head">
            <NuxtLink :to="`/u/${row.judge.userUsername}`" class="cpub-jov-name">{{ row.judge.userName || row.judge.userUsername }}</NuxtLink>
            <span v-if="row.pending" class="cpub-jov-tag">Invite not accepted</span>
            <span v-else-if="row.total > 0 && row.scored === row.total" class="cpub-jov-tag cpub-jov-tag-done">Done</span>
          </div>
          <template v-if="!row.pending">
            <div
              class="cpub-jov-bar"
              role="progressbar"
              :aria-valuenow="row.scored"
              aria-valuemin="0"
              :aria-valuemax="row.total"
              :aria-label="`${row.judge.userName || row.judge.userUsername}: ${row.scored} of ${row.total} scored`"
            >
              <span :style="{ width: `${pct(row.scored, row.total)}%` }"></span>
            </div>
            <span class="cpub-jov-count">{{ row.scored }} / {{ row.total }} scored</span>
          </template>
        </li>
      </ul>
    </section>

    <section class="cpub-jov-section" aria-labelledby="cpub-jov-entries">
      <h2 id="cpub-jov-entries" class="cpub-jov-h">Entries</h2>
      <p v-if="!entryRows.length" class="cpub-jov-empty">No entries in this round.</p>
      <ul v-else class="cpub-jov-entries">
        <li v-for="row in entryRows" :key="row.entry.id" class="cpub-jov-entry">
          <div class="cpub-jov-entry-head">
            <NuxtLink :to="`/contests/${slug}/entries/${row.entry.id}`" class="cpub-jov-name">{{ row.entry.contentTitle || 'Untitled' }}</NuxtLink>
            <span class="cpub-jov-author">by {{ row.entry.authorName || `@${row.entry.authorUsername}` }}</span>
            <span v-if="row.cut" class="cpub-jov-tag">Did not advance</span>
          </div>
          <div class="cpub-jov-entry-scores">
            <span class="cpub-jov-avg">
              <template v-if="row.average !== null">Average <strong>{{ row.average }}</strong></template>
              <template v-else>Not scored yet</template>
            </span>
            <span class="cpub-jov-count">{{ row.scores.length }} of {{ row.expected }} judges</span>
          </div>
          <ul v-if="row.scores.length" class="cpub-jov-chips" aria-label="Scores">
            <li v-for="s in row.scores" :key="s.judgeId" class="cpub-jov-chip">{{ s.name }} <strong>{{ s.score }}</strong></li>
          </ul>
          <details v-if="row.feedback.length" class="cpub-jov-feedback">
            <summary>Feedback ({{ row.feedback.length }})</summary>
            <dl>
              <template v-for="f in row.feedback" :key="f.judgeId">
                <dt>{{ f.name }}</dt>
                <dd>{{ f.feedback }}</dd>
              </template>
            </dl>
          </details>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.cpub-jov { display: flex; flex-direction: column; gap: 16px; }
.cpub-jov-notice { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 10px 14px; font-size: 13px; color: var(--text-dim); background: var(--surface2); border: var(--border-width-default) solid var(--border); }
.cpub-jov-notice i { color: var(--accent); margin-top: 3px; }
.cpub-jov-notice a { color: var(--accent); }
.cpub-jov-summary { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; color: var(--text-dim); }
.cpub-jov-round { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); font-weight: 700; }
.cpub-jov-summary strong { color: var(--text); font-family: var(--font-mono); }
.cpub-jov-section { display: flex; flex-direction: column; gap: 10px; }
.cpub-jov-h { margin: 0; font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); }
.cpub-jov-empty { margin: 0; color: var(--text-dim); font-size: 13px; }
.cpub-jov-judges, .cpub-jov-entries, .cpub-jov-chips { list-style: none; margin: 0; padding: 0; }
.cpub-jov-judges { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.cpub-jov-judge, .cpub-jov-entry { border: var(--border-width-default) solid var(--border); background: var(--surface); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.cpub-jov-judge-head, .cpub-jov-entry-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
.cpub-jov-name { color: var(--accent); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.cpub-jov-name:hover { text-decoration: underline; }
.cpub-jov-author { font-size: 12px; color: var(--text-dim); }
.cpub-jov-tag { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 6px; border: var(--border-width-default) solid var(--border); color: var(--text-dim); }
.cpub-jov-tag-done { color: var(--green-text); border-color: var(--green-border, var(--border)); }
.cpub-jov-bar { height: 6px; background: var(--surface2); border: var(--border-width-default) solid var(--border); }
.cpub-jov-bar span { display: block; height: 100%; background: var(--accent); }
.cpub-jov-count { font-size: 12px; font-family: var(--font-mono); color: var(--text-dim); }
.cpub-jov-entries { display: flex; flex-direction: column; gap: 8px; }
.cpub-jov-entry-scores { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; font-size: 13px; }
.cpub-jov-avg { color: var(--text-dim); }
.cpub-jov-avg strong { color: var(--text); font-family: var(--font-mono); font-size: 15px; }
.cpub-jov-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cpub-jov-chip { font-size: 12px; padding: 2px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface2); color: var(--text-dim); }
.cpub-jov-chip strong { color: var(--text); font-family: var(--font-mono); }
.cpub-jov-feedback summary { cursor: pointer; font-size: 12px; color: var(--accent); min-height: 24px; }
.cpub-jov-feedback dl { margin: 8px 0 0; display: grid; gap: 4px; font-size: 13px; }
.cpub-jov-feedback dt { font-weight: 600; color: var(--text); }
.cpub-jov-feedback dd { margin: 0 0 6px; color: var(--text-dim); white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
