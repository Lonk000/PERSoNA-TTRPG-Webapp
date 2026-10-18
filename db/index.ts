import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema.js";

// Netlify Database injects its connection details into the function runtime,
// so no connection string is read, stored, or logged by this code.
export const db = drizzle({ schema });
