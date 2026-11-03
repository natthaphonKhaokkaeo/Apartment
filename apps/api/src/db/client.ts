import postgres from "postgres";
import {drizzle} from "drizzle-orm/postgres-js";
import {config} from "../config.js";
import * as schema from "./schema.js";
export const sqlClient = postgres(config.DATABASE_URL, {max:10});
export const db = drizzle(sqlClient, {schema});
