import pino from "pino"

export const logger = pino(
  process.env.NODE_ENV === "production"
    ? {
        level: process.env.LOG_LEVEL || "info",
      }
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
        level: process.env.LOG_LEVEL || "debug",
      }
)
