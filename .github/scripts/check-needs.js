// The verdict of check.yml's ci job, the one required status check. NEEDS
// holds `toJSON(needs)`: every other job and its result. A skipped job
// passes, because the path filter skips jobs on purpose; any other result
// that is not success fails, so a failed or cancelled job cannot pass as
// green.
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
  if (bad.length) {
    console.error(`failed:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
  console.log("every needed job passed or was skipped");
}

module.exports = { failures };
