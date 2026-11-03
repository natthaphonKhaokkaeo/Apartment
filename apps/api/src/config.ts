import dotenv from "dotenv";
dotenv.config({path:new URL("../../../.env",import.meta.url)});
import {z} from "zod";
const schema = z.object({
 NODE_ENV: z.enum(["development","test","production"]).default("development"),
 DATABASE_URL: z.string().min(1),
 HOST: z.string().default("0.0.0.0"),
 PORT: z.coerce.number().int().min(1).max(65535).default(8088),
 LINE_CHANNEL_ID: z.string().min(1),
 COOKIE_SECURE: z.enum(["true","false"]).default("true"),
 WEB_ORIGIN: z.string().url(),
 SUPER_ADMIN_LINE_USER_ID: z.string().optional()
});
export const config = schema.parse(process.env);
if(config.NODE_ENV === "production" && config.COOKIE_SECURE !== "true") throw new Error("COOKIE_SECURE is required in production");
