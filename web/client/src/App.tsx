import { useState } from 'react';
import './App.css';

interface Vulnerability {
  ghsa_id: string;
  cve_id?: string;
  summary?: string;
  description?: string;
  severity?: string;
  cvss?: {
    score?: number;
    vector_string?: string;
  };
  epss?: {
    percentage?: number;
    percentile?: number;
    exploitChance?: string;
    riskierThan?: string;
    lessRiskyThan?: string;
  };
  published_at?: string;
  updated_at?: string;
  html_url?: string;
  url?: string;
}

interface PackageInfo {
  name: string;
  version: string;
  purl: string;
}

interface TyposquattingInfo {
  isTyposquatting: boolean;
  suspectedTarget?: string;
  distance?: number;
  confidence?: 'high' | 'medium' | 'low';
}

interface PackageVulnerability {
  package: PackageInfo;
  typosquatting?: TyposquattingInfo;
  advisories: Vulnerability[];
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

  const getConfidenceColor = (confidence?: string) => {
    if (confidence === 'high') return '🔴';
    if (confidence === 'medium') return '🟡';
    return '🟢';
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Philcom Vulnerability Scanner</h1>
        <p>Scan dependencies for security vulnerabilities and typosquatting</p>
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
                          {pkgVuln.package.name}@{pkgVuln.package.version}
                        </h4>

                        {pkgVuln.typosquatting && pkgVuln.typosquatting.isTyposquatting && (
                          <div className="typosquatting-warning">
                            <strong>⚠️ TYPOSQUATTING WARNING {getConfidenceColor(pkgVuln.typosquatting.confidence)}</strong>
                            <p>
                              Possible typosquatting of "<strong>{pkgVuln.typosquatting.suspectedTarget}</strong>"
                            </p>
                            <small>
                              Confidence: {pkgVuln.typosquatting.confidence} |
                              Edit distance: {pkgVuln.typosquatting.distance}
                            </small>
                          </div>
                        )}

                        {pkgVuln.advisories.map((vuln, vulnIdx) => (
                          <div key={vulnIdx} className="vulnerability-detail">
                            <div className="vuln-header">
                              <strong>{vuln.ghsa_id}</strong>
                              {vuln.cve_id && <span className="cve-id">{vuln.cve_id}</span>}
                              {vuln.cvss?.score && (
                                <span className="cvss-score">
                                  CVSS: {vuln.cvss.score} {getSeverityColor(vuln.cvss.score)}
                                </span>
                              )}
                              {vuln.severity && (
                                <span className={`severity severity-${vuln.severity.toLowerCase()}`}>
                                  {vuln.severity}
                                </span>
                              )}
                            </div>
                            <p className="vuln-summary">{vuln.summary}</p>
                            {vuln.epss && vuln.epss.exploitChance && (
                              <div className="epss-info">
                                <small>
                                  EPSS: {vuln.epss.exploitChance} exploitation probability
                                  {vuln.epss.riskierThan && ` (${vuln.epss.riskierThan})`}
                                </small>
                              </div>
                            )}
                            {vuln.html_url && (
                              <a
                                href={vuln.html_url}
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
