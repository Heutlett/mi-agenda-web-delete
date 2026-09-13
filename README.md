# mi-agenda-web

Frontend for mi-agenda: a multi-tenant appointment scheduling platform. Two experiences, one app: a public, no-auth booking site (`/:slug`) and an authenticated admin dashboard. The backend contract this app consumes is documented in `mi-agenda-api`'s [`docs/api/endpoints-reference.md`](../mi-agenda-api/docs/api/endpoints-reference.md).

Every route is locale-prefixed (`/es/...`, `/en/...`). Spanish is the default locale, with English fully supported; a language switcher is available on the public booking site, the home page, and the admin dashboard.

## Technologies

- [Next.js](https://nextjs.org) (App Router) with TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com) for accessible component primitives, see [docs/design/dependencies-and-licenses.md](docs/design/dependencies-and-licenses.md) for why
- [next-intl](https://next-intl.dev) for locale routing and translation
- [ESLint](https://eslint.org) and [Prettier](https://prettier.io) for linting and formatting

## Setup

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env.local
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` to a running `mi-agenda-api` instance (see that repo's README for how to run it locally).

## Running the app

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). `mi-agenda-api` defaults to port 3000, so this app runs on 3001 to avoid colliding with it when both run locally at once.

## Linting and formatting

```bash
npm run lint          # ESLint
npm run format        # Prettier, writes changes
npm run format:check  # Prettier, check only
```

## Building

```bash
npm run build
npm run start
```

## Documentation

- [docs/design/dependencies-and-licenses.md](docs/design/dependencies-and-licenses.md) — third-party packages and why
