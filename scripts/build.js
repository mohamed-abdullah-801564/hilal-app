const { spawn } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function setupSignalHandlers() {
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}

async function main() {
  console.log("Building Expo web app...");
  setupSignalHandlers();

  await new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["exec", "expo", "export", "--platform", "web", "--output-dir", "dist"],
      {
        stdio: "inherit",
        cwd: projectRoot,
        env: { ...process.env },
      }
    );

    child.on("close", (code) => {
      if (code === 0) {
        console.log("Web build complete! dist/ folder ready.");
        resolve();
      } else {
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

main().catch((err) => {
  console.error("Build error:", err.message);
  process.exit(1);
});
