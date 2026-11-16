# survey

Taking a survey: a participant starts one response to a launched survey campaign, saves answers as they go,
and submits. The questions are written on the campaign by the business, as content fields of the `campaigns`
module (multiple choice, rating, short text, long text); this module only reads them.

## Responsibilities

- A participant's response: start (or resume), save, change or clear answers, submit.
- The public facts of a running survey (no questions): number of questions, how many are required, a time
  estimate.

Not here: the campaign and its questions (`campaigns`), accounts and sessions (`identity`), prizes and draws,
and anything the business reads back (results, exports).

## Data (tenant tables, RLS forced)

`survey_responses` (one per participant per campaign, unique key) and `survey_answers` (one per question per
response; a question is a `campaign_fields` row). Composite FKs keep every row inside one business. Responses
are never deleted by the runtime role; an answer row is deleted when the participant clears an optional text
answer. An answer holds either `choice_index` or `text` (a database check enforces exactly one).

## Who can do what

- Business: writes the questions on the campaign (see `campaigns`); nothing in this module.
- Participant: only a participant account (`PARTICIPANT_ONLY`). Business accounts cannot take surveys.
- Visitors: the public facts only.

## API

| Route                                            | Who                | Notes                                                         |
| ------------------------------------------------ | ------------------ | ------------------------------------------------------------- |
| `GET /api/v1/public/survey/:slug`                | public, cacheable  | title, business, counts, time estimate; never a question      |
| `POST /api/v1/survey/:slug/response`             | participant + csrf | start, or return the existing response                        |
| `GET /api/v1/survey/:slug/response`              | participant        | state, questions, saved answers                               |
| `PUT /api/v1/survey/:slug/response/answers/:qid` | participant + csrf | `{ choiceIndex }` or `{ text }`; empty text clears the answer |
| `POST /api/v1/survey/:slug/response/submit`      | participant + csrf | needs every required question answered; repeating is harmless |

## Rules worth knowing

- **A rating is five points**, sent as `choiceIndex` 0 to 4 and shown as 1 to 5. A choice question's
  `choiceIndex` must be one of its options. Written text is trimmed and limited (500 characters for short text,
  4000 for long text). An answer that does not fit its question is `INVALID_ANSWER`.
- **Required questions** are checked when submitting (`ANSWERS_REQUIRED`), not while answering, so a participant
  can move around freely.
- **Submitted is final.** Answers after that are `RESPONSE_CLOSED`; submitting again returns the same response.
- **How a participant reaches a business's rows:** the campaign is found by its public address through the
  read-only public scope, and the business scope is then set from that campaign (never from the request). Only
  that participant's own response is read or written.
- The campaign closing is the only deadline: after its end the survey is not found.

## Not built yet

- Showing results to the business, exports, or per-question statistics.
- Rate limiting on starting responses and saving answers.
- Participant verification beyond the signed-in account, and prizes or draws from a survey.
- Events (identifiers only, R-EVT-12) once the outbox publisher exists.
