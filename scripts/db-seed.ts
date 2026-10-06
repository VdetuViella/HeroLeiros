/**
 * Datos de demo: una directora, su grupo con integrantes y tres semanas de partidas.
 * Borra y recrea cada vez a los usuarios `@heroleiros.demo`; el resto no se toca.
 *   npm run db:seed
 */
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { attemptKey } from "../src/lib/attempts/sync";
import { loadAllSongs } from "../src/lib/songs/load";
import { attemptResultSchema, toAttemptRow } from "../src/server/attempts/validate";
import { createAuth } from "../src/server/auth";
import * as schema from "../src/server/db/schema";
import type { Db } from "../src/server/db/types";
import { createGroup } from "../src/server/groups/service";
import { simulateHistory, type DemoPlayer } from "../src/server/seed/demo-attempts";

const DEMO_PASSWORD = "batucada123";
const DEMO_INVITE = "ensayo2026";
const DOMAIN = "heroleiros.demo";

const DIRECTOR = { name: "Marta Lourido", email: `directora@${DOMAIN}` };

const MEMBERS: (DemoPlayer & { name: string; email: string })[] = [
  { name: "Ana Souto", email: `ana@${DOMAIN}`, skill: 0.72, growth: 0.18, instruments: ["caixa", "tamborim"] },
  { name: "Bruno Iglesias", email: `bruno@${DOMAIN}`, skill: 0.78, growth: 0.1, instruments: ["surdo1", "surdo2"] },
  { name: "Carla Varela", email: `carla@${DOMAIN}`, skill: 0.6, growth: 0.25, instruments: ["repinique", "caixa"] },
  { name: "Diego Rial", email: `diego@${DOMAIN}`, skill: 0.55, growth: 0.2, instruments: ["tamborim"] },
  { name: "Elena Castro", email: `elena@${DOMAIN}`, skill: 0.82, growth: 0.08, instruments: ["agogo", "chocalho"] },
  { name: "Fran Méndez", email: `fran@${DOMAIN}`, skill: 0.66, growth: 0.15, instruments: ["chocalho"] },
  { name: "Gael Pazos", email: `gael@${DOMAIN}`, skill: 0.62, growth: 0.22, instruments: ["surdo2", "surdo3"] },
];
/** Recién llegado: aparece en el panel sin partidas. */
const NEWCOMER = { name: "Hugo Seoane", email: `hugo@${DOMAIN}` };

async function signUp(auth: ReturnType<typeof createAuth>, name: string, email: string) {
  const { user } = await auth.api.signUpEmail({ body: { name, email, password: DEMO_PASSWORD } });
  return user;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL (copia .env.example a .env.local).");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema }) as unknown as Db;
  const auth = createAuth(db);

  try {
    const removed = await db
      .delete(schema.users)
      .where(like(schema.users.email, `%@${DOMAIN}`))
      .returning({ id: schema.users.id });
    if (removed.length) console.log(`Borrados ${removed.length} usuarios de demo anteriores.`);

    const director = await signUp(auth, DIRECTOR.name, DIRECTOR.email);
    const group = await createGroup(db, { ...director, role: "miembro" }, "Bloco Leiros");
    await db.update(schema.groups).set({ inviteCode: DEMO_INVITE }).where(eq(schema.groups.id, group.id));

    const charts = (await loadAllSongs()).map((s) => s.chart);
    if (charts.length === 0) throw new Error("No hay canciones en content/songs.");
    const now = new Date();
    let total = 0;

    for (const [i, member] of MEMBERS.entries()) {
      const user = await signUp(auth, member.name, member.email);
      await db.insert(schema.memberships).values({
        groupId: group.id,
        userId: user.id,
        joinedAt: new Date(now.getTime() - 25 * 86_400_000),
      });
      const history = simulateHistory(charts, member, { days: 21, now, seed: 1000 + i });
      const rows = history.map((result) => {
        attemptResultSchema.parse(result);
        return toAttemptRow(user.id, attemptKey(result), result);
      });
      if (rows.length) await db.insert(schema.attempts).values(rows).onConflictDoNothing();
      total += rows.length;
      console.log(`  ${member.name.padEnd(16)} ${String(rows.length).padStart(3)} partidas (${member.instruments[0]})`);
    }

    const newcomer = await signUp(auth, NEWCOMER.name, NEWCOMER.email);
    await db.insert(schema.memberships).values({ groupId: group.id, userId: newcomer.id });

    console.log(`\nGrupo «${group.name}»: ${MEMBERS.length + 1} integrantes, ${total} partidas.`);
    console.log(`Directora: ${DIRECTOR.email} / ${DEMO_PASSWORD}`);
    console.log(`Miembros:  ana@${DOMAIN}, bruno@${DOMAIN}, … / ${DEMO_PASSWORD}`);
    console.log(`Invitación: /unirse/${DEMO_INVITE}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
