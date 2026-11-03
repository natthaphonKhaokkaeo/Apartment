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
 SUPER_ADMIN_LINE_USER_ID: z.string().optional(),
 PAYMENT_EVIDENCE_DIR: z.string().optional(),
 EVIDENCE_STORAGE_DRIVER: z.enum(["local","s3"]).default("local"),
 EVIDENCE_S3_BUCKET: z.string().optional(),
 EVIDENCE_S3_REGION: z.string().optional(),
 EVIDENCE_S3_ENDPOINT: z.preprocess(v=>v===""?undefined:v,z.url().optional()),
 EVIDENCE_S3_ACCESS_KEY_ID: z.string().optional(),
 EVIDENCE_S3_SECRET_ACCESS_KEY: z.string().optional(),
 EVIDENCE_S3_FORCE_PATH_STYLE: z.enum(["true","false"]).default("false")
});
export const config = schema.parse(process.env);
if(config.EVIDENCE_STORAGE_DRIVER==="s3" && (
 !config.EVIDENCE_S3_BUCKET || !config.EVIDENCE_S3_REGION ||
 !config.EVIDENCE_S3_ACCESS_KEY_ID || !config.EVIDENCE_S3_SECRET_ACCESS_KEY
 )) throw new Error("EVIDENCE_S3_CONFIG_INCOMPLETE");
if(config.EVIDENCE_S3_ENDPOINT && config.EVIDENCE_S3_ENDPOINT.startsWith("http://")){
 const u=new URL(config.EVIDENCE_S3_ENDPOINT);
 if(config.NODE_ENV!=="development" || !["localhost","127.0.0.1"].includes(u.hostname))
  throw new Error("EVIDENCE_S3_ENDPOINT_MUST_USE_TLS");
}
if(config.NODE_ENV === "production" && config.COOKIE_SECURE !== "true") throw new Error("COOKIE_SECURE is required in production");

if(config.NODE_ENV === "production") throw new Error("PAYMENT_EVIDENCE_STORAGE_NOT_PRODUCTION_READY: configure private object storage and security review before production");
