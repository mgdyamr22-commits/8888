const fs = require('fs');
const path = require('path');

// 1. Delete release and dist output folders to guarantee a completely clean build
const directoriesToClean = [
  path.join(__dirname, 'release'),
  path.join(__dirname, 'dist')
];

directoriesToClean.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`🧹 Deleting old build files at: ${dir}`);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✅ Successfully cleaned: ${dir}`);
    } catch (err) {
      console.error(`⚠️ Failed to delete directory ${dir}:`, err.message);
    }
  }
});

// 2. Automatically increment the package.json version number with every build
const packageJsonPath = path.join(__dirname, 'package.json');
try {
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const oldVersion = pkg.version || '3.5.1';
    const parts = oldVersion.split('.').map(Number);
    
    if (parts.length === 3 && !isNaN(parts[2])) {
      parts[2] += 1; // Increment patch version level
      const newVersion = parts.join('.');
      pkg.version = newVersion;
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf8');
      console.log(`📈 Version updated from v${oldVersion} to v${newVersion} in package.json!`);
    } else {
      console.warn('⚠️ Could not parse current version path level.');
    }
  }
} catch (error) {
  console.error('❌ Failed to increment package version:', error);
}
