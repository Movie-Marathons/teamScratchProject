zip code api





Cinema Search Game Plan

1. User Searches by ZIP → Prefer Browser Geolocation

Why: Better accuracy, fewer API calls, smoother UX.

Flow
	•	User clicks “Use my location” (or types a ZIP).
	•	Try browser geolocation first (with clear permission prompt text).
	•	If granted → get lat/lon.
	•	If denied/unavailable → gracefully fall back to ZIP → coords (server-side converter).

UX Notes
	•	Show a tooltip: “We’ll ask your browser for your current location. You can deny and type a ZIP instead.”
	•	If denied: automatically focus the ZIP input.

Acceptance Check:
	•	If user allows geolocation, you have lat/lon within ~1s.
	•	If they deny, the ZIP field is front-and-center with no errors.

⸻

2. Frontend → Backend: Always Send lat/lon When Available

Contract:
	•	Primary: GET /api/cinemas?lat=<num>&lon=<num>&radius=<km>&limit=<n>
	•	Fallback: GET /api/cinemas?zip=<string>&radius=<km>&limit=<n>

Rules:
	•	If you have lat/lon, do not send zip.
	•	Round to ~5–6 decimals to improve cache hits.
	•	Default radius=10 km, limit=12 (both overridable).

Acceptance Check:
	•	Network panel shows only one request with lat/lon when location is granted.

⸻

3. Backend: DB-First, MovieGlu-Second

Inputs Normalized
	•	Use lat/lon if present; otherwise derive from zip.
	•	Validate ranges (lat ∈ [-90,90], lon ∈ [-180,180]).

DB-First Logic
	•	Query cinemas within radius of (lat/lon), sorted by distance.
	•	Only treat rows as “fresh” if last_seen_at >= now() - 24h.
	•	Threshold: if the DB returns ≥ limit fresh rows → return them.
	•	Include meta.source = "cache", meta.refreshing = false.

Fallback to MovieGlu
	•	If none or not enough fresh rows:
	•	Call MovieGlu cinemasNearby with those coords (n = limit).
	•	Upsert cinemas (set last_seen_at = now(), keep/derive latitude/longitude, set PostGIS location if enabled).
	•	Return these results with meta.source = "movieglu".

Stale-While-Revalidate (Optional)
	•	If you have stale rows:
	•	Return them immediately with meta.source = "cache", refreshing = true.
	•	Kick off a background refresh (MovieGlu + upsert) without blocking the response.

Knobs:
	•	radius default (10 km).
	•	freshnessWindow (24h).
	•	threshold (defaults to limit, e.g., 12).
	•	forceRefresh=true (bypass cache for QA/admin).

Acceptance Check:
	•	For an area with prior searches, response comes from cache.
	•	For a new area, first call populates DB; second call within 24h is cache-only.

⸻

4. Frontend Displays Theaters from the Search

Response Shape to Render:

{
  "meta": { "source": "cache" | "movieglu", "refreshing": boolean, "count": number, "coords": {}, "fetchedAt": "ISO timestamp" },
  "data": [ { "id": number, "name": "string", "address": "string", "city": "string", "state": "string", "postcode": "string", "distance": number } ]
}

UX:
	•	Show “Nearby theaters” with distance and city.
	•	If meta.refreshing === true, show a subtle “Updating results…” badge/spinner.
	•	Debounce the ZIP input (300–400ms) to avoid rapid calls.

Acceptance Check:
	•	UI renders list quickly from cache when available; updates silently when refresh completes.

⸻

Bonus: Autocomplete + Filtering While Typing ZIP/City

Options:
	1.	Local list (fastest/no external API):
	•	Maintain a small static list of popular ZIPs/cities (JSON), fuzzy match on keystrokes, propose suggestions.
	2.	External geocoding API (smarter):
	•	Hit a geocoding service for type-ahead (city/ZIP), return top 5 matches, and use the selected item’s lat/lon.
	3.	Hybrid:
	•	Try local list first; if no hits by 3 chars, query external API.

Filtering:
	•	As the user types, narrow suggestions to city/ZIP.
	•	Once a suggestion is picked, immediately resolve lat/lon and call /api/cinemas.

Acceptance Check:
	•	Typing “941” shows “94103, 94102, …” quickly.
	•	Selecting a suggestion instantly shows theaters.

⸻

Milestones
	1.	M1: Frontend can get lat/lon (geolocation), send request, render results.
	2.	M2: Backend DB-first logic with freshness, threshold, and MovieGlu fallback.
	3.	M3: Optional stale-while-revalidate + tiny retry on 429.
	4.	M4: Autocomplete for ZIP/city (local list to start).



################################################################################################################################################################################


Redis Implementation – Short Game Plan

Goals
	•	Speed up /api/cinemas responses.
	•	Reduce MovieGlu calls (protect quota).
	•	Add simple rate limiting.

Components
	•	redis client (single helper file)
	•	cache layer around /api/cinemas
	•	rate limiter (IP-based; sliding window or token bucket)

Cache Keys & TTL
	•	Key format: cinemas:v1:lat=<lat>:lon=<lon>:r=<km>:n=<limit>
	•	ZIP fallback: cinemas:v1:zip=<zip>:r=<km>:n=<limit>
	•	TTL: 30 minutes (tune later)

Request Flow
	1.	Check Redis for key → if hit, return cached JSON.
	2.	If miss → DB-first radius query (fresh ≤ 24h).
	3.	If enough rows → set Redis (TTL 30m) → return.
	4.	Else → call MovieGlu, upsert DB, set Redis (TTL 15m) → return.

Rate Limiting (protect upstream)
	•	Key: rl:v1:ip=<ip>
	•	Policy: 30 req / 5 min per IP.
	•	On exceed → 429 with retry-after.

Observability
	•	Log cache hit|miss|set with key (without creds).
	•	Metric counters for hits, misses, api_calls, 429s.

Milestones
	1.	M1: Wire Redis client + env config, health check.
	2.	M2: Add cache wrapper around /api/cinemas (read → compute → write).
	3.	M3: Add rate limiter.
	4.	M4 (opt): Background refresh for stale cache (SWR).

Rollback Plan
	•	Feature flag env: REDIS_ENABLED=false → bypass cache/limiter.
	•	Non-fatal failures: on Redis error, continue without cache.