import { Command } from 'commander';

export const scanCommand = new Command('scan')
  .description('Scan a target')
  .argument('<target>', 'Target to scan (e.g., express)')
  .option('-a, --arg <value>', 'Example argument')
  .action((target: string, options: { arg?: string }) => {
    console.log(`Scanning target: ${target}`);
    if (options.arg) {
      console.log(`With argument: ${options.arg}`);
    }

    // Your scan logic will go here
  });
