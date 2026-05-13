# CodeSync Frontend

Angular frontend for CodeSync, a code collaboration platform for browsing projects, authenticating users, opening collaborative workspaces, and interacting with the CodeSync backend services.

## Tech Stack

- Angular 21
- TypeScript 5.9
- RxJS
- Vitest for unit tests
- npm 11.9.0

## Prerequisites

- Node.js with npm available on your path
- CodeSync backend services running locally when using API-backed screens
- Optional: SonarQube running at `http://localhost:9000` for local analysis

## Getting Started

Install dependencies:

```bash
npm install
```

Start the Angular development server:

```bash
npm start
```

The app runs at `http://localhost:4200/`. The dev server uses `proxy.conf.json`, so frontend API calls are forwarded to local backend services.

## Available Scripts

```bash
npm start
```

Runs the app locally with live reload.

```bash
npm run build
```

Creates a production build in `dist/`.

```bash
npm run watch
```

Builds in development mode and watches for changes.

```bash
npm test
```

Runs unit tests with Vitest.

```bash
npm run test:coverage
```

Runs tests once and writes coverage output.

```bash
npm run sonar
```

Runs the local Sonar scan. This script runs coverage first through `presonar`.

## Local API Proxy

The Angular dev server proxies these routes:

| Frontend route | Local service |
| --- | --- |
| `/api/v1/auth` | `http://localhost:8081` |
| `/api/v1/payments` | `http://localhost:8081` |
| `/api/v1/projects` | `http://localhost:8082/projects` |
| `/api/v1/files` | `http://localhost:8083/files` |
| `/api/v1/collab` | `http://localhost:8084/sessions` |
| `/ws/collab` | `ws://localhost:8084` |
| `/api/v1/executions` | `http://localhost:8085/executions` |
| `/api/v1/versions` | `http://localhost:8086/versions` |
| `/api/v1/comments` | `http://localhost:8087/comments` |
| `/api/v1/notifications` | `http://localhost:8088/notifications` |
| `/api` | `http://localhost:8080` |

## App Areas

- Home and guest browsing: public project discovery and supported runtime display
- Auth: login, admin login, registration, forgot password, and OAuth success handling
- Dashboard: authenticated user project area
- Workspace: project file tree, code reading, collaboration, execution, versions, comments, and notifications

## Project Structure

```text
src/
  app/
    core/
      guards/
      interceptors/
      models/
      services/
    features/
      auth/
      dashboard/
      home/
      workspace/
  environments/
```

## Code Quality

Coverage output is written under `coverage/` and is ignored by Git. Sonar configuration lives in `sonar-project.properties`.
