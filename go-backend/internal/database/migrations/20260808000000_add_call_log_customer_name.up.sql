-- Caller name captured from find_or_create_customer tool calls — lets staff
-- see who called, not just the number, on the AI voice logs page.
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS customer_name VARCHAR(120);
