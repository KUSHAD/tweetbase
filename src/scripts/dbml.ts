import { pgGenerate } from 'drizzle-dbml-generator'; // Using Postgres for this example
import * as schema from '../db/schema';

const out = './src/db/schema.dbml';
const relational = true;

pgGenerate({ schema, out, relational });
