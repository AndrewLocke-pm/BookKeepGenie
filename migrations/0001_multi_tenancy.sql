-- 1. Create organisations
CREATE TABLE organisations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  vat_number  VARCHAR(20),
  country     VARCHAR(2) NOT NULL DEFAULT 'ZA',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Create organisation_members
CREATE TABLE organisation_members (
  id              SERIAL PRIMARY KEY,
  organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL DEFAULT 'owner',
  invited_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMP,
  UNIQUE(organisation_id, user_id)
);

-- 3. Add organisation_id to scoped tables (nullable for now)
ALTER TABLE transactions      ADD COLUMN organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE system_categories ADD COLUMN organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE tax_profiles      ADD COLUMN organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE vat_returns       ADD COLUMN organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE irp6_estimates    ADD COLUMN organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;

-- 4. Bootstrap: one organisation per existing user, backfill all rows
DO $$
DECLARE
  u RECORD;
  new_org_id INTEGER;
BEGIN
  FOR u IN SELECT id, email FROM users LOOP
    INSERT INTO organisations (name)
    VALUES (COALESCE(u.email, u.id))
    RETURNING id INTO new_org_id;

    INSERT INTO organisation_members (organisation_id, user_id, role, accepted_at)
    VALUES (new_org_id, u.id, 'owner', NOW());

    UPDATE transactions      SET organisation_id = new_org_id WHERE user_id = u.id;
    UPDATE system_categories SET organisation_id = new_org_id WHERE user_id = u.id;
    UPDATE tax_profiles      SET organisation_id = new_org_id WHERE user_id = u.id;
    UPDATE vat_returns       SET organisation_id = new_org_id WHERE user_id = u.id;
    UPDATE irp6_estimates    SET organisation_id = new_org_id WHERE user_id = u.id;
  END LOOP;
END $$;

-- 5. Indexes
CREATE INDEX idx_transactions_org      ON transactions(organisation_id);
CREATE INDEX idx_system_categories_org ON system_categories(organisation_id);
CREATE INDEX idx_tax_profiles_org      ON tax_profiles(organisation_id);
CREATE INDEX idx_vat_returns_org       ON vat_returns(organisation_id);
CREATE INDEX idx_irp6_estimates_org    ON irp6_estimates(organisation_id);
CREATE INDEX idx_org_members_user      ON organisation_members(user_id);
