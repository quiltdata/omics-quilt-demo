# Workflow Sequest

What happens when you run the workflow?

1. User uploads (or updates) `input_metadata.json` file in the `fastq/region` folder in the input bucket
2. An `S3EventSource` watching for that files triggers the `fastqLambda` to `run_workflow` and `save_metadata` to the output bucket.
3. When run, FASTQ generates the output file `bqsr_report/*.hg38.recal_data.csv`
4. This acts as a sentinel file to trigger the `packager` lambda, which creates
   a package in the output bucket from everything in the parent of
   `bqsr_report`.

## Open Issues

- Why can't we just use the `omics` events to trigger the packager?
- S3 notifications for the output bucket are not working.
  The package is created, but we don't see it the Packages view.
