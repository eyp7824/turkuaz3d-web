CREATE TABLE IF NOT EXISTS push_devices (
 token TEXT PRIMARY KEY,
 registered_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_devices_registered ON push_devices(registered_at);
