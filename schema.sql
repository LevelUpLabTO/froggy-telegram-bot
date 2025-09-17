CREATE TABLE chats(
  id INTEGER PRIMARY KEY,
  created_at DATE DEFAULT (DATE('now')),
  updated_at DATE DEFAULT (DATE('now')),
  free_games INTEGER DEFAULT 0 CHECK(free_games IN (0,1)),
  events_lul INTEGER DEFAULT 0 CHECK(events_lul IN (0,1)),
  events_igda INTEGER DEFAULT 0 CHECK(events_igda IN (0,1)),
  debug INTEGER DEFAULT 0 CHECK(debug IN (0,1))
);
