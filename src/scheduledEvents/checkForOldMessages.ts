import { Devvit, JobContext } from '@devvit/public-api';
import { StorageManager, LogEntry } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { PRUNE_AGE_SECONDS } from '../config/constants.js';
import { UtilityManager } from '../helpers/utilityHelper.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function checkForOldMessages(event: any, context: JobContext): Promise<void> {
    UtilityManager.log('[JOB] Starting scheduled old message cleanup...');

    try {
        const expiredDiscordIds = await StorageManager.getExpiredLogKeys(PRUNE_AGE_SECONDS, context);

        if (expiredDiscordIds.length === 0) {
            UtilityManager.log('[JOB] No expired entries found. Cleanup complete.');
            return;
        }

        UtilityManager.log(`[JOB] Found ${expiredDiscordIds.length} expired messages to process.`);

        let successfulDeletions = 0;

        for (const discordId of expiredDiscordIds) {
            const entry = await StorageManager.getLogEntry(discordId, context);

            if (!entry) {
                UtilityManager.log(`[JOB] Expired ID ${discordId} found in index but missing log entry. Skipping.`);
                continue;
            }

            try {
                if (entry.webhookUrl) {
                    const success = await WebhookManager.deleteMessage(entry.webhookUrl, entry.discordMessageId);
                    if(success){
                        UtilityManager.log(`[JOB] Successfully deleted Discord message ID ${entry.discordMessageId}.`);
                        await StorageManager.deleteLogEntry(entry as LogEntry, context as any);
                        successfulDeletions++;
                    } else {
                        const messageAge = Date.now() - (entry.unixTimestamp);
                        if (messageAge > PRUNE_AGE_SECONDS + (24 * 60 * 60)) { // Add 1 day buffer to retry
                            UtilityManager.log(`[JOB] Message exceeded 13-day limit. Force deleting DB entry.`);
                            await StorageManager.deleteLogEntry(entry as LogEntry, context as any);
                            successfulDeletions++;
                        } else {
                            UtilityManager.log(`[JOB] Failed to delete Discord message ID ${entry.discordMessageId}. Will retry in next cleanup.`);
                        }
                    }
                    


                    await sleep(500);
                } else {
                    UtilityManager.log(`[JOB] No webhook URL for message ${entry.discordMessageId}. Skipping Discord deletion.`);
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                UtilityManager.log(`[JOB] Failed to process cleanup for ${entry.discordMessageId}: ${errorMessage}`);

                if (errorMessage.includes('404')) {
                    UtilityManager.log(`[JOB] Message was already gone from Discord. Cleaning up DB entry.`);
                    await StorageManager.deleteLogEntry(entry as LogEntry, context as any);
                }
            }
        }

        UtilityManager.log(`[JOB] Prune complete. Processed ${successfulDeletions} items.`);

    } catch (error) {
        UtilityManager.error(`[JOB] CRITICAL ERROR during cleanup job:`, error);
    }
}