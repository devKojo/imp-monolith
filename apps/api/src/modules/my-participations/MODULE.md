# my-participations

What a signed-in person has taken part in, across businesses: their quiz attempts and survey responses, newest
first, with the campaign's title and public address. Read-only; writes nothing and owns no table.

Not here: taking a quiz or survey (`quiz`, `survey`), what a business sees about its participants
(`participants`), draws and rewards.

## Data access

One `withParticipant` transaction per call. It sets `app.participant_user_id` from the session, which opens the
read-only `participant_read` policies on `quiz_attempts`, `survey_responses` and `campaigns` (migration
`20261119100000_participant_read_own_participations`). They match only the person's own rows.
