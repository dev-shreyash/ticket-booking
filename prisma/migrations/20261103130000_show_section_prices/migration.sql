-- ============================================================
-- Phase 4: Show-specific section pricing
-- ============================================================

CREATE TABLE "ShowSectionPrice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "showId" UUID NOT NULL,
    "screenId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowSectionPrice_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "ShowSectionPrice_price_nonnegative_check"
        CHECK ("price" >= 0)
);

-- One price per section per show.
CREATE UNIQUE INDEX "ShowSectionPrice_showId_sectionId_key"
ON "ShowSectionPrice" ("showId", "sectionId");

CREATE INDEX "ShowSectionPrice_sectionId_screenId_idx"
ON "ShowSectionPrice" ("sectionId", "screenId");

CREATE INDEX "ShowSectionPrice_showId_screenId_idx"
ON "ShowSectionPrice" ("showId", "screenId");

-- A show and section must belong to the same screen.
ALTER TABLE "ShowSectionPrice"
ADD CONSTRAINT "ShowSectionPrice_showId_screenId_fkey"
FOREIGN KEY ("showId", "screenId")
REFERENCES "Show" ("id", "screenId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ShowSectionPrice"
ADD CONSTRAINT "ShowSectionPrice_sectionId_screenId_fkey"
FOREIGN KEY ("sectionId", "screenId")
REFERENCES "SeatSection" ("id", "screenId")
ON DELETE RESTRICT
ON UPDATE CASCADE;


-- ============================================================
-- Backfill existing show prices from section base prices.
-- Existing prices are preserved if a record already exists.
-- ============================================================

INSERT INTO "ShowSectionPrice" (
    "id",
    "showId",
    "screenId",
    "sectionId",
    "price",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    sh."id",
    sh."screenId",
    section."id",
    section."basePrice",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Show" sh
JOIN "SeatSection" section
    ON section."screenId" = sh."screenId"
ON CONFLICT ("showId", "sectionId") DO NOTHING;


-- ============================================================
-- Ensure every show has one price for every screen section.
-- Validation is deferred until transaction commit so a show
-- and all its prices can be created in one transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION assert_screen_show_section_prices_complete(
    p_screen_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_screen_id IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Show" sh
        JOIN "SeatSection" section
            ON section."screenId" = sh."screenId"
        LEFT JOIN "ShowSectionPrice" price
            ON price."showId" = sh."id"
            AND price."screenId" = sh."screenId"
            AND price."sectionId" = section."id"
        WHERE sh."screenId" = p_screen_id
          AND price."id" IS NULL
    ) THEN
        RAISE EXCEPTION
            'Every show must have a price for every section on its screen (screen %)',
            p_screen_id
        USING ERRCODE = '23514';
    END IF;
END;
$$;


CREATE OR REPLACE FUNCTION trg_assert_show_section_prices_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP <> 'DELETE' THEN
        PERFORM assert_screen_show_section_prices_complete(
            NEW."screenId"
        );
    END IF;

    IF TG_OP <> 'INSERT' THEN
        PERFORM assert_screen_show_section_prices_complete(
            OLD."screenId"
        );
    END IF;

    RETURN NULL;
END;
$$;


CREATE CONSTRAINT TRIGGER "Show_section_prices_complete_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "Show"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trg_assert_show_section_prices_complete();


CREATE CONSTRAINT TRIGGER "SeatSection_show_prices_complete_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "SeatSection"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trg_assert_show_section_prices_complete();


CREATE CONSTRAINT TRIGGER "ShowSectionPrice_complete_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ShowSectionPrice"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trg_assert_show_section_prices_complete();


-- ============================================================
-- Existing show prices are now available for Phase 4.
-- ============================================================