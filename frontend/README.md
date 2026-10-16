# SocialRecipe Admin Web

React 19 + TypeScript administration console built with Vite, Tailwind CSS, shadcn-style Radix primitives, Zustand, TanStack Query, React Hook Form, and Zod.

```bash
npm install
npm run dev
```

The Vite development server proxies `/api` and `/health` to `http://localhost:4000`. Docker Compose builds the production bundle and serves it through Nginx at [http://localhost:3000](http://localhost:3000).

An account needs `admin:read` to enter the portal. Page and action guards additionally check `moderation:review`, `policy:manage`, and `user:ban` permissions.
