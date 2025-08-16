git commit -m "planner(+selected-theater,landmarks,ui): marathon summary, 12h times, queue fixes, pass city/zip, landmarks modal, share flow

- PlannerPage
  - New 'Movie Marathon' summary (Theater, City, Start time, Total time)
  - Share modal (Start, All Movies, End, Total) + actions:
    - Download PDF (print-friendly window)
    - Email (mailto with summary)
    - Text (sms with summary)
  - Queue: sort by earliest start (AM/PM-safe), clear-all button, reset on route change/unmount
  - Robust param handling: prefers URL `city`/`zip`; derives `effectiveZip` from theater (`zip|postcode|postal_*`)
  - Fetch showtimes uses `effectiveZip`; fixed effect order to avoid TDZ crash
  - 12-hour time display for showtimes; tolerant converters 12h/24h
  - Selected theater resolution prefers `cinemaId`, then name; stable logs for debugging
  - Landmarks modal receives `zip` + `city`

- SelectedTheater
  - Showtimes display in 12-hour format
  - Modal refactor: centered, fixed size, scrollable
  - Planner deep-link now includes `city` AND `zip`

- TheaterGrid
  - Passes `city` and robust `zip` (postcode/zip/postal_code) to SelectedTheater

- LandmarksPage
  - Accepts `zip`/`city` props; auto-loads on open
  - Fixed race: split state sync vs fetch; `loadByZip(zip?)` uses latest value
  - Small UX: Enter-to-search, city hint in header

- Misc
  - Added comprehensive logging across flows
  - Layout overhaul: two-column grid, sticky sidebar for summary + queue
"

feat(planner): rebuild Planner page flow, add queue mgmt, sharing & landmarks
	•	Normalize query params (movieId, theater, cinemaId, zip, date, showtime|time)
	•	Default date to today (YYYY-MM-DD) and compute baseDate for queue math
	•	Resolve effectiveZip from selected theater (postal code fallbacks) with debug logs
	•	Select theater by cinemaId (multiple id shapes) → name → fallback to first
	•	Normalize films across legacy/grouped shapes; extract times safely (display vs raw)
	•	Add tolerant time helpers:
	•	convertTo24HourLabel() (12/24h → HH:MM)
	•	to12HourLabel() (display normalization)
	•	parseTime12ToMinutes() for schedule math
	•	Auto-add to queue once per (movieId|showtime|date) when enabled
	•	Manual “Add to queue” buttons use normalized display labels
	•	Sort queue by earliest start; compute:
	•	marathonStart (earliest time from queue or showtimes fallback)
	•	marathonEnd (handles past-midnight)
	•	totalSpan (duration between earliest start and latest end)
	•	Queue lifecycle:
	•	Clear on route context change (cinemaId|theater|date)
	•	Clear on unmount
	•	“Clear queue” action in UI
	•	New modals:
	•	Share: printable/email/text summary, inline PDF-style print template
	•	Landmarks: opens LandmarksPage with zip/city context
	•	Add lightweight debug logs to trace param resolution, selection, and normalization
	•	Improve empty states and loading copy

Why
	•	Prevents blank pages from empty date
	•	Stabilizes planner behavior across mixed payload shapes
	•	Gives users shareable itinerary and nearby context without leaving page
	•	Makes queue deterministic and resets when context changes to avoid stale carryover

Testing
	•	Navigate from theater → planner with/without showtime and date
	•	Verify fetchShowtimes payload includes non-empty date and cinemaId|zip
	•	Confirm queue auto-add triggers once, sorts by time, and resets on:
	•	changing cinemaId/theater/date
	•	leaving the Planner page
	•	Toggle Share and Landmarks modals; print, email, and text actions render content
	•	Check console debug: param resolution, selected theater, normalized films


feat: make cinemas & showtimes DB-first with safe fallbacks; harden API timeouts/parsing; stabilize 200 responses

Why

MovieGlu calls were rate-limiting/timing out, bubbling 500s to the UI and crashing the Planner.

What changed
	•	Services (DB-first, guarded external calls)
	•	server/services/cinema.service.js
	•	Short-circuit to DB results when present.
	•	Gate external calls behind ALLOW_EXTERNAL.
	•	Swallow external errors (429/5xx/network) → return DB results.
	•	server/services/cinemaShowTimes.service.js
	•	Added cache check for existing showings for (cinema, date) and return grouped films.
	•	Gate external calls behind ALLOW_EXTERNAL.
	•	Safe fallbacks for external failure/invalid payloads.
	•	Controllers (stable 200s)
	•	server/controllers/cinemaController.js
	•	Always respond 200 with { ok: true, zip, cinemas }.
	•	On error, return { ok: true, cinemas: [], note: '...' } instead of 500.
	•	server/controllers/cinemaShowTimesController.js
	•	Validate cinema_id and date up front.
	•	Always respond 200 with { ok: true, ... }; safe fallback with empty films on error.
	•	API clients (timeouts + defensive parsing)
	•	server/api/cinemaAPI.js
	•	Added fetchWithTimeout (default 8s via HTTP_TIMEOUT_MS).
	•	Redacted sensitive headers in debug logs.
	•	Return [] on 429/timeout/invalid JSON.
	•	server/api/cinemaShowTimesApi.js
	•	Added fetchWithTimeout.
	•	Return safe minimal payload on 429/empty/invalid JSON/timeout.
	•	Normalize to always include films: [] and cinema.

Env
	•	ALLOW_EXTERNAL=0|1 — disable/enable MovieGlu calls (dev can set 0 to run DB-only).
	•	HTTP_TIMEOUT_MS=8000 — optional HTTP timeout override.

