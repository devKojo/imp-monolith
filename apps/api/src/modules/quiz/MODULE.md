# quiz

Taking a quiz: a participant starts one attempt at a launched quiz campaign, saves answers, and is scored by
the server. The questions (with their correct answers) and the settings (time limit, pass mark) are written on
the campaign by the business, as fields and settings of the `campaigns` module; this module only reads them.

## Responsibilities

- A participant's attempt: start (or resume), save answers as they go, submit, scored by the server.
- The public rules of a running quiz (no questions).

Not here: the campaign, its questions and settings (`campaigns`), accounts and sessions (`identity`), prizes and draws.

## Data (tenant tables, RLS forced)

`quiz_attempts` (one per participant per campaign, unique key) and `quiz_answers` (one per question per
attempt; a question is a `campaign_fields` row of kind `QUIZ_QUESTION`). Composite FKs keep every row inside one
business. Attempts and answers are never deleted by the runtime role.

## Who can do what

- Business: writes the questions and settings on the campaign (see `campaigns`); nothing in this module.
- Participant: only a participant account (`PARTICIPANT_ONLY`). Business accounts cannot take quizzes.
- Visitors: the public rules only.

## API

| Route                                         | Who                | Notes                                            |
| --------------------------------------------- | ------------------ | ------------------------------------------------ |
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
- **Launch needs a question.** The quiz template's launch rules (in `campaigns`) ask for at least one complete
  question, with its correct answer marked.
- **How a participant reaches a business's rows:** the campaign is found by its public address through the
  read-only public scope, and the business scope is then set from that campaign (never from the request).
  Only that participant's own attempt is read or written.

## Not built yet

- Rate limiting on starting attempts and saving answers.
- Retakes, per-question timers, shuffled order, explanations, results shown to the business.
- Participant verification beyond the signed-in account (one-time codes), and prizes or draws from a quiz.
- Events (identifiers only, R-EVT-12) once the outbox publisher exists.
