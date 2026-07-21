update articles
set seo_summary = null,
    summary_is_original = false,
    summary_review_status = 'pending',
    summary_generation_model = null,
    summary_generated_at = null
where seo_summary is not null
  and array_length(regexp_split_to_array(trim(seo_summary), '\s+'), 1) < 200;