Notes for frontend
	•	Responses now consistently include ok: true (fields like zip, cinemas, films unchanged).
	•	Empty external results no longer throw; expect [] with optional reason/_meta.

Testing
	1.	Set .env:


	2.	Restart server.
	3.	Hit:
	•	/api/cinemas?zip=94103&date=2025-08-16
	•	/api/cinemaShowTimes?cinema_id=9218&date=2025-08-16
	4.	Verify:
	•	HTTP 200 in all cases.
	•	{ ok: true, ... } shape.
	•	When DB has data, service returns cache (reason: CACHE_HIT).
	•	With ALLOW_EXTERNAL=0, returns safe empty payloads without errors.

Future work
	•	Frontend: handle “no results” state gracefully for cinemas: [] / films: [].
	•	Optional: metrics on cache hits vs external calls; circuit-breaker around external API.


feat(posters): wire IMDB fallback + frontend rendering; add list endpoint, caching, and perf tweaks

- Added bulk poster fetcher (IMDB fallback) and verified via dry-run & live insert
  - Script: `server/utils/fetch_all_posters_imdb.js`
  - Idempotent: only inserts for films missing an image
  - Retries with backoff; CLI flags: --limit, --concurrency, --dry-run
  - Inserts base64 + alt_text into `images (film_id, image_base64, alt_text)`

- Backend API
  - routes/MoviePosters.js: new `GET /api/moviePosters?limit=N`
    - Returns random sample of posters from DB
    - Adds cache headers (`Cache-Control: public, max-age=3600, stale-while-revalidate=86400`)
    - Logs query + errors for debug
    - Fix: missing comma in db.query params (500 bug)
  - server: enable gzip compression to reduce payload size

- Frontend UI
  - components/layout/PosterAside.tsx:
    - Fetch posters from `/api/moviePosters?limit=3`
    - Render base64 via data URI; lazy-load (`loading="lazy"`) + `decoding="async"`
    - Width hint to reduce layout thrash; loading/error states
    - Removed mock JSON dependency

- DB/model alignment
  - films table now includes `movie_glu_film_id` (for future MovieGlu lookups)
  - Images endpoint no longer assumes created_at (ordered randomly instead)

- Fixes & DX
  - Resolved stray quote causing Vite parse error in PosterAside
  - Added server-side logging for list endpoint
  - Postman tests updated: use POST /api/moviePosters/fetch for ingestion; GET for listing

Perf notes:
- Fewer posters per request (3) + gzip + lazy/async images = much faster render.
- Next step (optional): add thumbnail endpoint using `sharp` to downscale server-side.

Refs: IMDB fallback, sidebar posters, caching, compression, logging


feat(planner,stores,repo): reliable deep-link flow, real runtimes, and sturdier queue

Why

Deep-linked /planner?... routes sometimes rendered blank or showed “No data yet” because:
	•	fetches were missing show_date_id and/or using mismatched showtime|time params,
	•	queue state could be undefined under HMR/persist,
	•	auto-add ran with stale deps, and
	•	repo readers didn’t return duration, so end times defaulted to 90m.

What changed

Frontend
	•	PlannerPage.tsx
	•	Read showtime (pref) or time; propagate time into fetch.
	•	Read and pass showDateId in the fetch payload.
	•	Defensive watchQueue ?? [] to avoid blank-page crashes.
	•	Auto-add runs once per (movieId|showtime|date); guards against stale runs.
	•	getDurationMins resolves from loaded films (duration_min | duration_mins | duration_hrs_mins) to compute accurate endTime.
	•	Added small UX: selected info box, share/print helpers, logs gated to dev.
	•	useShowtimesStore.ts
	•	Abort-safe fetch with AbortSignal; ignore NS_BINDING_ABORTED.
	•	Conditional query params (cinema_id, date, optional show_date_id, time).
	•	Shape-agnostic parsing (films|results|showings|data|[]) + stable film keys.
	•	useScheduleStore.ts
	•	Hard guards for persisted/legacy state: always treat watchQueue as array.
	•	Safe duplicate/overlap checks; safe remove.
	•	persist.migrate coerces bad watchQueue to [].
	•	WatchQueueTable.tsx
	•	Centered, scrollable table with sticky header; tabular numerals for times; non-breaking API.

Backend
	•	server/repos/cinemaShowTimesRepo.js
	•	listShowingsWithTitles/listShowingsGrouped now SELECT f.duration_mins.
	•	Response maps include duration_min and formatted duration_hrs_mins ("Hh Mm").
	•	GROUP BY updated for grouped reader.

Results
	•	/planner?movieId=…&showtime=HH:MM&theater=…&cinemaId=…&date=YYYY-MM-DD&showDateId=…
	•	Showtimes fetch succeeds (no empty payloads from missing show_date_id).
	•	Queue auto-adds a single item with correct end time from real runtime.
	•	No blank screens from undefined arrays or aborted requests.

Dev notes
	•	Red “NS_BINDING_ABORTED” rows in Network are expected when params change or in React StrictMode; subsequent request completes with 200.
	•	If testing without deep link, open a theater modal and click a time to navigate.

Testing
	1.	Click a time in SelectedTheater → land on /planner?....
	2.	Verify Network call includes cinema_id, date, show_date_id, and optional time.
	3.	Confirm “Available Movies” renders; queue contains one entry with correct endTime.
	4.	Add/remove items; verify overlap guard and sorted display.
	5.	Refresh → persisted queue remains valid via migration.

Refs: modal → planner param handshake, duration plumbed from DB to UI, store hardening for HMR/persist.