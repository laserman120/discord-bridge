import { JobContext, TriggerContext } from '@devvit/public-api';
import { UtilityManager } from './utilityHelper.js';
import { StorageManager, LogEntry } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { QueueManager } from '../managers/queueManager.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class DebugHelper {
    /**
     * Wipes all pending items from the event queue.
     */
    static async wipeQueue(context: JobContext | TriggerContext): Promise<void> {
        try {
            const queueCount = await context.redis.zCard(QueueManager.QUEUE_KEY);
            if (queueCount > 0) {
                await Promise.all([
                    context.redis.del(QueueManager.QUEUE_KEY),
                    context.redis.del(QueueManager.DATA_KEY)
                ]);
                UtilityManager.log(`[DebugHelper] Successfully wiped ${queueCount} items from the queue.`);
            } else {
                UtilityManager.log(`[DebugHelper] Queue is already empty. Nothing to wipe.`);
            }
        } catch (error) {
            UtilityManager.error('[DebugHelper] Failed to wipe queue:', error);
        }
    }

    /**
     * Wipes logged messages from Discord and clears their tracking entries in Redis.
     * Processes a maximum of 20 items per run to respect limits.
     */
    static async wipeMessages(context: JobContext): Promise<void> {
        UtilityManager.log('[DebugHelper] DEBUG_WIPE_MESSAGES is enabled. Starting message wipe batch...');
        try {

            const scoreMembers = await context.redis.zRange(StorageManager.getChronoIndexKey(), 0, 19, { by: 'rank' });
            
            if (!scoreMembers || scoreMembers.length === 0) {
                UtilityManager.log('[DebugHelper] 100% COMPLETE: No remaining messages found in chronological index. Wipe Complete.');
                return;
            }

            let successfulDeletions = 0;

            for (const item of scoreMembers) {
                const discordId = item.member;
                const entry = await StorageManager.getLogEntry(discordId, context as any);

                if (!entry) {
                    UtilityManager.log(`[DebugHelper] ID ${discordId} found in index but missing log entry. Purging from index.`);
                    await context.redis.zRem(StorageManager.getChronoIndexKey(), [discordId]);
                    continue;
                }

                try {
                    if (entry.webhookUrl) {
                        const success = await WebhookManager.deleteMessage(entry.webhookUrl, entry.discordMessageId);
                        if (success) {
                            UtilityManager.log(`[DebugHelper] Deleted Discord message ID ${entry.discordMessageId}.`);
                        } else {
                            UtilityManager.log(`[DebugHelper] Discord returned non-success for ID ${entry.discordMessageId}. Purging anyway.`);
                        }
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    UtilityManager.log(`[DebugHelper] Discord API error for ${entry.discordMessageId}: ${errorMessage}. Purging anyway.`);
                }

                // Forcefully delete from DB regardless of Discord success
                await StorageManager.deleteLogEntry(entry as LogEntry, context as any);
                successfulDeletions++;

                await sleep(500);
            }

            UtilityManager.log(`[DebugHelper] Message wipe batch complete. Processed ${successfulDeletions} items.`);

        } catch (error) {
            UtilityManager.error('[DebugHelper] CRITICAL ERROR during message wipe batch:', error);
        }
    }
}