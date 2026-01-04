import { useState } from 'react';
import './App.css';

interface Vulnerability {
  ghsaId: string;
  cveId?: string;
  summary: string;
  description?: string;
  severity?: string;
  cvssScore?: number;
  epss?: {
    probability: number;
    percentile: number;
  };
  published?: string;
  updated?: string;
  htmlUrl?: string;
}

interface PackageVulnerability {
  package: string;
  version: string;
  vulnerabilities: Vulnerability[];
}

interface Report {
  ecosystem: string;
  summary: {
    totalPackages: number;
    vulnerablePackages: number;
    totalVulnerabilities: number;
  };
  vulnerabilities: PackageVulnerability[];
}

interface ScanResponse {
  success: boolean;
  totalDependencies: number;
  reports: Report[];
  error?: string;
  message?: string;
}

function App() {
  const [path, setPath] = useState('./fixtures');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      });

      const data: ScanResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to scan dependencies');
      }

      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (cvssScore?: number) => {
    if (!cvssScore) return '';
    if (cvssScore >= 7.5) return '🔴';
    if (cvssScore >= 3.5) return '🟡';
    return '🟢';
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Philcom Vulnerability Scanner</h1>
        <p>Scan dependencies for security vulnerabilities</p>
      </header>

      <main className="App-main">
        <div className="scan-form">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="Enter path to scan (e.g., ./fixtures)"
            className="path-input"
          />
          <button
            onClick={handleScan}
            disabled={loading || !path}
            className="scan-button"
          >
            {loading ? 'Scanning...' : 'Scan Dependencies'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="results">
            <div className="summary">
              <h2>Scan Results</h2>
              <p>Total Dependencies: {result.totalDependencies}</p>
            </div>

            {result.reports.map((report, idx) => (
              <div key={idx} className="report">
                <h3>{report.ecosystem.toUpperCase()} Dependencies</h3>
                <div className="report-summary">
                  <span>Total Packages: {report.summary.totalPackages}</span>
                  <span>Vulnerable: {report.summary.vulnerablePackages}</span>
                  <span>Total Vulnerabilities: {report.summary.totalVulnerabilities}</span>
                </div>

                {report.vulnerabilities.length > 0 ? (
                  <div className="vulnerabilities">
                    {report.vulnerabilities.map((pkgVuln, pkgIdx) => (
                      <div key={pkgIdx} className="package-vulnerability">
                        <h4>
                          {pkgVuln.package}@{pkgVuln.version}
                        </h4>
                        {pkgVuln.vulnerabilities.map((vuln, vulnIdx) => (
                          <div key={vulnIdx} className="vulnerability-detail">
                            <div className="vuln-header">
                              <strong>{vuln.ghsaId}</strong>
                              {vuln.cveId && <span className="cve-id">{vuln.cveId}</span>}
                              {vuln.cvssScore && (
                                <span className="cvss-score">
                                  CVSS: {vuln.cvssScore} {getSeverityColor(vuln.cvssScore)}
                                </span>
                              )}
                              {vuln.severity && (
                                <span className={`severity severity-${vuln.severity.toLowerCase()}`}>
                                  {vuln.severity}
                                </span>
                              )}
                            </div>
                            <p className="vuln-summary">{vuln.summary}</p>
                            {vuln.epss && (
                              <div className="epss-info">
                                <small>
                                  EPSS: {(vuln.epss.probability * 100).toFixed(2)}% exploitation probability
                                  (Percentile: {(vuln.epss.percentile * 100).toFixed(2)}%)
                                </small>
                              </div>
                            )}
                            {vuln.htmlUrl && (
                              <a
                                href={vuln.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="advisory-link"
                              >
                                View Advisory →
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-vulnerabilities">
                    <p>✅ No vulnerabilities found!</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
