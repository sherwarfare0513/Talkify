# ConnectArena

Frontend: `https://incandescent-unicorn-bb3930.netlify.app`

Backend: `https://talkify-nine-eosin.vercel.app`

## Local development

1. Run `npm run dev` for frontend only
2. Run `npm run dev:full` only when this workspace also contains the local `server` folder
3. Frontend opens on `http://localhost:5173`
4. Local backend runs on `http://localhost:3001`
5. Local frontend uses the Vite `/api` proxy automatically

## Production deployment

- Netlify build command: `npm run build`
- Netlify publish directory: `dist`
- Netlify environment variable: `VITE_API_BASE_URL=https://talkify-nine-eosin.vercel.app`
- Vercel environment variable: `CORS_ORIGIN=https://incandescent-unicorn-bb3930.netlify.app,http://localhost:5173,http://127.0.0.1:5173`

## Notes

- Production frontend now targets the live Vercel backend by default.
- Backend CORS now supports both the live Netlify site and local development origins.
- Root repository is frontend-only. Backend should be pushed from the separate `server` repository.
