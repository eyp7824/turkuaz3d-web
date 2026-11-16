CREATE TABLE IF NOT EXISTS visits (
 id TEXT PRIMARY KEY,
 started_at INTEGER NOT NULL,
 last_seen_at INTEGER NOT NULL,
 duration_seconds INTEGER NOT NULL DEFAULT 0,
 country TEXT NOT NULL,
 city TEXT NOT NULL,
 page TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_start ON visits(started_at);
CREATE INDEX IF NOT EXISTS idx_visits_active ON visits(last_seen_at);
CREATE TABLE IF NOT EXISTS visit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 visitor_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 country TEXT NOT NULL,
 city TEXT NOT NULL,
 page TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_created ON visit_events(created_at);

CREATE TABLE IF NOT EXISTS pageviews(
 visitor_id TEXT NOT NULL,
 page TEXT NOT NULL,
 first_seen_at INTEGER NOT NULL,
 PRIMARY KEY(visitor_id,page)
);
CREATE INDEX IF NOT EXISTS idx_pageviews_at ON pageviews(first_seen_at);
