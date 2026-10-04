import dotenv from "dotenv";
dotenv.config();
export const config = {
    appPassword: process.env.APP_PASSWORD ?? "",
    dataDir: process.env.DATA_DIR ?? "data",
    headless: (process.env.HEADLESS ?? "true").toLowerCase() !== "false",
    port: Number(process.env.PORT ?? 8000),
    sessionSecret: process.env.SESSION_SECRET ?? "dev-session-secret-change-me",
    targetUrl: process.env.TARGET_URL ??
        "https://www.asigurari.ro/app/broker/cotatie/rca/vehicle"
};
export function assertConfig() {
    if (!config.appPassword) {
        throw new Error("APP_PASSWORD is required");
    }
    if (config.sessionSecret === "dev-session-secret-change-me") {
        console.warn("SESSION_SECRET is using the development default.");
    }
}
