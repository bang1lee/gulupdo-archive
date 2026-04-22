-- Cloudflare D1 · 굴업도 아카이브 참여 신청 DB
-- 초기 생성: wrangler d1 execute gulupdo-submissions --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    DEFAULT (datetime('now')),
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  telegram    TEXT,
  org         TEXT,
  time_pref   TEXT,
  referrer    TEXT,
  methods     TEXT,
  message     TEXT,
  ip_hash     TEXT,
  user_agent  TEXT,
  status      TEXT    DEFAULT 'new',       -- new/contacted/done/archived
  notes       TEXT,                         -- 운영진 내부 메모
  contacted_at TEXT                          -- 담당자 연락 완료 시간
);

CREATE INDEX IF NOT EXISTS idx_created  ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email    ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_status   ON submissions(status);

-- 간단한 통계용 뷰
CREATE VIEW IF NOT EXISTS submissions_daily AS
  SELECT
    substr(created_at, 1, 10) AS date,
    COUNT(*)                   AS total,
    SUM(CASE WHEN methods LIKE '%visit%'      THEN 1 ELSE 0 END) AS visit_count,
    SUM(CASE WHEN methods LIKE '%opinion%'    THEN 1 ELSE 0 END) AS opinion_count,
    SUM(CASE WHEN methods LIKE '%donate%'     THEN 1 ELSE 0 END) AS donate_count,
    SUM(CASE WHEN methods LIKE '%volunteer%'  THEN 1 ELSE 0 END) AS volunteer_count
  FROM submissions
  GROUP BY substr(created_at, 1, 10)
  ORDER BY date DESC;
