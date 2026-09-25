ALTER TABLE arena_matches
  DROP CONSTRAINT arena_matches_result_reason_check,
  ADD CONSTRAINT arena_matches_result_reason_check
    CHECK (
      result_reason IN (
        'score-limit',
        'time-limit',
        'all-frozen',
        'water-survived',
        'water-below-threshold'
      )
    );
