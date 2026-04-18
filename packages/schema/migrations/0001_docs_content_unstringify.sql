-- Fix docs_pages.content rows that were double-stringified by the pre-session-129
-- createDocsPage / updateDocsPage bug. Those rows are stored as a jsonb STRING
-- whose VALUE is the JSON text of a BlockTuple array; we unwrap to a proper
-- jsonb ARRAY so SQL that uses jsonb_typeof / jsonb_array_elements can reach
-- the block contents (docs search especially).
--
-- Rows where content is a genuine legacy-markdown string (doesn't start with
-- '[' or '{') are left alone — they're intentional strings for the markdown
-- renderer path.

UPDATE docs_pages
SET content = (content #>> '{}')::jsonb
WHERE jsonb_typeof(content) = 'string'
  AND substr(content #>> '{}', 1, 1) IN ('[', '{');
