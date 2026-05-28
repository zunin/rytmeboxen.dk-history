-- freeze.sql
-- Converts cds.json into a dated Parquet snapshot and registers it in a Frozen DuckLake.
--
-- The {{DATE}} placeholder is replaced by the CI workflow with the current date (YYYY-MM-DD).
--
-- Usage:
--   sed "s/{{DATE}}/$(date -u +%Y-%m-%d)/g" freeze.sql | duckdb

LOAD ducklake;

-- Step 1: Convert cds.json → a dated Parquet file
COPY (
    SELECT * FROM read_json_auto('cds.json')
) TO 'parquet/cds-{{DATE}}.parquet';

-- Step 2: Attach the DuckLake catalog (creates the file if it doesn't exist)
ATTACH 'ducklake:rytmeboxen.ducklake' AS lake (DATA_PATH 'parquet/');

-- Step 3: Ensure the table exists with the correct schema.
-- We use VARCHAR for all musicbrainz fields. DuckDB's Parquet reader returns
-- inconsistent types (BLOB vs VARCHAR) for nested strings, so we cast on insert.
DROP TABLE IF EXISTS lake.cds;
CREATE TABLE lake.cds (
    artist VARCHAR,
    albumTitle VARCHAR,
    price VARCHAR,
    origin VARCHAR,
    quality VARCHAR,
    type VARCHAR,
    musicbrainz STRUCT(
        releaseGroupId VARCHAR,
        artist VARCHAR,
        albumTitle VARCHAR,
        type VARCHAR
    )
);

-- Step 4: Insert all snapshots into the lake, casting nested struct fields to VARCHAR.
-- DuckDB's Parquet reader mixes BLOB and VARCHAR for nested strings, so we normalize
-- them on insert. This works for both migration (all files) and fresh runs.
INSERT INTO lake.cds
SELECT
    artist,
    albumTitle,
    price,
    origin,
    quality,
    type,
    struct_pack(
        releaseGroupId := musicbrainz.releaseGroupId::VARCHAR,
        artist := musicbrainz.artist::VARCHAR,
        albumTitle := musicbrainz.albumTitle::VARCHAR,
        type := musicbrainz.type::VARCHAR
    ) AS musicbrainz
FROM 'parquet/cds-*.parquet';
