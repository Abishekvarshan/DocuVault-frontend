# DocuVault Frontend

React and Vite frontend for DocuVault.

## Run locally

```bash
npm install
npm run dev
```

The Vite development server runs at http://localhost:5173 and proxies `/api`
requests to the DocuVault backend at http://localhost:4000.

## Deploy to Vercel

Set the Vercel project root directory to `frontend` and use the default Vite
build command (`npm run build`) and output directory (`dist`). Add the
`VITE_API_URL` environment variable for each deployment environment, pointing
to the public HTTPS origin of the backend (for example,
`https://api.example.com`, without a trailing slash). The backend must allow
the Vercel site origin through its `FRONTEND_URL` environment variable.

## Build

```bash
npm run build
npm run preview
```
