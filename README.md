# Lesson Tree Planner

A neon-themed lesson-plan builder for Hithadhoo School. Teachers sign in, pick a grade,
subject, week and term, then walk down a decision tree to assemble a complete 35-minute
lesson plan. The finished plan is written to Google Sheets / Google Docs through a Google
Apps Script backend.

- **Frontend:** static site (HTML, CSS, vanilla JS) — host it on GitHub Pages.
- **Backend:** Google Apps Script Web App + a Google Sheets database.
- **Installable:** works as a PWA (Add to Home Screen / Install app).
- **Auth:** accounts stored in the database spreadsheet, sessions last 30 days.

---

## 1. What is in this repository

```
index.html                  App shell + sign-in screen
styles.css                  Original planner styling
app.css                     Auth, menus, modals, responsive + scroll fixes
app.js                      Planner logic, login/bootstrap, PWA install
api.js                      Backend client (POST with JSONP fallback)
config.js                   Backend URL and Drive defaults  ← edit this
manifest.webmanifest        PWA manifest
sw.js                       Offline app-shell service worker
icons/                      App icons (192, 512, maskable, favicon)
assets/                     Optional local assets
backend/Config.gs           Database ID, APP_URL, SETUP_CODE, sheet names
backend/Auth.gs             Accounts, hashing, sessions, throttling
backend/Code.gs             Database readers, generation, API routes
backend/appsscript.json     Web App manifest + OAuth scopes
.github/workflows/pages.yml Publishes only the frontend files
version 1/                  Original design reference — not published
```

`backend/` and `version 1/` are **never** published. The Pages workflow copies only the
frontend whitelist into the deployed artifact, so the setup code and database ID stay off
the public site.

---

## 2. Deploy the backend (Google Apps Script)

1. Open the Apps Script project that already owns the database:
   <https://script.google.com/home/projects/17KMXgcht2QyHlKK7CxoNVwKqANralU3XPj8P8QpBT_QT5KWKVYhqzNFA/edit>
2. Replace the project files with the contents of `backend/`:
   - `Config.gs` → project settings
   - `Auth.gs` → new file
   - `Code.gs` → existing code file (overwrite)
   - `appsscript.json` → enable **Project Settings → Show `appsscript.json`**, then paste.
3. Edit `Config.gs` **before deploying**:
   ```js
   const APP_URL   = 'https://YOUR-USERNAME.github.io/YOUR-REPO/';
   const SETUP_CODE = 'something-long-and-private';
   ```
   `SETUP_CODE` creates the first administrator. Change it from the default and keep it
   private; after the first admin exists it is no longer needed.
4. Run the `setup` check once from the editor (any function) and approve the OAuth prompt.
5. **Deploy → New deployment → Web app**
   - Description: `Planner API`
   - Execute as: **Me**
   - Who has access: **Anyone** (the app has its own login)
6. Copy the **Web app URL**. It ends in `/exec`:

   `https://script.google.com/macros/s/AKfycb.../exec`

> Re-deploy after every backend change: **Deploy → Manage deployments → edit (pencil) →
> Version: New version → Deploy**.

### First sign-in

On the first visit the sign-in screen asks for the **setup code** instead of a password.
Enter the `SETUP_CODE` from `Config.gs`, choose the administrator email and password, and
the `Database_Users` and `Database_Sessions` sheets are created automatically.

After that, the administrator can open **Account → Manage users** to add teachers.

Default database spreadsheet:
<https://docs.google.com/spreadsheets/d/1SYYFzcG-wD-XQhrO2ghgrvenRa5gS7Q7DuU-UYocMMM>

The script reads these tabs (they must already exist): `Database_Schemes`,
`Database_CurriculumOutcomes`, `Database_SharedValues`, `Database_KeyCompetencies`,
`Database_TeachingStrategies`, `Activities`, `Database_AssessmentTools`.

---

## 3. Deploy the frontend (GitHub Pages)

### Option A — GitHub Desktop (no command line)

1. Create a new **public** repository, e.g. `lesson-tree-planner`.
2. In GitHub Desktop: **File → Add local repository** → select this folder →
   **Publish repository**.
3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push again (or run the workflow from the **Actions** tab). The site appears at
   `https://YOUR-USERNAME.github.io/lesson-tree-planner/`.

### Option B — command line

```bash
git init
git add .
git commit -m "Lesson Tree Planner"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/lesson-tree-planner.git
git push -u origin main
```

Then set **Settings → Pages → Source: GitHub Actions**.

### Connect the two

Edit `config.js`:

```js
apiUrl: 'https://script.google.com/macros/s/AKfycb.../exec'
```

Commit and push. Visitors can also paste the URL on the sign-in screen under
**Connection**; it is remembered in the browser, so `config.js` is optional.

> Keep `backend/` out of Pages. The included workflow already does this. If you prefer
> **Deploy from a branch**, put the frontend in a `docs/` folder or make the repository
> private — otherwise `Config.gs` (database ID + setup code) becomes downloadable.

---

## 4. Install the app (PWA)

- **Android / Chrome:** open the site → menu **⋮ → Install app** (or the in-app
  **Install** button when it appears).
- **iPhone / Safari:** **Share → Add to Home Screen**.
- **Windows / macOS / Chrome / Edge:** install icon in the address bar, or the in-app
  **Install** button.

The service worker caches the app shell so the interface opens offline. Signing in and
saving plans still need a connection.

---

## 5. Using the planner

1. Sign in (or choose **Preview offline demo** to look around without a backend).
2. Pick **Grade**, **Subject**, **Week**, **Term** and the lesson details.
3. Move through the tree: each node narrows the plan (outcome → value → competency →
   strategy → activity → assessment).
4. Pan the canvas by dragging empty space, or scroll with the wheel / trackpad. On screens
   narrower than 1080 px the tree stacks into a single column.
5. **Generate** writes the plan to the configured Google Doc/Sheet and returns a link.

**Account menu**

| Action | Who |
| --- | --- |
| Change password | Everyone |
| Manage users (add teacher, reset password, enable/disable) | Administrator |
| Connection settings | Everyone (local only) |
| Install app | Everyone (when the browser supports it) |
| Sign out | Everyone |

---

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| “Backend not connected” | Set `apiUrl` in `config.js`, or paste the `/exec` URL under **Connection** on the sign-in screen. |
| Login works in the editor but not on the site | The Web App must be deployed with **Who has access: Anyone**. Re-deploy a **new version**. |
| `Script function not found: doPost` | The old deployment is still live. Manage deployments → edit → **New version**. |
| “Too many attempts” | Login throttling: wait a few minutes. Counters are in `Database_Sessions`. |
| Setup code rejected | `SETUP_CODE` in `Config.gs` differs from the deployed version. |
| Data looks stale in the app | Reload; the service worker serves the newest files after the next visit. Bump `CACHE` in `sw.js` after big changes. |
| Install button never appears | PWA install needs HTTPS (GitHub Pages is fine) and a manifest + service worker. Safari uses **Add to Home Screen**. |
| Tree still cuts off on a laptop | Drag empty canvas to pan; the hint above the tree shows when content continues downward. |

---

## 7. Security notes

- Passwords: salted, 120 rounds of SHA-256 (Apps Script has no native bcrypt).
- Sessions: random 32-byte tokens, stored as SHA-256 hashes, expire after 30 days.
- Login throttling: repeated failures temporarily block the email.
- The database ID and `SETUP_CODE` live only in `backend/`, which is not published.
- Anyone with the `/exec` URL can call the API, but every data endpoint requires a valid
  session token.
- Change `SETUP_CODE` before the first deployment and never commit it to a public repo.
