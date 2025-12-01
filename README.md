# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/f7188ce4-3eb4-4a51-a1b5-78280e06a7c0

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/f7188ce4-3eb4-4a51-a1b5-78280e06a7c0) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Local development (frontend + backend)

**Prereqs:** Node 18+ and npm.

1) Install dependencies  
```sh
npm install
cd backend && npm install
```

2) Configure backend environment  
Create `backend/.env` (a template is already present) with at least:  
```
DATABASE_URL="file:./prisma/dev.db"
PORT=4000
GOOGLE_MAPS_API_KEY=    # optional, required for travel estimates
DEFAULT_FUEL_PRICE_PER_LITRE=1.75
```
The SQLite database lives at `backend/prisma/dev.db`; migrations are already applied.

3) Run the backend API  
```sh
cd backend
npm run dev
# server: http://localhost:4000
```

4) Run the frontend  
```sh
npm run dev
# frontend: http://localhost:5173 (Vite)
```
If your backend is not on `http://localhost:4000`, set `VITE_BACKEND_URL` (or `VITE_API_BASE_URL`) in a root `.env` file. When deployed to Cloudflare Pages, the frontend defaults to calling the same origin, so these can stay unset.

## Optional environment

- `VITE_GOOGLE_CALENDAR_EMBED_URL` — override the default calendar embed on the Google Calendar page.
- `GOOGLE_MAPS_API_KEY` (backend) — required for `/api/travel-estimate`; other routes work without it.

## Deploy on Cloudflare Pages + D1 (free)

This repo now ships with a Cloudflare Pages Function (`functions/api/[[route]].ts`) that replaces the Express server and uses D1 for persistence.

1) Create a Cloudflare Pages project pointing at this repo. Build command: `npm run build`. Output dir: `dist`.
2) Add a D1 database and bind it to Functions as `DB` (Pages → Settings → Functions → D1 bindings).
3) Apply the schema: use the dashboard query console or `wrangler d1 execute <db> --file d1/schema.sql`.
4) Functions secrets (Pages → Settings → Environment Variables):
   - `AUTH_SECRET` (required)
   - `COOKIE_SECURE=true`
   - `GOOGLE_MAPS_API_KEY` (required for travel estimates)
   - `DEFAULT_FUEL_PRICE_PER_LITRE` (optional; default 1.75)
5) Frontend env (Pages → Build settings → Environment variables):
   - `VITE_GOOGLE_CALENDAR_EMBED_URL` (optional)
   - `VITE_API_BASE_URL` / `VITE_BACKEND_URL` can be left unset; the frontend falls back to the deployed origin.

Local dev against the Pages Function:
```
cp wrangler.example.toml wrangler.toml   # fill in your D1 database id/name
npm install
npx wrangler d1 execute <db-name> --file d1/schema.sql
npx wrangler pages dev --compatibility-date=2024-12-11
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/f7188ce4-3eb4-4a51-a1b5-78280e06a7c0) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
