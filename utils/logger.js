import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, "..", "logs");

// Ensure logs directory exists
try {
  await fs.mkdir(logsDir, { recursive: true });
} catch (error) {
  console.error("Failed to create logs directory:", error);
}

const logLevels = {
  ERROR: "ERROR",
  WARN: "WARN",
  INFO: "INFO",
  DEBUG: "DEBUG"
};

const getCurrentTimestamp = () => new Date().toISOString();

const formatLog = (level, message, data = null) => {
  const timestamp = getCurrentTimestamp();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : "";
  return `[${timestamp}] [${level}] ${message}${dataStr}`;
};

export const logger = {
  error: (message, data = null) => {
    const log = formatLog(logLevels.ERROR, message, data);
    console.error(log);
    return log;
  },

  warn: (message, data = null) => {
    const log = formatLog(logLevels.WARN, message, data);
    console.warn(log);
    return log;
  },

  info: (message, data = null) => {
    const log = formatLog(logLevels.INFO, message, data);
    console.log(log);
    return log;
  },

  debug: (message, data = null) => {
    if (process.env.LOG_LEVEL === "debug") {
      const log = formatLog(logLevels.DEBUG, message, data);
      console.debug(log);
      return log;
    }
  }
};

export default logger;
