-- Counts contact-button clicks, never messages sent or completed telephone calls.
-- No phone numbers, WhatsApp message text, IPs or user agents are stored.
CREATE TABLE IF NOT EXISTS contact_clicks (
 id TEXT PRIMARY KEY,
 visitor_id TEXT NOT NULL,
 clicked_at INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('whatsapp','phone')),
 page TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_clicks_at ON contact_clicks(clicked_at);
