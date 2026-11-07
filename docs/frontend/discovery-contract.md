# Public discovery: API contract the UI needs

The architecture specification's endpoint catalogue (section 10.1) lists `GET /public/campaigns/:slug`
but no listing endpoint, and the UI/UX information architecture (section 2.1) has no discovery
route. The discovery page (`/discover`) exists in the designs, so this proposes what both documents
need. **It needs an amendment to both specs and an API implementation; until then the page shows
clearly labelled sample data** (`runtimeConfig.public.discoverySource = 'sample'` in development).

## Endpoint

`GET /api/v1/public/campaigns` on the public-api profile (R-ARC-02).

| Query    | Type                                                 | Notes                                      |
| -------- | ---------------------------------------------------- | ------------------------------------------ |
| `q`      | string, optional, max 100                            | Matches title, summary, business, prize    |
| `type`   | `quiz` \| `poll` \| `survey` \| `vote` \| `giveaway` | Omit for all                               |
| `cursor` | opaque, optional                                     | Keyset pagination (R-DAT-11); max page 100 |

Response `200`:

```json
{
  "items": [
    {
      "id": "0197a000-0000-7000-8000-000000000001",
      "slug": "black-friday-quiz",
      "title": "Black Friday Quiz",
      "summary": "Answer five questions ...",
      "businessName": "Savanna Travel",
      "type": "quiz",
      "endsAt": "2026-11-30T23:59:00.000Z",
      "timeZone": "Africa/Accra",
      "prize": { "label": "Prize", "value": "Weekend getaway" },
      "imageUrl": "https://...",
      "imageAlt": "..."
    }
  ],
  "nextCursor": null
}
```

## Rules

- **Public and cacheable**: `Cache-Control: public, s-maxage=30, stale-while-revalidate=300`
  (R-WEB-05); no cookies, no per-user fields, no participant data.
- **Only PUBLISHED campaigns** of ACTIVE businesses before `endAt` (R-CAM-03); suspended tenants and
  the kill switch remove items within the SLA (R-PRF-04).
- **Competitions** appear only for businesses and markets with the legal gate enabled (R-PRV-09).
- **Moderated media**: `imageUrl` points at a processed variant, never an upload (R-MED-01);
  `imageAlt` is required unless the image is marked decorative (UI-FND-08).
- **Slugs** are the campaign page route `/c/{slug}` (R-TEN-07). Unknown or unavailable slugs behave
  identically elsewhere (R-SEC-08); the list never reveals unlisted campaigns.
- **Tolerant consumer**: the client drops items with unknown `type` values so a newer server cannot
  break an older client.

## UI behaviour that depends on it

- `?q=` and `?type=` live in the page URL, so a filtered view can be shared and reloaded.
- "Time left" is computed from `endsAt` and shown with the absolute end time and zone (UI-CPY-04).
- Empty, filtered-empty, loading and error states come from the section 11 matrix.
