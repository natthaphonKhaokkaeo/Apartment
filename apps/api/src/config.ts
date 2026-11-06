import dotenv from "dotenv";
dotenv.config({path:new URL("../../../.env",import.meta.url)});
import {z} from "zod";
const schema = z.object({
 NODE_ENV: z.enum(["development","test","production"]).default("development"),
 DATABASE_URL: z.string().min(1),
 HOST: z.string().default("0.0.0.0"),
 PORT: z.coerce.number().int().min(1).max(65535).default(8088),
 LINE_CHANNEL_ID: z.string().min(1),
 VITE_LIFF_ID: z.string().optional(),
 COOKIE_SECURE: z.enum(["true","false"]).default("true"),
 WEB_ORIGIN: z.string().url(),
 SUPER_ADMIN_LINE_USER_ID: z.string().optional(),
 PRIVACY_PROFILE_ANONYMIZATION_APPROVED:z.enum(["true","false"]).default("false"),
 PRIVACY_PROFILE_RETENTION_DAYS:z.preprocess(v=>v===""?undefined:v,z.coerce.number().int().min(1).max(36500).optional()),
 PRIVACY_POLICY_EVIDENCE_REF:z.preprocess(v=>v===""?undefined:v,z.string().trim().min(12).max(200).optional()),
 PAYMENT_EVIDENCE_DIR: z.string().optional(),
 EVIDENCE_STORAGE_DRIVER: z.enum(["local","s3"]).default("local"),
 EVIDENCE_S3_BUCKET: z.string().optional(),
 EVIDENCE_S3_REGION: z.string().optional(),
 EVIDENCE_S3_ENDPOINT: z.preprocess(v=>v===""?undefined:v,z.url().optional()),
 EVIDENCE_S3_ACCESS_KEY_ID: z.string().optional(),
 EVIDENCE_S3_SECRET_ACCESS_KEY: z.string().optional(),
 EVIDENCE_S3_FORCE_PATH_STYLE: z.enum(["true","false"]).default("false"),
 EVIDENCE_MALWARE_SCANNER: z.enum(["disabled","clamav"]).default("disabled"),
 CLAMAV_HOST: z.string().min(1).default("127.0.0.1"),
 CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
 CLAMAV_TIMEOUT_MS: z.coerce.number().int().min(50).max(30000).default(5000),
 LINE_MESSAGING_CHANNEL_SECRET: z.string().regex(/^[0-9a-f]{32}$/i,"LINE_CHANNEL_SECRET_INVALID_FORMAT").optional(),
 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: z.string().optional(),
 LINE_OA_BOT_USER_ID: z.preprocess(v=>v===""?undefined:v,
  z.string().regex(/^U[0-9a-f]{32}$/i).optional()),
 LINE_OUTBOUND_MODE: z.enum(["disabled","simulate","live"]).default("disabled"),
 LINE_CHATBOT_MODE: z.enum(["disabled","simulate","live"]).default("disabled"),
 LINE_CHATBOT_LIVE_APPROVED: z.enum(["true","false"]).default("false").transform(value=>value==="true"),
 LINE_HELP_AI_PROVIDER: z.enum(["google","openrouter"]).default("google"),
 LINE_HELP_AI_API_KEY: z.string().optional(),
 LINE_HELP_AI_MODEL: z.string().default("gemini-3.8-flash"),
 LINE_GLOBAL_PER_MINUTE: z.coerce.number().int().min(1).max(60).default(20),
 LINE_ORG_PER_MINUTE: z.coerce.number().int().min(1).max(60).default(5)
});
export const config = schema.parse(process.env);
if(config.LINE_ORG_PER_MINUTE>config.LINE_GLOBAL_PER_MINUTE)
 throw new Error("LINE_ORG_QUOTA_EXCEEDS_GLOBAL");
if(config.LINE_OUTBOUND_MODE==="live" && (
 !config.LINE_MESSAGING_CHANNEL_SECRET ||
 !config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ||
 !config.LINE_OA_BOT_USER_ID
)) throw new Error("LINE_OA_LIVE_CREDENTIALS_REQUIRED");
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

if(config.PRIVACY_PROFILE_ANONYMIZATION_APPROVED==="true"&&(
 !config.PRIVACY_PROFILE_RETENTION_DAYS||!config.PRIVACY_POLICY_EVIDENCE_REF
))throw Error("PRIVACY_APPROVED_POLICY_CONFIGURATION_REQUIRED");
