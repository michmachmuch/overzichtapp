# Overzicht

A small web app that helps you keep an overview while building a project with scrum:
a product backlog, sprints, a sprint board and an overview with progress, burndown and velocity.

## Features

- **Projects**: keep several projects apart and switch between them.
- **Backlog**: user stories with MoSCoW priority, story points, assignee. Reorder, filter, search, and drag stories into a sprint.
- **Sprints**: plan sprints with a goal and dates, start one at a time, complete it (unfinished stories return to the backlog).
- **Board**: To do / In progress / Done for the active sprint, with drag and drop.
- **Overview**: sprint progress, days left, burndown chart, velocity per sprint, workload per person.
- **Team**: optional people to assign stories to.
- **Backup**: download and restore all data as a JSON file.

Data is stored in your browser (`localStorage`). Nothing is sent to a server.

## Getting started

```bash
npm install
npm run dev      # start at http://localhost:5173
npm test         # run the unit tests
npm run build    # production build in dist/
```

Tech: React 19, TypeScript, Vite. No other runtime dependencies.

## Project structure

```
src/
  state/        data model, reducer (all logic), storage, example data
  components/   shared UI: modal, story card/form, charts, avatar
  views/        Overview, Board, Backlog, Sprints, Team, Settings
```
