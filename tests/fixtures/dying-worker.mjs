// Stands in for the worker that dies mid-job: the real one is terminated when a
// parse outruns its timeout on a starved machine, which then fails every job
// queued behind it too. Exits before it can answer anything.
process.exit(1);
