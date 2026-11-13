# Lesson Tree Planner

A neon-themed lesson-plan builder for Hithadhoo School. Teachers sign in, pick a
subject, week, grade and term, then walk down a decision tree to assemble a complete
35-minute lesson plan. The finished plan is written to Google Sheets / Google Docs
through a Google Apps Script backend.

- **Frontend:** static site (HTML, CSS, vanilla JS) — host it on GitHub Pages.
- **Backend:** Google Apps Script Web App + a Google Sheets database.
- **Installable:** works as a PWA (Add to Home Screen / Install app).
- **Sign in:** email + password only. Accounts are rows in the database spreadsheet.

---

## 1. What is in this repository

```
index.html                  App shell + sign-in screen
styles.css                  Original planner styling
app.css                     Auth, menus, responsive + scroll fixes
app.js                      Planner logic, login/bootstrap, PWA install
api.js                      Backend client (POST with JSONP fallback)
config.js                   Backend URL and Drive defaults
manifest.webmanifest        PWA manifest
sw.js                       Offline app-shell cache
icons/                      App icons
backend/Config.gs           Database ID, sheet names
backend/Auth.gs             Login + sessions
backend/Code.gs             API routing, database readers, plan generation
backend/appsscript.json     Apps Script manifest
.github/workflows/pages.yml GitHub Pages deployment
version 1/, version 2/      Original references (never published)
```

`backend/`, `version 1/` and `version 2/` are **never** published. The Pages workflow
copies only the frontend files into the deployed artifact.

---

## 2. The login tab

Sign-in reads one tab in the database spreadsheet:

**`Database_Logins`**

| Email | Password | Name | Role | Active |
| --- | --- | --- | --- | --- |
| teacher@school.edu.mv | their-password | Mariyam Ali | teacher | TRUE |
| admin@school.edu.mv | another-password | School Admin | admin | TRUE |

- Only **Email** and **Password** are required.
- **Name** is shown in the app. If blank, the email address is used.
- **Role** is stored with the session. `admin` may redesign the master template;
  anything else is a teacher.
- **Active** accepts TRUE/FALSE, YES/NO or 1/0. Blank means active. Set it to FALSE
  to block someone without deleting their row.
- Header names are matched loosely (for example “E-mail” and “Full Name” also work),
  and column order does not matter.
- If the tab does not exist, the backend creates it with those five headers the first
  time the app connects. Existing tabs named `Logins`, `Login`, `Login Info` or
  `LoginInfo` are recognized too.

There is **no sign-up, password reset or user management inside the app**. Edit the
sheet to add or remove people.

The backend also creates a hidden `Database_Sessions` tab for sign-in tokens. Leave it
alone.

---

## 3. Deploy the backend (Google Apps Script)

1. Open the Apps Script project:
   <https://script.google.com/home/projects/17KMXgcht2QyHlKK7CxoNVwKqANralU3XPj8P8QpBT_QT5KWKVYhqzNFA/edit>
2. Add or replace the project files with the contents of `backend/`:
   - `Config.gs` → new file (or replace the existing configuration file)
   - `Auth.gs` → new file
   - `Code.gs` → existing code file (overwrite)
   - `appsscript.json` → enable **Project Settings → Show `appsscript.json`**, then paste.
     It must be the manifest file, not a `.gs` script file.
3. Add the login tab to the database spreadsheet (`Database_Logins`) as described above,
   with at least one account.
4. **Deploy → New deployment → Web app**
   - Description: anything, for example `planner`
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the **Web app URL**. It ends in `/exec`:

   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

6. `config.js` already points at this deployment:

   ```js
   apiUrl: 'https://script.google.com/macros/s/AKfycbw0Nt3iwe5FvnvLBrKp2z6ipM9jGQjQVUORLgpBGfcU9zxfcsI4_bIFBoV95F89_hcfMQ/exec'
   ```

   If you redeploy to a different URL, replace that line. The URL must end in `/exec`.

7. When you change backend code, use **Deploy → Manage deployments → Edit → New version**
   so the `/exec` URL keeps working.

8. Optional: open **Project Settings → Script properties** and add `APP_URL` with the
   GitHub Pages address. Then opening the `/exec` URL directly redirects to the planner.

The database spreadsheet is:

```
https://docs.google.com/spreadsheets/d/1SYYFzcG-wD-XQhrO2ghgrvenRa5gS7Q7DuU-UYocMMM/edit
```

---

## 4. Publish the frontend (GitHub Pages)

This folder is already a git repository with a `main` branch.

### Option A — GitHub Desktop

1. **File → Add local repository** → select this folder.
2. Click **Publish repository**.
3. On GitHub open **Settings → Pages → Source: GitHub Actions**.

The included workflow publishes the frontend on every push to `main`.

### Option B — command line

```bash
git remote add origin https://github.com/YOUR-USERNAME/lesson-tree-planner.git
git push -u origin main
```

Then set **Settings → Pages → Source: GitHub Actions**.

The site appears at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

> Keep `backend/` out of Pages. The included workflow already does this. If you use
> **Deploy from a branch** instead, make the repository private, otherwise `Config.gs`
> (with the database ID) becomes downloadable.

---

## 5. Install the app (PWA)

- **Android / Chrome:** open the site → menu **⋮ → Install app** (or the in-app
  **Install** button when it appears).
- **iPhone / Safari:** **Share → Add to Home Screen**.
- **Windows / macOS / Chrome / Edge:** install icon in the address bar, or the in-app
  **Install** button.

The service worker caches the app shell so the interface opens offline. Signing in and
saving plans still need a connection.

---

## 6. Using the planner

1. Sign in with an email and password from `Database_Logins` (or choose
   **Preview offline demo** to look around without a backend).
2. Pick a subject, week, grade and term in the settings panel.
3. Answer each step of the tree. Your selections become the lesson plan.
4. Review the finished plan and save it to Google Drive / Google Sheets.

`Keep me signed in` stores the session on that device for 30 days. **Sign out** in the
account menu ends it immediately.

---

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| “The backend URL in config.js must be the Web App URL that ends in /exec.” | Use the deployment URL from **Deploy → Manage deployments**. |
| “Could not reach the backend.” | The deployment access must be **Anyone**. Check the `/exec` URL in a browser. |
| “Incorrect email or password.” | Check the `Database_Logins` row. Emails are case-insensitive; passwords are exact. |
| “This account has been disabled.” | Set `Active` to TRUE in the sheet. |
| “Too many sign-in attempts.” | Wait 15 minutes; attempts are limited per email. |
| Sign-in works but data is missing | Check the tab names in `backend/Config.gs` against the spreadsheet. |

---

## 8. Security notes

- The database ID lives only in `backend/`, which is not published.
- The login tab holds plain passwords because it is maintained by hand in the sheet.
  Keep the spreadsheet private; do not share it publicly.
- Anyone with the `/exec` URL can call the API, but every data endpoint requires a
  valid session token.
- Session tokens are random and only their SHA-256 hash is stored. Sessions expire
  after 30 days or when the user signs out.
