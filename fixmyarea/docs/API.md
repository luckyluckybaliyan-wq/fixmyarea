# FixMyArea API examples

All responses are JSON. Errors look like `{ "error": "message" }`.

## GET /api/issues
Query: `category`, `status`, `q`. Returns an array sorted by `upvotes` (highest first).

## POST /api/issues
Body: `{ "title": "...", "category": "road", "description": "...", "lat": 28.61, "lng": 77.2 }`
Returns `201` with the new issue. Returns `400` if title, category or coordinates are invalid.

## POST /api/issues/:id/upvote
Returns `{ "upvotes": 15 }`.

## POST /api/issues/:id/comments
Body: `{ "name": "Asha", "text": "Still not fixed" }`. Returns the updated issue.

## PATCH /api/issues/:id/status
Header: `x-admin-token`. Body: `{ "status": "in_progress" }`. Returns `401` without the token.

## GET /api/stats
Returns `{ "total": 5, "byStatus": {...}, "byCategory": {...} }`.
