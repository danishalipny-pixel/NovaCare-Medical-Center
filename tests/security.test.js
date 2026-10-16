/**
 * NovaCare Hospital Management System - Security & Repository Integrity Tests
 * Verifies that no production frontend code hardcodes localhost or leaks credentials,
 * and ensures .gitignore and .env.example conform to security standards.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('🔒 Security, Repository Integrity & Production Config Tests', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('Frontend JavaScript files MUST NOT contain hardcoded localhost or 127.0.0.1', () => {
    const jsFiles = ['config.js', 'api.js', 'app.js'];
    const forbiddenPatterns = [
      /http:\/\/localhost/i,
      /http:\/\/127\.0\.0\.1/i,
      /https:\/\/localhost/i,
      /https:\/\/127\.0\.0\.1/i
    ];

    for (const file of jsFiles) {
      const filePath = path.join(rootDir, 'public', 'js', file);
      assert.ok(fs.existsSync(filePath), `File ${file} must exist`);
      const content = fs.readFileSync(filePath, 'utf8');

      // Strip out comments explaining what not to use
      const codeLines = content
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n');

      for (const pattern of forbiddenPatterns) {
        assert.equal(
          pattern.test(codeLines),
          false,
          `Security violation: ${file} contains hardcoded localhost reference (${pattern})`
        );
      }
    }
  });

  it('Frontend HTML file MUST NOT contain hardcoded localhost or 127.0.0.1', () => {
    const htmlPath = path.join(rootDir, 'public', 'index.html');
    assert.ok(fs.existsSync(htmlPath));
    const content = fs.readFileSync(htmlPath, 'utf8');

    assert.equal(/http:\/\/localhost/i.test(content), false);
    assert.equal(/http:\/\/127\.0\.0\.1/i.test(content), false);
  });

  it('.gitignore MUST exist and strictly exclude node_modules, .env, and local database files', () => {
    const gitignorePath = path.join(rootDir, '.gitignore');
    assert.ok(fs.existsSync(gitignorePath), '.gitignore file must exist');
    const content = fs.readFileSync(gitignorePath, 'utf8');

    assert.match(content, /node_modules/i, '.gitignore must exclude node_modules');
    assert.match(content, /\.env/i, '.gitignore must exclude .env secrets');
    assert.match(content, /\*.sqlite|\*.db/i, '.gitignore must exclude local database files');
    assert.match(content, /logs\//i, '.gitignore must exclude logs');
  });

  it('.env.example MUST exist and contain ONLY safe placeholders with NO real passwords or private keys', () => {
    const envExamplePath = path.join(rootDir, '.env.example');
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
    const content = fs.readFileSync(envExamplePath, 'utf8');

    // Must have standard config keys
    assert.match(content, /JWT_SECRET=/);
    assert.match(content, /DB_HOST=/);
    assert.match(content, /DB_USER=/);
    assert.match(content, /DB_PASSWORD=/);
    assert.match(content, /DB_NAME=/);
    assert.match(content, /CORS_ORIGIN=/);

    // Must NOT contain real sensitive strings
    assert.match(content, /placeholder/i, '.env.example should use placeholder values');
    assert.doesNotMatch(content, /AKIA[0-9A-Z]{16}/, 'No AWS access keys');
    assert.doesNotMatch(content, /-----BEGIN RSA PRIVATE KEY-----/, 'No private keys');
  });
});
