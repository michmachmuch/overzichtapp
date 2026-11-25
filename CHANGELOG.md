# Changelog

## Unreleased

### Telefoon
- Phone layout: navigation as a tab bar at the bottom, full-width buttons and form fields, no zooming in on fields on iPhone
- Tijd on a phone: pick a day (Ma–Vr) and see that day's calendar; the week's entries as a list instead of a table
- Can be added to the home screen as an app
- README: Dutch step-by-step guide for opening the app on your phone via Tailscale (private, not on the internet)

### Tijd
- Taller hour rows (72px per hour) so more of each note fits
- The time of a block is always visible; a long note is cut off with … instead of pushing the time out of view
- Entries without a start time are now read too: shown in a "zonder tijd" row above the calendar and in the list
- Entries without a start time count towards the sprint total when their whole day is inside the sprint (not on a day where a sprint starts or ends at a set time)

## v1.0.0 (2026-11-25)

First release of Overzicht, a personal overview app for a school scrum project.

### Wat nu?
- Countdowns to your deadlines (24-hour time, dd/mm/jjjj)
- Sprint hours: progress towards your hours per sprint (default 64), with an even-pace marker, hours left and hours per remaining workday
- Time logged today, your last activity and how long ago it ended
- Check-ins (WhatsApp, issue board, merge requests and your own) with what's new in GitLab since you last checked
- Your assigned GitLab issues and your own to-do's

### Tijd
- Week calendar of *tijdregistratie* entries from `.time-tracking/YYYY/MM` on `develop`; click an entry to open its commit
- "Uren van" picker for team members who logged time, defaulting to you, plus "Iedereen"
- Totals per sprint (using the sprint's start and end time)
- "Zoek uit waarom" diagnosis when no hours show up

### Instellingen
- Check-ins, deadlines and sprints (with optional start and end time), hours per sprint
- GitLab connection status

### Technical
- Runs with `docker compose up` on `localhost:8080`; your data is kept in a Docker volume
- GitLab is read-only: the client only sends GET requests (covered by a test)
