import { runCorrectionDemo } from '../demo/correction-demo.js';

runCorrectionDemo()
  .then((output) => {
    process.stdout.write(`${output}\n`);
  })
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
