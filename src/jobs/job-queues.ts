// The queues the Worker consumes, as cloudflare.config.ts names them. Its own copy: the Worker cannot load a file the
// config imports. job-queues.test.ts holds the two together.
export const jobsQueue = "jobs";

// Where a job waits after its last retry; the same Worker reads it to say what was lost
export const deadJobsQueue = "jobs-dead";
