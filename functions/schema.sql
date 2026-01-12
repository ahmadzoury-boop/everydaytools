CREATE TABLE IF NOT EXISTS brain_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  date TEXT NOT NULL,                 -- YYYY-MM-DD (UTC)
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 30),

  name TEXT DEFAULT 'Anonymous',      -- optional display name
  device_hash TEXT NOT NULL,          -- hashed device identifier

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(date, device_hash)           -- prevent duplicate daily submissions
);

CREATE INDEX IF NOT EXISTS idx_brain_scores_date
ON brain_scores(date);

CREATE INDEX IF NOT EXISTS idx_brain_scores_score
ON brain_scores(score DESC);
