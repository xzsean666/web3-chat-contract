import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const contracts = [
  "UserImplementation",
  "GroupImplementation",
  "ChatStorageFactory",
  "RelationshipManager",
  "Multicall3",
];

const root = process.cwd();

for (const name of contracts) {
  const artifactPath = resolve(root, `artifacts/contracts/${name}.sol/${name}.json`);
  if (!existsSync(artifactPath)) {
    continue;
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const outDir = resolve(root, `out/${name}.sol`);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const outPath = resolve(outDir, `${name}.json`);
  const outData = {
    abi: artifact.abi,
    bytecode: {
      object: artifact.bytecode,
    },
  };
  writeFileSync(outPath, JSON.stringify(outData, null, 2), "utf8");
}
