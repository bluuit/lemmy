/* 
  create test.csv with

    cat RS_2023-01 | head -n 10 > test.csv
  
  psql command to populate a table with the json data

   \copy reddit from '/run/media/altina/storage5/redarcs/2023-01/reddit/submissions/test.csv' csv quote e'\x01' delimiter e'\x02' 

*/

create 
or replace table submissions(
  title text, permalink text, url text, 
  author text, created_utc bigint, 
  id text, over_18 boolean, subreddit_name_prefixed text
);
insert into submissions 
select 
  title, 
  permalink, 
  url, 
  author, 
  created_utc, 
  id, 
  over_18, 
  subreddit_name_prefixed 
from 
  reddit, 
  jsonb_to_record(json) as z(
    title text, permalink text, url text, 
    author text, 
    created_utc bigint, 
    id text, name text, over_18 boolean, subreddit_name_prefixed text
  );

/* 
  get disk usage info about all tables 

  https://wiki.postgresql.org/wiki/Disk_Usage
*/

WITH RECURSIVE pg_inherit(inhrelid, inhparent) AS
    (select inhrelid, inhparent
    FROM pg_inherits
    UNION
    SELECT child.inhrelid, parent.inhparent
    FROM pg_inherit child, pg_inherits parent
    WHERE child.inhparent = parent.inhrelid),
pg_inherit_short AS (SELECT * FROM pg_inherit WHERE inhparent NOT IN (SELECT inhrelid FROM pg_inherit))
SELECT table_schema
    , TABLE_NAME
    , row_estimate
    , pg_size_pretty(total_bytes) AS total
    , pg_size_pretty(index_bytes) AS INDEX
    , pg_size_pretty(toast_bytes) AS toast
    , pg_size_pretty(table_bytes) AS TABLE
    , total_bytes::float8 / sum(total_bytes) OVER () AS total_size_share
  FROM (
    SELECT *, total_bytes-index_bytes-COALESCE(toast_bytes,0) AS table_bytes
    FROM (
         SELECT c.oid
              , nspname AS table_schema
              , relname AS TABLE_NAME
              , SUM(c.reltuples) OVER (partition BY parent) AS row_estimate
              , SUM(pg_total_relation_size(c.oid)) OVER (partition BY parent) AS total_bytes
              , SUM(pg_indexes_size(c.oid)) OVER (partition BY parent) AS index_bytes
              , SUM(pg_total_relation_size(reltoastrelid)) OVER (partition BY parent) AS toast_bytes
              , parent
          FROM (
                SELECT pg_class.oid
                    , reltuples
                    , relname
                    , relnamespace
                    , pg_class.reltoastrelid
                    , COALESCE(inhparent, pg_class.oid) parent
                FROM pg_class
                    LEFT JOIN pg_inherit_short ON inhrelid = oid
                WHERE relkind IN ('r', 'p')
             ) c
             LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
  ) a
  WHERE oid = parent
) a
ORDER BY total_bytes DESC;
