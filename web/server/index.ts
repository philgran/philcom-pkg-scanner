import express, { Request, Response } from 'express';
import { resolve } from 'path';
import { getDependencies } from '../../src/utils/get-dependencies';
import { checkVulnerabilities } from '../../src/utils/osv-client';
import { getAdvisory } from '../../src/utils/ghsa-client';
import { OutputWriter } from '../../src/utils/output-writer';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve(__dirname, '../client/dist')));
}

// API endpoint to scan dependencies
app.post('/api/scan', async (req: Request, res: Response) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const targetPath = resolve(path);

    // Get dependencies
    const dependencies = await getDependencies(targetPath);

    // Group dependencies by ecosystem
    const npmDeps = dependencies.filter(dep => dep.ecosystem === 'npm');
    const pypiDeps = dependencies.filter(dep => dep.ecosystem === 'pypi');

    const allReports: any[] = [];

    // Check npm vulnerabilities
    if (npmDeps.length > 0) {
      const npmVulnerabilityResults = await checkVulnerabilities(npmDeps);
      const jsonReport = await OutputWriter.getReportJSON(npmVulnerabilityResults, getAdvisory);
      allReports.push({ ecosystem: 'npm', ...jsonReport });
    }

    // Check PyPI vulnerabilities
    if (pypiDeps.length > 0) {
      const pypiVulnerabilityResults = await checkVulnerabilities(pypiDeps);
      const jsonReport = await OutputWriter.getReportJSON(pypiVulnerabilityResults, getAdvisory);
      allReports.push({ ecosystem: 'pypi', ...jsonReport });
    }

    // Return combined report
    res.json({
      success: true,
      totalDependencies: dependencies.length,
      reports: allReports
    });

  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      error: 'Failed to scan dependencies',
      message: (error as Error).message
    });
  }
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(resolve(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
