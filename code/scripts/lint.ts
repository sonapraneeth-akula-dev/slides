import { runLintCli } from '../src/lint';

process.exit(await runLintCli(process.argv.slice(2)));
