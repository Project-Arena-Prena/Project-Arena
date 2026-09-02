# Agent execution blueprint

This blueprint turns launch work into bounded, verifiable tasks. Agents may
work independently only when their files and external systems do not overlap.

## Execution order

| Order | Workstream | Scope | Required evidence |
| --- | --- | --- | --- |
| 1 | Release lead | Freeze target, record current Arena state, coordinate branches | Release checklist and exact SHAs |
| 2 | Database | Baseline production, apply Founding migrations after the live Arena, run advisors | Schema diff, migration history, advisor report |
| 3 | Payments | Sandbox webhook, paid test, replay, failure, refund, then low-value live test | Stripe event IDs and matching internal payment/Entry IDs |
| 4 | Auth | Canonical-domain magic-link flow and admin access | Fresh same-browser login recording and runtime error scan |
| 5 | Email | Transactional provider, DNS alignment, lifecycle templates, Hostinger reply path | Provider delivery records and received messages |
| 6 | Product QA | Builder, Supporter, scoring, finalization, analytics, sharing | End-to-end rehearsal report |
| 7 | Release lead | Promote the verified preview, observe, decide go/no-go | Production URL, deployment SHA, post-deploy scan |

Database must finish before payment proof because webhook fulfillment depends
on RPCs and ledger constraints. Payment, auth, and email can then be verified in
parallel on a non-production Arena. Production promotion is last.

## Task packet template

Every agent task must state:

```md
Goal:
Target environment and identifiers:
Files/tables/routes allowed:
Explicitly forbidden operations:
Acceptance checks:
Evidence to return:
Rollback or recovery path:
```

Never assign “make launch ready” as a task. Assign one state transition with an
observable pass condition.

## Change ownership

| Surface | Owner for the task | Collision rule |
| --- | --- | --- |
| `supabase/migrations/**` | Database agent | One migration author at a time |
| Checkout and webhook routes | Payments agent | No concurrent payment-route edits |
| Auth callback, proxy, login | Auth agent | Preserve canonical-origin behavior |
| Notifications and templates | Email agent | Never send production mail during code QA |
| Arena lifecycle/scoring | Lifecycle agent | Requires database agent review |
| UI and visual motion | Product UI agent | Cannot change scoring or payment semantics |
| Vercel promotion | Release lead | Only after every P0 gate passes |

## Pull request contract

Each PR must be narrow and include:

- problem and user impact;
- files and external systems changed;
- test commands and results;
- preview URL when UI or routes change;
- migration order and recovery plan when schema changes;
- screenshots or request/response evidence with secrets and personal data
  removed;
- manual production steps that remain;
- explicit confirmation that payment never affects rank.

Do not merge on green build alone. The relevant state transition must be proven
against a safe environment.

## Incident stops

Stop launch work and notify the release lead if any of these occur:

- unexpected production rows change during a rehearsal;
- webhook signatures fail or duplicate fulfillment appears;
- an Entry becomes competing without an authoritative paid/free confirmation;
- score or rank changes outside the documented scoring path;
- a secret appears in source, logs, screenshots, or CI output;
- a migration cannot be reconciled with the production baseline;
- a transactional email exposes another Builder's data;
- the active Arena finalizes without a deterministic Champion and frozen result.

