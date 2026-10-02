const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const originalPkg = fs.readFileSync(pkgPath, 'utf8');

try {
  const pkg = JSON.parse(originalPkg);
  const owner = process.env.GITHUB_REPOSITORY_OWNER || 'tarunagnihotri534';
  pkg.name = `@${owner.toLowerCase()}/cogito`;
  pkg.publishConfig = {
    registry: 'https://npm.pkg.github.com'
  };

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`📦 Configured scoped package name: ${pkg.name}@${pkg.version}`);
  console.log(`🚀 Publishing to GitHub Packages registry (https://npm.pkg.github.com)...`);

  execSync('npm publish --registry=https://npm.pkg.github.com', {
    stdio: 'inherit',
    env: process.env
  });

  console.log(`✅ Successfully published ${pkg.name}@${pkg.version} to GitHub Packages!`);
} catch (error) {
  console.error(`❌ Publish failed:`, error.message);
  process.exit(1);
} finally {
  fs.writeFileSync(pkgPath, originalPkg);
  console.log(`🔄 Restored root package.json name to unscoped.`);
}
