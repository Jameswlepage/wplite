# Elsewhere — wplite site

A multi-room music venue, nightclub, and arts space in Brooklyn. Built as a
flat wplite site: sources in `app/`, `content/`, `theme/`, `blocks/`.

## Content models

- **event** — shows on the calendar. Fields: `date`, `show_time`, `room`,
  `show_type` (live · club · arts), `lineup[]`, `price`, `ticket_url`,
  `featured` (= Just Announced), `sold_out`.
- **artist** — performers. Fields: `origin`, `genre`, `discipline`, links.
- **room** — the four rooms (Zone One, The Hall, The Loft, Rooftop).
- **release** — mixes, singles, EPs, live recordings.
- **post** — news / longform notes.
- **inquiry** — internal; stores mailing-list signups + contact submissions.

## Singletons

- **contact** — venue address and department emails.
- **memberships** — tiers with perks and pricing.
- **private-events** — packages and booking contact.
- **sponsorships** — tiers + current partners.
- **social** — social URLs, newsletter link.

## Custom block

- **elsewhere/mailing-list** (`blocks/mailing-list/`) — a real signup form
  that POSTs to `/wp-json/portfolio/v1/inquiry` with `source=mailing_list`.
  Entries land in the **Inquiries** list in the admin.

## Images

All media lives in `content/media/*.svg` (graphic poster-style SVGs in the
Elsewhere punk/zine palette). The compiler copies them verbatim into
`theme/assets/media/`.
