# SocialRecipe Admin Web

React 19 + TypeScript administration console built with Vite, Tailwind CSS, shadcn-style Radix primitives, Zustand, TanStack Query, React Hook Form, and Zod.

```bash
npm install
npm run dev
```

The Vite development server proxies `/api` and `/health` to `http://localhost:4000`. Docker Compose builds the production bundle and serves it through Nginx at [http://localhost:3000](http://localhost:3000).

An account needs `admin:read` to enter the portal. Page and action guards additionally check `moderation:review`, `policy:manage`, and `user:ban` permissions.

## Deploy on Vercel

Import the repository in Vercel and select **Root Directory: `frontend`**, **Framework: Vite**, **Build Command: `npm run build`**, and **Output Directory: `dist`**. Keep the install command as `npm ci`.

Add this public build-time environment variable for Production (and Preview if needed), using your actual backend domain:

```dotenv
VITE_API_URL=https://api.example.com/api/v1
```

This value contains only the public API address. Provider keys, SMTP credentials, JWT secrets, and database credentials belong to the AWS backend environment.

The checked-in `vercel.json` routes SPA deep links such as `/notifications` and `/dashboard` to the React application. API calls go directly to the configured HTTPS backend. Vercel builds fail with a clear message when the API URL is missing or malformed. See [Vercel's Vite deployment guide](https://vercel.com/docs/frameworks/frontend/vite).

Set the exact frontend origin, for example `https://YOUR_PROJECT.vercel.app`, in the AWS backend's `CORS_ORIGINS`. Recreate the backend API after changing allowed origins. Add each preview/custom domain explicitly if it should access the API. Changes to `VITE_API_URL` take effect on the next Vercel deployment.

After deployment, check login, refresh `/notifications` directly, and confirm the Overview loads API data. The AWS setup is described in [backend/README.md](../backend/README.md#aws-deployment-with-https).

Local Vite and Docker builds keep using `/api/v1` through their existing proxy when `VITE_API_URL` is unset.
