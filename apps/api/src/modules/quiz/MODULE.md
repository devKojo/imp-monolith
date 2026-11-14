# quiz

Quiz campaigns: a business writes single-choice questions on a draft campaign, and a participant takes the
quiz once. Scoring and the clock belong to the server.

## Responsibilities

- Questions and settings (time limit, pass mark) of a campaign whose template is a quiz.
- A participant's attempt: start (or resume), save answers as they go, submit, scored by the server.
- The public rules of a running quiz (no questions).

Not here: the campaign itself (`campaigns`), accounts and sessions (`identity`), prizes and draws.

## Data (tenant tables, RLS forced)

`quizzes` (settings, one per campaign), `quiz_questions` (prompt, 2 to 6 options, `correct_index`),
`quiz_attempts` (one per participant per campaign, unique key), `quiz_answers` (one per question per
attempt). Composite FKs keep every row inside one business. Attempts and answers are never deleted by the
runtime role.

## Who can do what

- Business: everyone who can read campaigns reads the questions; roles that manage campaigns write them,
  and only while the campaign is a draft (`CAMPAIGN_LOCKED` otherwise).
- Participant: only a participant account (`PARTICIPANT_ONLY`). Business accounts cannot take quizzes.
- Visitors: the public rules only.

## API

| Route                                         | Who                | Notes                                            |
| --------------------------------------------- | ------------------ | ------------------------------------------------ |
| `GET/PUT /api/v1/quizzes/:campaignId`         | business           | PUT replaces settings and all questions          |
| `GET /api/v1/public/quiz/:slug`               | public, cacheable  | title, business, counts, rules; never a question |
| `POST /api/v1/quiz/:slug/attempt`             | participant + csrf | start, or return the existing attempt            |
| `GET /api/v1/quiz/:slug/attempt`              | participant        | state, questions without answers, saved choices  |
| `PUT /api/v1/quiz/:slug/attempt/answers/:qid` | participant + csrf | `{ choiceIndex }`; can change until finished     |
| `POST /api/v1/quiz/:slug/attempt/submit`      | participant + csrf | scores; repeating returns the same result        |

## Rules worth knowing

- **Correct answers never leave the server** while the quiz runs. Participant responses carry prompt and
  options only; the result is a score, not a key.
- **The clock is the attempt's `expires_at`**, set when it starts: the time limit, never past the
  campaign's end. A read, answer or submit after it closes the attempt and scores what was answered.
  Nothing runs in the background. The response carries `serverTime` so the browser measures the countdown
  from the server's clock.
- **Scoring:** unanswered scores nothing; passing means `score * 100 >= passPercent * total`.
- **Launch needs a question.** The campaigns module asks this module (through a port wired in `main.ts`)
  how many questions a quiz campaign has; none fails the `questions` launch check.
- **How a participant reaches a business's rows:** the campaign is found by its public address through the
  read-only public scope, and the business scope is then set from that campaign (never from the request).
  Only that participant's own attempt is read or written.

## Not built yet

- Rate limiting on starting attempts and saving answers.
- Retakes, per-question timers, shuffled order, explanations, results shown to the business.
- Participant verification beyond the signed-in account (one-time codes), and prizes or draws from a quiz.
- Events (identifiers only, R-EVT-12) once the outbox publisher exists.
