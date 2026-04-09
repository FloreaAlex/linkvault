# LinkVault API Documentation

> **Version:** Development (no versioning yet)
>
> This document provides a complete reference for the HTTP API exposed by **LinkVault**. All endpoints are served by an Express.js server and operate on an in‑memory bookmark store persisted to `src/data.json`.

---

## Table of Contents
1. [General Information](#general-information)
2. [Authentication & Security](#authentication--security)
3. [Rate Limiting](#rate-limiting)
4. [Endpoints](#endpoints)
   - [Health Check (`GET /health`)](#get-health)
   - [Create Bookmark (`POST /bookmarks`)](#post-bookmarks)
   - [List Bookmarks (`GET /bookmarks`)](#get-bookmarks)
   - [Update Bookmark (`PUT /bookmarks/:id`)](#put-bookmarksid)
   - [Delete Bookmark (`DELETE /bookmarks/:id`)](#delete-bookmarksid)
   - [Search (`GET /search`)](#get-search)
   - [Statistics (`GET /stats`)](#get-stats)
5. [Error Responses](#error-responses)
6. [Common Curl Options](#common-curl-options)

---

## General Information
- **Base URL**: `http://localhost:3000` (or whatever host/port you configure via the `PORT` environment variable).
- All routes are absolute – there is no version prefix in the path.
- The server expects JSON request bodies (`Content-Type: application/json`).
- Responses are JSON unless otherwise noted.

## Authentication & Security
| Feature | Details |
|---|---|
| **API Token** | If the environment variable `API_TOKEN` is set, every request must include an `Authorization: Bearer <token>` header that exactly matches the token. The comparison uses a constant‑time algorithm to mitigate timing attacks.
| **Unauthenticated mode** | When `API_TOKEN` is *not* defined, all endpoints (except `/health`) are publicly accessible.
| **CORS** | Controlled by `CORS_ORIGIN`. If set to `*` or a specific origin, the server adds `Access-Control-Allow-Origin: <value>` and standard CORS headers. No default wildcard – browsers will block cross‑origin calls unless you configure this variable.
| **Security Headers** | The server always sends:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 0`
  - `Referrer-Policy: no-referrer`
| **Input Sanitisation** | `title`, `description` and each tag are HTML‑escaped on write to prevent XSS. URLs are stored verbatim after validation.

## Rate Limiting
A simple in‑memory token bucket limits each client IP to **10 requests per second**, with a burst capacity of **20**. Exceeding the limit yields:
```json
{ "error": "Too Many Requests" }
```
with HTTP status `429`.

---

## Endpoints
Below each endpoint includes:
- **Method & Path**
- **Authentication requirement**
- **Request schema** (JSON body or query parameters)
- **Success response example**
- **cURL snippet**

### `GET /health`
*Public – no auth required*
```text
OK
```
```bash
curl -s http://localhost:3000/health
```
---

### `POST /bookmarks`
*Create a new bookmark*
- **Auth**: Required if `API_TOKEN` is set.
- **Request Body**:
  ```json
  {
    "title": "Example Site",
    "url": "https://example.com",
    "description": "A short description (optional)",
    "tags": ["demo", "test"]
  }
  ```
- **Validation**:
  - `title` – required, string ≤ 200 chars.
  - `url` – required, must be a valid HTTP/HTTPS URL.
  - `description` – optional, string ≤ 1000 chars.
  - `tags` – optional array of strings (≤ 20 items, each ≤ 30 chars).
- **Success (201 Created)**:
  ```json
  {
    "id": "c1a2b3d4-5678-90ab-cdef-1234567890ab",
    "title": "Example Site",
    "url": "https://example.com",
    "description": "A short description (optional)",
    "tags": ["demo","test"],
    "createdAt": "2026-04-09T12:34:56.789Z"
  }
  ```
- **cURL**:
```bash
curl -X POST http://localhost:3000/bookmarks \
  -H "Content-Type: application/json" \
  $(if [ -n "$API_TOKEN" ]; then echo "-H \"Authorization: Bearer $API_TOKEN\""; fi) \
  -d '{
    "title": "Example Site",
    "url": "https://example.com",
    "description": "A short description (optional)",
    "tags": ["demo","test"]
  }'
```
---

### `GET /bookmarks`
*List all bookmarks, optionally filtered by a single tag*
- **Auth**: Required if `API_TOKEN` is set.
- **Query Parameters**:
  - `tag` (optional) – exact tag string to filter results.
- **Success (200 OK)** – array of bookmark objects as defined above.
- **cURL (all bookmarks)**:
```bash
curl http://localhost:3000/bookmarks \
  $(if [ -n "$API_TOKEN" ]; then echo "-H \"Authorization: Bearer $API_TOKEN\""; fi)
```
- **cURL (filter by tag `demo`)**:
```bash
curl "http://localhost:3000/bookmarks?tag=demo" \
  $(if [ -n "$API_TOKEN" ]; then echo "-H \"Authorization: Bearer $API_TOKEN\""; fi)
```
---

### `PUT /bookmarks/:id`
*Replace an existing bookmark entirely*
- **Auth**: Required if `API_TOKEN` is set.
- **Path Parameter**:
  - `:id` – UUID of the bookmark to update.
- **Request Body** – same schema as `POST`. All fields are required (except optional ones) because the implementation expects a full payload.
- **Success (200 OK)** – the updated bookmark object.
- **cURL example**:
```bash
curl -X PUT http://localhost:3000/bookmarks/c1a2b3d4-5678-90ab-cdef-1234567890ab \
  -H "Content-Type: application/json" \
  $(if [ -n "$API_TOKEN" ]; then echo "-H \"Authorization: Bearer $API_TOKEN\""; fi) \
  -d '{
    "title": "Updated Title",
    "url": "https://example.org",
    "description": "New description",
    "tags": ["updated"]
  }'
```
---

### `DELETE /bookmarks/:id`
*Delete a bookmark*
- **Auth**: Required if `API_TOKEN` is set.
- **Path Parameter**:
  - `:id` – UUID of the bookmark to delete.
- **Success (204 No Content)** – empty body.
- **cURL**:
```bash
curl -X DELETE http://localhost:3000/bookmarks/c1a2b3d4-5678-90ab-cdef-1234567890ab \
  $(if [ -n "$API_TOKEN" ]; then echo "-H \"Authorization: Bearer $API_TOKEN\""; fi)
```
---

### `GET /search`
*Full‑text search on title and description (case‑insensitive)*
- **Auth**: Required if `API_TOKEN` is set.
- **Query Parameter**:
  - `q` – the search term (required).
- **Success (200 OK)** – array of matching bookmark objects.
- **cURL**:
```bash
curl "http://localhost:3000/search?q=example" \
  $(if [ -n "$API_TOKEN" ]; then echo "-H \"Authorization: Bearer $API_TOKEN\""; fi)
```
---

### `GET /stats`
*Aggregate statistics about the store*
- **Auth**: Required if `API_TOKEN` is set.
- **Success (200 OK)**:
  ```json
  {
    "totalBookmarks": 42,
    "popularTags": [
      {"tag":"demo","count":12},
      {"tag":"node","count":9},
      {"tag":"api","count":7}
    ]
  }
  ```
- **cURL**:
```bash
curl http://localhost:3000/stats \
  $(if [ -n "$API_TOKEN" ]; then echo "-H \"Authorization: Bearer $API_TOKEN\""; fi)
```
---

## Error Responses
| Status | Condition | Body |
|--------|-----------|------|
| `400` | Validation error, missing required query param, malformed JSON, etc. | `{ "errors": ["title is required…"] }` or `{ "error": "query parameter \"q\" is required" }` |
| `401` | Missing or invalid API token (when `API_TOKEN` is set). | `{ "error": "Unauthorized" }` |
| `404` | Bookmark not found for a specific `:id`. *(Note: the current code returns generic 500 on missing ID – you may want to extend it.)* |
| `429` | Rate limit exceeded. | `{ "error": "Too Many Requests" }` |
| `500` | Unexpected server error. | `{ "error": "Internal Server Error" }` |

## Common cURL Options
- **Include auth header** only when you have set `API_TOKEN`:
  ```bash
  -H "Authorization: Bearer $API_TOKEN"
  ```
- **Pretty‑print JSON** (optional, for readability):
  ```bash
  | python -m json.tool
  ```
- **Verbose mode** to see request/response headers:
  ```bash
  curl -v …
  ```

---

*Generated on 2026‑04‑09. Adjust the examples to match your actual `API_TOKEN` and deployment host.*
