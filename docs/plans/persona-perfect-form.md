# Persona, in its most perfect form

A research-grounded vision for the persona / privacy surfaces. **This is a direction document,
not a commitment.** Nothing here is scheduled; several parts are deliberately provocative and one
is research-stage. Written after the session-255 build, the privacy-model correction and two UX
passes, because the thing we have now is good and is still built on one assumption worth naming.

---

## 0. The assumption we should drop

Everything we have built so far is **a smaller, more honest version of a big-tech data product.**
Consent cards, a purpose registry, k-anonymous aggregates, a rights dashboard, a disclosure log.
Every piece is defensible, and every piece is modelled on what a company builds when it wants to
process personal data lawfully at scale.

But a CommonPub instance is not that. It is 50 to 500 people who mostly know each other, run by an
operator you can find in the workshop on a Tuesday. That changes three things at the root:

1. **The adversary is the insider, not the corporation.** Our k-anonymity floor protects against a
   stranger with an auxiliary dataset. The literature is explicit that k-anonymity gives
   [no protection against attribute disclosure or an informed intruder][kdp]. On a 40-person
   makerspace, "3 members are open to relocating" plus knowing who was in the room *is*
   identification. We are defending against the wrong person.
2. **The unit of harm is partly collective.** "60% of our members work in defence" is a statement
   about the community, and no individual's consent covers it. [Group-privacy work][group] is clear
   that aggregate harms are communal even where individual notice was given.
3. **The data flows one way.** Members answer; the operator gets a dashboard. Nothing comes back.

The perfect form fixes all three, and the third is the one that changes how the feature *feels*.

---

## 1. The organising frame: contextual integrity

