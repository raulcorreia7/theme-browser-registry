import packageJson from "../../package.json";

type PackageJson = {
  version?: string;
};

const pkg = packageJson as PackageJson;

export const REGISTRY_VERSION = pkg.version ?? "0.0.0";
