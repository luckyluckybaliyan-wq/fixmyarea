# FixMyArea

**Report, map and track local problems in your neighbourhood.**
FixMyArea is a full-stack civic-issue website. Citizens drop a pin on a Google Map, describe a problem (pothole, broken streetlight, garbage, water leak, open drain), and the community upvotes and comments until the authority marks it resolved.

---

## Table of contents
1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Quick start](#quick-start)
5. [Getting a Google Maps API key](#getting-a-google-maps-api-key)
6. [Environment variables](#environment-variables)
7. [How it works](#how-it-works)
8. [REST API reference](#rest-api-reference)
9. [Data model](#data-model)
10. [Security notes](#security-notes)
11. [Customisation guide](#customisation-guide)
12. [Deployment](#deployment)
13. [Testing checklist](#testing-checklist)
14. [Troubleshooting](#troubleshooting)
15. [Roadmap](#roadmap)
16. [Contributing](#contributing)
17. [License](#license)

---

## Features
- Interactive **Google Map** showing every reported issue as a colour-coded pin (red = open, amber = in progress, green = resolved)
- **Report a problem**: title, category, details, and a location chosen by clicking the map or using **Use my location** (browser geolocation)
- **Place search** with Google Places Autocomplete to jump to any area or locality
- **Live list + map sync**: clicking a list item pans the map; clicking a pin opens the issue details
- **Filters** by category, status and keyword
- **Upvotes** so the most urgent problems rise to the top
- **Comments** on every issue
- **Dashboard counters** (reported / in progress / resolved)
- **Admin status updates** (open, in progress, resolved) protected by a token
- Works without a Maps key (list view only) so you can develop offline
- Responsive layout, keyboard focus styles, reduced-motion support

## Tech stack
| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript (ES2020) |
| Maps | Google Maps JavaScript API, Places API, Geolocation API |
| Backend | Node.js 18+, Express 4 |
| Storage | JSON file (`data/issues.json`), easy to swap for MongoDB / PostgreSQL |
| Config | dotenv |

## Project structure
```
fixmyarea/
├── server.js              # Express server, REST API, Maps loader route
├── package.json
├── .env.example           # Copy to .env and fill in
├── .gitignore
├── README.md
├── data/
│   └── issues.json        # Seed data + runtime storage
├── docs/
│   ├── API.md             # Request/response examples
│   └── DEPLOYMENT.md      # Hosting guides
└── public/
    ├── index.html         # Single-page UI
    ├── css/style.css      # All styling
    └── js/app.js          # Map, list, filters, forms
```

## Quick start
```bash
# 1. Install Node.js 18 or newer from https://nodejs.org
# 2. Open a terminal inside the project folder
npm install
cp .env.example .env        # on Windows: copy .env.example .env
# 3. Put your Google Maps key and an admin token inside .env
npm start
# 4. Open http://localhost:3000
```
Use `npm run dev` to auto-restart on file changes.

## Getting a Google Maps API key
1. Go to <https://console.cloud.google.com> and create a project.
2. Enable billing (Google gives a monthly free credit for Maps usage).
3. Open **APIs & Services > Library** and enable **Maps JavaScript API** and **Places API**.
4. Open **APIs & Services > Credentials > Create credentials > API key**.
5. Restrict the key: *Application restrictions* = HTTP referrers (your domain and `localhost:3000/*`), *API restrictions* = the two APIs above.
6. Paste it into `.env` as `GOOGLE_MAPS_API_KEY`.

## Environment variables
| Name | Purpose | Default |
|---|---|---|
| `PORT` | Server port | 3000 |
| `GOOGLE_MAPS_API_KEY` | Loads the map and place search | none |
| `ADMIN_TOKEN` | Required header value to change issue status | none (admin disabled) |
| `DEFAULT_LAT`, `DEFAULT_LNG` | Initial map centre. Set these to your city | New Delhi |

## How it works
1. The browser requests `/maps-loader.js`. The server builds this script on the fly, injects the API key and the default centre, and loads Google Maps with `callback=initMap`. The key is therefore never committed to the frontend files.
2. `initMap()` creates the map and the Places search box, then calls `init()`.
3. `refresh()` calls `GET /api/issues` with the active filters, then redraws the list, the markers and the counters.
4. When a user reports a problem, they either click the map (the pin position becomes `lat/lng`) or tap **Use my location**. The form is sent to `POST /api/issues`, validated on the server, and saved.
5. Upvotes and comments are separate endpoints so the UI updates without a full reload.
6. Staff change the status using `PATCH /api/issues/:id/status` with the `x-admin-token` header.

## REST API reference
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/issues?category=&status=&q=` | List issues, sorted by upvotes |
| GET | `/api/issues/:id` | One issue with comments |
| POST | `/api/issues` | Create issue `{title, category, description, lat, lng, address?}` |
| POST | `/api/issues/:id/upvote` | Add one upvote |
| POST | `/api/issues/:id/comments` | Add comment `{name?, text}` |
| PATCH | `/api/issues/:id/status` | Admin only, `{status}`. Header `x-admin-token` |
| GET | `/api/stats` | Totals by status and category |

Categories: `road`, `light`, `garbage`, `water`, `drain`, `safety`, `other`
Statuses: `open`, `in_progress`, `resolved`

Example:
```bash
curl -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -d '{"title":"Broken footpath","category":"road","description":"Tiles missing","lat":28.61,"lng":77.21}'

curl -X PATCH http://localhost:3000/api/issues/<id>/status \
  -H "Content-Type: application/json" -H "x-admin-token: change-this-secret" \
  -d '{"status":"resolved"}'
```

## Data model
```json
{
  "id": "uuid",
  "title": "string (max 100)",
  "description": "string (max 800)",
  "category": "road | light | garbage | water | drain | safety | other",
  "status": "open | in_progress | resolved",
  "lat": 28.6139,
  "lng": 77.2090,
  "address": "string",
  "upvotes": 0,
  "comments": [{ "name": "string", "text": "string", "at": "ISO date" }],
  "createdAt": "ISO date"
}
```

## Security notes
- All user text is stripped of `<` and `>` on the server and escaped again in the browser before rendering (XSS protection).
- Write endpoints have a simple in-memory rate limit (30 requests per 10 minutes per IP). Use `express-rate-limit` or a gateway in production.
- Status changes need `ADMIN_TOKEN`. Use a long random value and HTTPS.
- Restrict your Google key by referrer and API. Never commit `.env`.
- The upvote endpoint is not one-per-user. Add login or device fingerprinting before a public launch.

## Customisation guide
- **Change city**: set `DEFAULT_LAT` and `DEFAULT_LNG`.
- **Add a category**: add it to `CATEGORIES` in `server.js` and to `CATS` in `public/js/app.js`.
- **Change colours**: edit the CSS variables at the top of `style.css` and `COLOR` in `app.js`.
- **Use a database**: replace `load()` and `save()` in `server.js` with MongoDB or PostgreSQL calls. The route code stays the same.

## Deployment
- **Render / Railway**: connect the repo, build command `npm install`, start command `npm start`, add the environment variables in the dashboard.
- **VPS**: install Node, run with `pm2 start server.js`, put Nginx in front with HTTPS (Let's Encrypt).
- JSON-file storage needs a persistent disk. On platforms with ephemeral disks, move to a hosted database first.
- Add your production domain to the Google key's allowed referrers.

## Testing checklist
- [ ] Map loads and shows 5 seed pins
- [ ] Filters change both list and pins
- [ ] Report form refuses to submit without a pin
- [ ] Use my location moves the map and sets the pin
- [ ] Upvote and comment update instantly
- [ ] Admin PATCH changes pin colour after refresh
- [ ] Page works on a phone-sized screen
- [ ] Without an API key, the list still loads and a message explains the map

## Troubleshooting
| Problem | Fix |
|---|---|
| Grey map or "For development purposes only" | Billing is not enabled or the key restrictions block localhost |
| `RefererNotAllowedMapError` | Add `localhost:3000/*` to the key's HTTP referrers |
| Place search does nothing | Enable **Places API** for the key |
| Location button fails | Browsers allow geolocation only on HTTPS or localhost |
| Data resets on host restart | Host disk is ephemeral. Use a database |

## Roadmap
- Photo upload for each report
- User accounts and one vote per user
- Marker clustering and heatmap view
- Email / SMS updates when status changes
- Admin dashboard with charts and CSV export
- Duplicate-report detection by distance
- Hindi and other language support
- Progressive Web App (offline reporting)

## Contributing
Fork the repo, create a branch, make your change, and open a pull request with a short description and screenshots.

## License
MIT. Free to use for learning, college projects and civic work.
