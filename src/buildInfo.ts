export type AppBuild = {
  version: string;
  commit: string | null;
  committedAt: string | null;
  builtAt: string;
  buildId: string;
  dirty: boolean;
};
export type DeploymentInfo = AppBuild & { deployedAt: string; environment: "production" };
export const APP_BUILD: AppBuild = __APP_BUILD__;

export function parseDeployment(value: unknown): DeploymentInfo {
  if (!value || typeof value !== "object") throw new Error("Invalid deployment record");
  const data = value as Record<string, unknown>;
  if (typeof data.version !== "string" || !/^\d+\.\d+\.\d+$/.test(data.version)
    || typeof data.buildId !== "string" || !data.buildId || data.buildId.length > 128
    || typeof data.builtAt !== "string" || !Number.isFinite(Date.parse(data.builtAt))
    || typeof data.deployedAt !== "string" || !Number.isFinite(Date.parse(data.deployedAt))
    || typeof data.dirty !== "boolean" || data.environment !== "production"
    || !(data.commit === null || typeof data.commit === "string" && /^[a-f0-9]{40,64}$/.test(data.commit))
    || !(data.committedAt === null || typeof data.committedAt === "string" && Number.isFinite(Date.parse(data.committedAt)))) {
    throw new Error("Invalid deployment record");
  }
  return data as DeploymentInfo;
}
