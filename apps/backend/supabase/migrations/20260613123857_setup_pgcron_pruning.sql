-- Create the pg_cron job to prune Ponder cache tables every 15 minutes.
-- Keeps a rolling window of 2 hours to handle blockchain reorganizations safely.
-- This targets the ponder_sync schema specifically.

SELECT cron.schedule(
  'prune-ponder-cache',
  '*/15 * * * *', -- Run every 15 minutes
  $$
    DO $block$
    DECLARE
      cutoff_block bigint;
    BEGIN
      -- Calculate the exact block number from 2 hours ago
      SELECT max(number) INTO cutoff_block 
      FROM ponder_sync.blocks 
      WHERE "timestamp" < extract(epoch from now() - interval '2 hours');

      IF cutoff_block IS NOT NULL THEN
        -- Safely delete all raw cache data older than the 2-hour cutoff
        DELETE FROM ponder_sync.logs WHERE block_number < cutoff_block;
        DELETE FROM ponder_sync.transactions WHERE block_number < cutoff_block;
        DELETE FROM ponder_sync.transaction_receipts WHERE block_number < cutoff_block;
        DELETE FROM ponder_sync.blocks WHERE number < cutoff_block;
      END IF;
    END $block$;
  $$
);
