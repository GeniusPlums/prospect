import { runEvalSuite } from "./run-eval.ts";

const report = runEvalSuite();
console.log(JSON.stringify(report, null, 2));
if (!report.passed) {
  console.error(report.notes);
  process.exit(1);
}
