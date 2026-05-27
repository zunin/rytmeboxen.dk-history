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

-- Step 3: First run only — create the table schema from the Parquet structure
CREATE TABLE IF NOT EXISTS lake.cds AS
    SELECT * FROM 'parquet/cds-{{DATE}}.parquet'
    WITH NO DATA;

-- Step 4: Register the new Parquet file in the lake (metadata only, no data copy).
-- Each file has a unique date-based name, so duplicate registration is impossible.
CALL ducklake_add_data_files('lake', 'cds', 'parquet/cds-{{DATE}}.parquet');
