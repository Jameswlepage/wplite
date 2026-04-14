# Singletons

Singleton schemas live in `app/singletons/*.json`.

They are option-backed settings surfaces for site-level data such as profile, contact, SEO, brand metadata, or global calls to action.

Seed data lives in `content/singletons/*.json`.

## Schema Example

```json
{
  "id": "contact",
  "label": "Contact",
  "icon": "Email",
  "type": "singleton",
  "storage": "option",
  "fields": {
    "email": {
      "type": "email",
      "label": "Primary Email",
      "inheritsFrom": "site.admin_email"
    },
    "phone": {
      "type": "text",
      "label": "Primary Phone"
    },
    "booking_url": {
      "type": "url",
      "label": "Booking URL"
    }
  }
}
```

## Seed Example

```json
{
  "singleton": "contact",
  "data": {
    "email": "hello@example.com",
    "phone": "+1 212 555 0100",
    "booking_url": "https://cal.example.com/studio"
  }
}
```

## Core Keys

- `id`
  Stable singleton id.
- `label`
  Label used in `/app`.
- `icon`
  WordPress-style icon token.
- `type`
  Use `"singleton"`.
- `storage`
  Current repo examples use `"option"`.
- `fields`
  Structured field map. Uses the same field system as collections.

## Supported `inheritsFrom` Values

Singleton fields can inherit from canonical WordPress site data when left empty.

Current supported sources are:

- `site.title`
- `site.description`
- `site.url`
- `site.language`
- `site.icon`
- `site.icon_url`
- `site.admin_email`
- `site.locale`
- `site.timezone`

## Guidance

- Use singletons for settings-like data that should exist once per site.
- Put contact info, SEO defaults, organization metadata, and reusable CTA content here.
- Do not model logged-in WordPress user preferences here. User profile fields like admin color, locale, password, editor toggles, and admin-bar visibility belong to the WordPress user record.
- Do not model native WordPress site settings here. Homepage behavior, posts-per-page, timezone, and discussion defaults like comment enablement belong to Site Settings.
- Do not use singletons as an excuse to hardcode the same data again in theme templates.
- If the theme needs singleton data and the compiler does not yet expose it cleanly through native WordPress mechanisms, document that as compiler debt rather than adding site-local duplication.
