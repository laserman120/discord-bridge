import { JobContext, TriggerContext } from '@devvit/public-api';
import { UtilityManager } from './utilityHelper.js';
import { StorageManager, LogEntry } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { QueueManager } from '../managers/queueManager.js';
import { MAX_MODMAIL_AGE_MS } from '../config/constants.js';

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
                    context.redis.del(QueueManager.DATA_KEY),
                    context.redis.del(QueueManager.LOCK_KEY),
                    context.redis.del(QueueManager.PAUSE_KEY)
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

    /**
         * Checks queue size and wipes it if it exceeds a critical threshold to prevent overflow.
         */
    static async checkQueueOverflow(context: JobContext | TriggerContext, limit: number = 20000): Promise<void> {
        try {
            const queueCount = await context.redis.zCard(QueueManager.QUEUE_KEY);
            if (queueCount >= limit) {
                UtilityManager.error(`[CRITICAL WARNING] Queue size (${queueCount}) exceeded maximum limit (${limit}). Initiating emergency wipe.`);
                
                await this.wipeQueue(context);

                const currentSub = await context.reddit.getCurrentSubreddit();
                await context.reddit.modMail.createModNotification({
                    subject: `CRITICAL: Queue Overflow Prevented`,
                    bodyMarkdown: `**Emergency Queue Wipe Executed**\n\nThe Discord Bridge queue reached an abnormal size of ${queueCount} items, exceeding the safe limit of ${limit}.\n\nAll pending events have been wiped.\n\nTo further investigate please reach out directly. [Here](https://www.reddit.com/message/compose/?to=_GLAD0S_) `,
                    subredditId: currentSub.id
                });
            }
        } catch (error) {
            UtilityManager.error('[DebugHelper] Failed to execute checkQueueOverflow:', error);
        }
    }

    /**
     * Gathers system metrics and sends a modmail report. Limited to 1 per hour.
     */
    static async sendStatusReport(context: JobContext): Promise<void> {
        const COOLDOWN_KEY = 'debug:status_report_cooldown';
        const isOnCooldown = await context.redis.get(COOLDOWN_KEY);
        if (isOnCooldown) return;

        try {
            const currentSub = await context.reddit.getCurrentSubreddit();
            const now = Date.now();

            const queueCount = await context.redis.zCard(QueueManager.QUEUE_KEY);
            const dataKeys = await context.redis.hKeys(QueueManager.DATA_KEY);
            const dataCount = dataKeys.length;
            const lockValue = await context.redis.get(QueueManager.LOCK_KEY);
            const pauseValue = await context.redis.get(QueueManager.PAUSE_KEY);

            const trackedMessagesCount = await context.redis.zCard(StorageManager.getChronoIndexKey());
            const activeModmailsCount = await context.redis.zCard(StorageManager.getActiveModmailIndexKey());

            const formatTime = (val: string | undefined) => {
                if (!val) return 'None';
                const timeMs = parseInt(val, 10);
                if (isNaN(timeMs)) return `Legacy/Invalid (${val})`;
                const diffSec = Math.round((now - timeMs) / 1000);
                return `Set ${diffSec} seconds ago`;
            };

            const bodyMarkdown = `**Discord Bridge System Status Report**

**Queue Metrics**
* Items in Queue (IDs): ${queueCount}
* Stored Payloads (Data): ${dataCount} ${(dataCount > queueCount) ? '*(Warning: Orphaned payloads exist)*' : ''}
* Lock Status: ${formatTime(lockValue)}
* Pause Status: ${formatTime(pauseValue)}
            
**Storage Metrics**
* Tracked Discord Messages: ${trackedMessagesCount}
* Active Modmail Threads: ${activeModmailsCount}
            
*You can disable the Send Status setting now.*`;

            const convId = await context.reddit.modMail.createModNotification({
                subject: `Discord Bridge Debug Status`,
                bodyMarkdown: bodyMarkdown,
                subredditId: currentSub.id
            });

            if (convId) {
                await context.redis.set(COOLDOWN_KEY, 'true', { expiration: new Date(now + MAX_MODMAIL_AGE_MS) });
                UtilityManager.log(`[DebugHelper] Status report sent successfully via Modmail.`);
            } else {
                UtilityManager.error(`[DebugHelper] Failed to return conversation ID for status report.`);
            }
        } catch (error) {
            UtilityManager.error(`[DebugHelper] Failed to send status report:`, error);
        }
    }
}
