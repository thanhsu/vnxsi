-- Landing v2 (agent platform): record which language the visitor signed up in.
-- Personas and spend bands changed meaning (developer roles, USD bands); old rows keep their values.
ALTER TABLE waitlist ADD COLUMN lang TEXT; -- en | vi