[Nissenbaum's contextual integrity][ci] describes every information flow with five parameters:
**data type, data subject, sender, recipient, transmission principle.** Privacy is violated when a
flow breaks the norms of its context, not when data is "shared" in the abstract.

This is the right spine for persona, because it is exactly what our copy is currently *describing in
prose*. Today a member reads 84 words to learn that their tech-stack answer (type) about them
(subject) goes from this instance (sender) to a named recruiter (recipient) only while a grant is
live (transmission principle).

**In its perfect form the interface shows those five things rather than narrating them.** One row
per flow. The prose becomes the fallback, not the interface.

---

## 2. Seven moves

### 2.1 One canonical "who sees what" view

Not a merge of the three pages — the split between public profile, private questions and the rights
dashboard is a *correct* separation and was hard won. What is missing is a single place that answers
the only question a member actually has: **"who can see this?"**

An inventory, one row per field, grouped by audience: *Anyone on the internet · Signed-in members ·
Only the operators · Named third parties · Counted in totals*. Each row links to where it is edited.

This directly targets two patterns the EDPB names as deceptive: **privacy maze** (making people
navigate excessive pages) and **decontextualising** (putting controls on irrelevant pages).
[EDPB Guidelines 03/2022][edpb] is worth reading as a checklist; we have already tripped
"decontextualising" once, when the objection lived only on Privacy.

### 2.2 Show the payload, don't describe it

The single highest-leverage change available. A **"view as"** preview: see the exact record a
recruiter or sponsor would receive, rendered as they would see it, before granting anything.

Nothing explains a disclosure like seeing it. This retires most of the ~200 words of purpose prose,
and it is the honest version of "we cannot recall what was already shared", because the member has
seen precisely what leaves.

### 2.3 Disclosure at the field, not at the page

WP29 endorses [just-in-time notices][wp29], and the first layer should carry purpose, controller,
rights and *anything that would surprise*. Our first layer is currently a page-level essay.

In its perfect form each question carries its own three-word status where the decision is made:

> `Tech stack` — *counted in totals · not on your profile*

Three words at the point of answering beat sixty at the top of the page. The long form stays one
click away. **Caution from the same research:** excessive layering reduces transparency. Two layers,
never three.

### 2.4 Consent receipts the member keeps

[ISO/IEC TS 27560:2023][iso] standardises a machine-readable consent record and receipt, building on
the Kantara consent receipt. Every grant, withdrawal and objection should emit one the member can
download.

This fits what we already store (`user_purpose_consents` plus the scope snapshot) and it is a
natural fit for a federated network: a receipt is evidence the member holds rather than a log the
operator holds. It also gives the "carry your persona to another instance" story a spine.

### 2.5 Tell the truth about small numbers

Our aggregates use a fixed bucket floor and rounding. On a 400-member instance that is reasonable.
On a 40-member instance it is decorative, and we currently imply otherwise.

The perfect form:

- **Scales the floor to the population**, rather than shipping one constant.
- **Says the quiet part** to members and operators: on a small instance no aggregate is truly
  anonymous to somebody who knows everyone. That sentence costs us nothing and buys all our
  credibility.
- Prefers **shapes over counts** at small N ("most", "about a third") — this is honest *and*
  shorter.
- Treats differential privacy as a **candidate, not an upgrade**: the literature is blunt that DP
  [loses unacceptable utility at small budgets][kdp], which is exactly our regime. Combining a
  k-floor with noise is the researched middle path, not a free win.

### 2.6 Give the mirror back

The operator gets `/admin/persona-metrics`. The member gets nothing.

In its perfect form **the member sees the community's shape too** — the same aggregate, same floors.
"You are one of 34 people here who work with embedded systems." That converts the feature from
extraction into a mirror, and it is the strongest legitimacy move available to a community instance.
It also makes the legitimate-interest basis *feel* true rather than merely be true, because the
member is a beneficiary of the processing and not only its subject.

### 2.7 A collective layer for what gets published

The genuinely novel move, and the most speculative. Aggregate statements about a community are
communal, so:

- The operator **proposes** what may be published externally about the community.
- Members **see the proposal** and can object.
- Publication proceeds with visible dissent, or a quorum, per the operator's configuration.

This is [collective consent, adapted][clicks] — an active research direction, not settled practice.
It suits a makerspace far better than it suits a social network, because the community is real,
bounded, and already governs itself. **Risk: this is governance, and governance features fail when
they are ceremony.** It should be tried on exactly one instance before it is a product.

---

## 3. What the perfect form stops doing

**The completeness meter should probably go.** It measures how much of yourself you have disclosed
and draws a bar toward "more". We have carefully stripped it of score, streak, leaderboard and
percentage, and it is still a progress bar pointed at disclosure. The EDPB's **continuous prompting**
and **emotional steering** live in this neighbourhood. The honest replacement is a plain statement of
what you have chosen to share, with no bar and no target.

**The makerspace rule should be uniform.** An instance running persona for "which tools are you
checked out on" must never see the word recruiter. We enforce that on the questions page and not on
the privacy page. Pick one and mean it.

**Copy should have a budget enforced in code.** We have now fought wordiness twice by hand. The
perfect form lints it: a first-layer disclosure block over N words fails a test, the same way the
style lint now catches un-reset margins.

---

## 4. Where today's build already agrees

Worth stating, because most of it is right:

- Questions private by default, `showOnProfile` failing closed, no built-in field public.
- Statistics on legitimate interest with an Art. 21 objection rather than consent theatre.
- The member's real choice framed as third-party exposure rather than being counted.
- Purposes unofferable until a recipient is named and papered.
- A scope digest that lapses a grant when what it covers changes.
- Copy owned by the registry and rendered verbatim, so surfaces cannot drift.
- The objection now exercisable where the questions are asked.

---

## 5. If only three things happened

1. **"View as" preview** (§2.2). Biggest comprehension win per unit of work, and it deletes prose.
2. **Give the mirror back** (§2.6). Changes what the feature *is* for the member.
3. **Truth about small numbers** (§2.5). Cheapest, and it is the one where we are currently closest
   to overclaiming.

---

## Sources

- [EDPB Guidelines 03/2022 on deceptive design patterns in social media platform interfaces][edpb]
- [Nissenbaum, Privacy as Contextual Integrity][ci]
- [WP29 / Article 29 Working Party transparency guidance, layered and just-in-time notices][wp29]
- [ISO/IEC TS 27560:2023, consent record information structure][iso]
- [k-anonymity and differential privacy families: actual privacy and utility][kdp]
- [Group privacy, community data and collective harm][group]
- [From Clicks to Consensus: collective consent assemblies for data governance][clicks]

[edpb]: https://www.edpb.europa.eu/system/files/2023-02/edpb_03-2022_guidelines_on_deceptive_design_patterns_in_social_media_platform_interfaces_v2_en_0.pdf
[ci]: https://www.researchgate.net/publication/228198982_Privacy_As_Contextual_Integrity
[wp29]: https://iapp.org/news/a/transparency-and-the-gdpr-practical-guidance-and-interpretive-assistance-from-the-article-29-working-party
[iso]: https://www.iso.org/standard/80392.html
[kdp]: https://arxiv.org/abs/2510.11299
[group]: https://www.dpo-india.com/Blogs/privacy-beyond-individual/
[clicks]: https://arxiv.org/html/2601.16752v2
