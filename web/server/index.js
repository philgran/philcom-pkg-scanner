import express from 'express';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve(__dirname, '../client/dist')));
}

// API endpoint to scan dependencies
app.post('/api/scan', async (req, res) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    // Resolve the path relative to the project root
    const targetPath = resolve(process.cwd(), path);

    // Execute the CLI command with -j flag for JSON output
    const cliPath = resolve(__dirname, '../../dist/index.js');
    const command = `node "${cliPath}" scan "${targetPath}" -j`;

    console.log(`Executing: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      timeout: 120000, // 2 minute timeout
    });

    // Parse the JSON output from the CLI
    let reports;
    try {
      reports = JSON.parse(stdout);
    } catch (parseError) {
      console.error('Failed to parse CLI output:', stdout);
      throw new Error('Invalid JSON response from CLI');
    }

    // Calculate total dependencies
    let totalDependencies = 0;
    for (const report of reports) {
      if (report.summary && report.summary.totalPackages) {
        totalDependencies += report.summary.totalPackages;
      }
    }

    // Return combined report
    res.json({
      success: true,
      totalDependencies,
      reports,
    });

  } catch (error) {
    console.error('Scan error:', error);

    // Handle execution errors
    if (error.code === 'ENOENT') {
      return res.status(500).json({
        error: 'CLI not found',
        message: 'Please run "npm run build" to build the CLI first',
      });
    }

    res.status(500).json({
      error: 'Failed to scan dependencies',
      message: error.message,
      stderr: error.stderr || undefined,
    });
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(resolve(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
