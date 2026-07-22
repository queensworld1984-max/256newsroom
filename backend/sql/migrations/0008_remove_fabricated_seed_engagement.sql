-- Removes fabricated engagement numbers and trust scores that were seeded
-- as placeholder data in schema.sql but served to the public as if real
-- (via /api/journalists/top). No genuine engagement tracking exists yet.
delete from engagement_stats where entity_type = 'journalist';
update journalists set trust_score = 0;
