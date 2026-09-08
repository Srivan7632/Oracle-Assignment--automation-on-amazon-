const { spawnSync } = require('child_process');

// Capture positional arguments passed after `npm start --`
const rawArgs = process.argv.slice(2);

const brands = [];
const extraFlags = [];

for (const arg of rawArgs) {
  if (arg.startsWith('-')) {
    extraFlags.push(arg);
  } else {
    brands.push(arg);
  }
}

if (brands.length > 0) {
  process.env.BRANDS = brands.join(',');
}

console.log(`Starting test runner...`);
if (brands.length > 0) {
  console.log(`Brand arguments passed: ${brands.map(b => `"${b}"`).join(' ')}`);
} else {
  console.log(`No brand arguments passed. Defaulting to preferred brands: Samsung, Sony`);
}

const child = spawnSync('npx', ['playwright', 'test', ...extraFlags], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(child.status ?? 0);
