import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS_DIR = join(__dirname, "../../../contracts/deployments");

interface DeploymentJson {
  chainId: number;
  accountFactory: string;
  smartAccountImpl: string;
  passkeyValidator: string;
  socialRecovery: string;
  emailRecovery?: string;
  entryPoint: string;
  proxyFactory: string;
  [key: string]: unknown;
}

function loadDeployment(profile: string): DeploymentJson {
  const path = join(DEPLOYMENTS_DIR, `${profile}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as DeploymentJson;
}

export const ANVIL_LOCAL = loadDeployment("31337");
export const BASE_FORK = loadDeployment("base-mainnet-fork");

export const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const;
