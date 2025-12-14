import { Devvit, JobContext } from '@devvit/public-api';
import { StorageManager, LogEntry } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';

// 13 days in seconds (13 * 24 * 60 * 60)
const PRUNE_AGE_SECONDS = 13 * 86400;

export async function checkForOldMessages(event: any, context: JobContext): Promise<void> {
    console.log('[JOB] Starting scheduled old message cleanup...');

    try {
        const expiredDiscordIds = await StorageManager.getExpiredLogKeys(PRUNE_AGE_SECONDS, context);

        if (expiredDiscordIds.length === 0) {
            console.log('[JOB] No expired entries found. Cleanup complete.');
            return;
        }

        console.log(`[JOB] Found ${expiredDiscordIds.length} expired messages to process.`);

        let successfulDeletions = 0;

        for (const discordId of expiredDiscordIds) {
            const entry = await StorageManager.getLogEntry(discordId, context);

            if (!entry) {
                console.warn(`[JOB] Expired ID ${discordId} found in index but missing log entry. Skipping.`);
                continue;
            }

            try {
                if (entry.webhookUrl) {
                    await WebhookManager.deleteMessage(entry.webhookUrl, entry.discordMessageId, context);
                    console.log(`[JOB] Successfully deleted Discord message ID ${entry.discordMessageId}.`);
                } else {
                    console.warn(`[JOB] No webhook URL for message ${entry.discordMessageId}. Skipping Discord deletion.`);
                }

                await StorageManager.deleteLogEntry(entry as LogEntry, context as any);
                successfulDeletions++;

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.warn(`[JOB] Failed to process cleanup for ${entry.discordMessageId}: ${errorMessage}`);

                if (errorMessage.includes('404')) {
                    console.log(`[JOB] Message was already gone from Discord. Cleaning up DB entry.`);
                    await StorageManager.deleteLogEntry(entry as LogEntry, context as any);
                }
            }
        }

        console.log(`[JOB] Prune complete. Processed ${successfulDeletions} items.`);

    } catch (error) {
        console.error(`[JOB] CRITICAL ERROR during cleanup job:`, error);
    }
}