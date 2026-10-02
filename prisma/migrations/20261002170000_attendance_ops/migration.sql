ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_token_hash" TEXT;

ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "late_arrival" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "early_departure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "synced_from_offline" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "admin_alerts" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_alerts_created_at_idx" ON "admin_alerts"("created_at");

DO $$ BEGIN
  ALTER TABLE "admin_alerts"
    ADD CONSTRAINT "admin_alerts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
