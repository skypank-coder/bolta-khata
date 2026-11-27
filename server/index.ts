import { createServer } from 'node:http';
import { join } from 'node:path';
import { createHandler, sweepGuests } from './app.ts';
import { openDb } from './db.ts';

/** One process serves the app and the API. Nothing to configure: every setting has a default. */
const argPort = process.argv.indexOf('--port');
const PORT = Number(process.env.PORT ?? (argPort > 0 ? process.argv[argPort + 1] : 3000));
const DATA_DIR = process.env.DATA_DIR ?? 'data';
const DIST_DIR = process.env.DIST_DIR ?? 'dist';

const db = openDb(join(DATA_DIR, 'bolta-khata.db'));
sweepGuests(db);
setInterval(() => sweepGuests(db), 60 * 60 * 1000).unref();
createServer(createHandler(db, DIST_DIR)).listen(PORT, () => {
  console.log(`Bolta Khata on http://localhost:${PORT}  (data: ${DATA_DIR}, app: ${DIST_DIR})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    db.close();
    process.exit(0);
  });
}
