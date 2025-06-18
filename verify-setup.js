#!/usr/bin/env node

/**
 * Vercel Deployment Verification Script
 * Run with: node verify-setup.js
 */

const fs = require("fs");
const path = require("path");

console.log("🔍 Verifying Vercel Deployment Setup...\n");

// Check if required files exist
const requiredFiles = [
  "package.json",
  "next.config.ts",
  "vercel.json",
  ".env.example",
  ".gitignore",
];

console.log("📁 Checking required files:");
requiredFiles.forEach((file) => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`   ${exists ? "✅" : "❌"} ${file}`);
});

// Check package.json scripts
console.log("\n📦 Checking package.json scripts:");
try {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const requiredScripts = ["build", "start", "dev"];

  requiredScripts.forEach((script) => {
    const exists = packageJson.scripts && packageJson.scripts[script];
    console.log(
      `   ${exists ? "✅" : "❌"} ${script}: ${
        exists ? packageJson.scripts[script] : "missing"
      }`
    );
  });
} catch (error) {
  console.log("   ❌ Error reading package.json");
}

// Check .env.example for required variables
console.log("\n🔐 Checking .env.example for required variables:");
try {
  const envExample = fs.readFileSync(".env.example", "utf8");
  const requiredVars = [
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "API_BASE_URL",
    "GROUP_API_BASE_URL",
    "NOTIFICATION_API_BASE_URL",
    "FILES_API_BASE_URL",
    "PRESENCE_API_BASE_URL",
  ];

  requiredVars.forEach((variable) => {
    const exists = envExample.includes(variable);
    console.log(`   ${exists ? "✅" : "❌"} ${variable}`);
  });
} catch (error) {
  console.log("   ❌ Error reading .env.example");
}

// Check .gitignore
console.log("\n🙈 Checking .gitignore:");
try {
  const gitignore = fs.readFileSync(".gitignore", "utf8");
  const shouldIgnore = [".env*", "node_modules", ".next"];

  shouldIgnore.forEach((pattern) => {
    const ignored =
      gitignore.includes(pattern) ||
      gitignore.includes(pattern.replace("*", ""));
    console.log(`   ${ignored ? "✅" : "❌"} ${pattern}`);
  });
} catch (error) {
  console.log("   ❌ Error reading .gitignore");
}

console.log("\n📋 Next Steps:");
console.log("1. Commit and push your changes to GitHub");
console.log("2. Go to https://vercel.com and import your repository");
console.log("3. Set environment variables in Vercel dashboard:");
console.log("   - NEXTAUTH_SECRET: Generate with `node generate-secret.js`");
console.log("   - NEXTAUTH_URL: https://your-app-name.vercel.app");
console.log("   - All API_BASE_URL variables with your backend URLs");
console.log("4. Deploy and test!");

console.log("\n⚠️  Remember:");
console.log("- Use direct values in Vercel, not secret references");
console.log("- Update NEXTAUTH_URL after getting your Vercel domain");
console.log("- Ensure backend APIs have CORS configured for your domain");
