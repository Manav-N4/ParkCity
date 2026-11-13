
import * as SQLite from 'expo-sqlite';

export const SATISFACTION_REMINDER_DELAY_SECONDS = 1200;

const getDatabase = async () => {
  const db = await SQLite.openDatabaseAsync('parkcity-feedback.db');

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS feedback_requests (
      session_id TEXT PRIMARY KEY NOT NULL,
      reminder_due_at INTEGER NOT NULL,
      dismissed INTEGER NOT NULL DEFAULT 0
    );
  `);

  return db;
};

export async function savePendingFeedbackRequest(
  sessionId: string,
  reminderDueAt: number,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR IGNORE INTO feedback_requests
      (session_id, reminder_due_at, dismissed)
     VALUES (?, ?, 0)`,
    sessionId,
    reminderDueAt,
  );
}

export async function getPendingFeedbackRequests(): Promise<
  { session_id: string; reminder_due_at: number }[]
> {
  const db = await getDatabase();

  const requests = await db.getAllAsync<{
    session_id: string;
    reminder_due_at: number;
  }>(
    `SELECT session_id, reminder_due_at
     FROM feedback_requests
     WHERE dismissed = 0`,
  );

  return requests;
}

export async function dismissFeedbackRequest(
  sessionId: string,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE feedback_requests
     SET dismissed = 1
     WHERE session_id = ?`,
    sessionId,
  );
}

export async function clearFeedbackRequest(
  sessionId: string,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    'DELETE FROM feedback_requests WHERE session_id = ?',
    sessionId,
  );
}
