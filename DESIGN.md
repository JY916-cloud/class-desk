# Class desk

A Saturday and Sunday timetable for one tutor. The page is a tool: see the four lessons, open one, edit it.

## Direction

Open Design direction `tech-utility` (Datadog / GitHub). Dense grid, hairline borders, one green accent. No marketing hero, no second brand color on primary actions.

## Color

Bound from the direction palette:

- Background `oklch(98% 0.005 250)`
- Surface `oklch(100% 0 0)`
- Text `oklch(22% 0.02 240)`
- Muted `oklch(50% 0.018 240)`
- Border `oklch(90% 0.008 240)`
- Accent `oklch(58% 0.16 145)` — selected lesson, Save, Copy

ABS uses a small red tint. It is a status, not a second brand color.

## Type

System sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Times and counts use tabular numbers. Chinese names use the system CJK face.

## Layout

- Top bar: Timetable, School syllabus, Progress, Names.
- Timetable: label column, Saturday, Sunday. Chem row, then Bio row. Each cell shows time, room, topic, and names.
- Click a cell to edit that lesson. The timetable stays above the editor.
- One accent on the selected cell and the two commit buttons.

## Files

`index.html` loads `styles.css` and `app.js`. Topic codes stay in `topics.js`. Tokens in `styles.css` `:root` match this file.
