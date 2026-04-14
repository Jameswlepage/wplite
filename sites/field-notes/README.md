# Field Notes

A naturalist's travelogue built on `wplite`. Each entry is a geolocated field note — date, place, weather, photos, and observations — rendered as a browsable journal with an annotated map.

## Structure

- `app/` — site schema, the `note` collection, routes, menus, singletons.
- `content/` — markdown notes and JSON singletons.
- `theme/` — block theme: ruled-page paper, hand-drawn map, journal typography.
- `blocks/` — custom runtime blocks (annotated map, note card).

## What it exercises

- a collection with geo coordinates, date, weather, media
- a custom public block that aggregates collection entries (the map)
- an editorial archive plus a dense single-note view
- theme.json typography pushing handwritten + serif type together

## Commands

```bash
npm run build
npm run apply
npm run dev
npm run pull
```
