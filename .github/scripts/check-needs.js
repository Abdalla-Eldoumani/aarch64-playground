// The verdict of check.yml's ci job, the one required status check, read
// from NEEDS (`toJSON(needs)`). Skipped passes because coverage skips itself
// on most pull requests, and a push to integration skips every job that only
// tests; anything else short of success fails.
const PASSING = new Set(["success", "skipped"]);

function failures(needs) {
  const jobs = Object.entries(needs);
  if (jobs.length === 0) return ["no job results to judge"];
  return jobs
    .filter(([, job]) => !PASSING.has(job && job.result))
    .map(([name, job]) => `${name}: ${job ? job.result : "no result"}`);
}

if (require.main === module) {
  const bad = failures(JSON.parse(process.env.NEEDS || "{}"));
  // exitCode rather than exit(): node exits once the output has flushed.
  if (bad.length) {
    console.error(`failed:\n  ${bad.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log("every needed job passed or was skipped");
  }
}

module.exports = { failures };
