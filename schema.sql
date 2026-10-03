CREATE TABLE IF NOT EXISTS races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_date TEXT NOT NULL,
  venue TEXT NOT NULL,
  race_no INTEGER NOT NULL,
  race_name TEXT,
  grade TEXT,
  surface TEXT,
  distance INTEGER,
  start_time TEXT,
  status TEXT DEFAULT 'scheduled',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(race_date, venue, race_no)
);

CREATE INDEX IF NOT EXISTS idx_races_date
ON races(race_date);

CREATE TABLE IF NOT EXISTS runners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL,
  horse_no INTEGER NOT NULL,
  frame_no INTEGER,
  horse_name TEXT NOT NULL,
  jockey TEXT,
  trainer TEXT,
  weight REAL,
  odds REAL,
  popularity INTEGER,
  status TEXT DEFAULT 'declared',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(race_id, horse_no),
  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_runners_race
ON runners(race_id);
