import { Devvit, JobContext } from '@devvit/public-api';
import { StorageManager, LogEntry } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { PRUNE_AGE_SECONDS } from '../config/constants.js';
import { UtilityManager } from '../helpers/utilityHelper.js';
import { QueueManager } from '../managers/queueManager.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function cleanupJob(event: any, context: JobContext): Promise<void> {
    await cleanupOldMessages(event, context);
    await cleanupStuckQueue(context);
    await deletionSyncJob(event, context);
}

export async function cleanupOldMessages(event: any, context: JobContext): Promise<void> {
    UtilityManager.log('[OldCleanup] Starting scheduled old message cleanup...');

    try {
        const expiredDiscordIds = await StorageManager.getExpiredLogKeys(PRUNE_AGE_SECONDS, context);

        if (expiredDiscordIds.length === 0) {
            UtilityManager.log('[OldCleanup] No expired entries found. Cleanup complete.');
            return;
        }

        UtilityManager.log(`[OldCleanup] Found ${expiredDiscordIds.length} expired messages to process.`);

        let successfulDeletions = 0;

        for (const discordId of expiredDiscordIds) {
            const entry = await StorageManager.getLogEntry(discordId, context);

            if (!entry) {
                UtilityManager.log(`[OldCleanup] Expired ID ${discordId} found in index but missing log entry. Skipping.`);
                continue;
            }

            try {
                if (entry.webhookUrl) {
                    const success = await WebhookManager.deleteMessage(entry.webhookUrl, entry.discordMessageId);
                    if(success){
                        UtilityManager.log(`[OldCleanup] Successfully deleted Discord message ID ${entry.discordMessageId}.`);
                        await StorageManager.deleteLogEntry(entry as LogEntry, context as any);
                        successfulDeletions++;
                    } else {
                        const messageAge = Math.floor(Date.now() / 1000) - (entry.unixTimestamp);
                        if (messageAge > PRUNE_AGE_SECONDS + (24 * 60 * 60)) { // Add 1 day buffer to retry
                            UtilityManager.log(`[OldCleanup] Message exceeded 13-day limit. Force deleting DB entry.`);
                            await StorageManager.deleteLogEntry(entry as LogEntry, context as any);
                            successfulDeletions++;
                        } else {
                            UtilityManager.log(`[OldCleanup] Failed to delete Discord message ID ${entry.discordMessageId}. Will retry in next cleanup.`);
                        }
                    }
                    


                    await sleep(500);
                } else {
                    UtilityManager.log(`[OldCleanup] No webhook URL for message ${entry.discordMessageId}. Skipping Discord deletion.`);
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                UtilityManager.log(`[OldCleanup] Failed to process cleanup for ${entry.discordMessageId}: ${errorMessage}`);

                if (errorMessage.includes('404')) {
                    UtilityManager.log(`[OldCleanup] Message was already gone from Discord. Cleaning up DB entry.`);
                    await StorageManager.deleteLogEntry(entry as LogEntry, context as any);
                }
            }
        }

        UtilityManager.log(`[OldCleanup] Prune complete. Processed ${successfulDeletions} items.`);

    } catch (error) {
        UtilityManager.error(`[OldCleanup] CRITICAL ERROR during cleanup job:`, error);
    }
}


export async function cleanupStuckQueue(context: JobContext): Promise<void> {
    try{
        // Perform a cleanup for the queue
        // We want to remove any items that have been in the queue for more than 13 days (PRUNE_AGE_SECONDS)

        const queueCutoffMs = Date.now() - (PRUNE_AGE_SECONDS * 1000);

        const stuckTasks = await context.redis.zRange('msg_queue:ids', 0, queueCutoffMs, { by: 'score' });

        if (stuckTasks && stuckTasks.length > 0) {
            UtilityManager.log(`[Queue Maintenance] Found ${stuckTasks.length} orphaned/stuck items older than 13 days. Pruning...`);
            
            const stuckIds = stuckTasks.map(t => t.member);
            
            await Promise.all([
                context.redis.hDel('msg_queue:data', stuckIds),
                context.redis.zRemRangeByScore('msg_queue:ids', 0, queueCutoffMs)
            ]);
            
            UtilityManager.log(`[Queue Maintenance] Successfully purged ${stuckIds.length} stuck queue items.`);
        }
    } catch (error) {
        UtilityManager.error(`[Queue Maintenance] Error during stuck queue cleanup:`, error);
    }
}

export async function deletionSyncJob(event: any, context: JobContext): Promise<void> {
    UtilityManager.log('[DeletionSync] Starting deletion sync sweep for recent items...');
    try {
        const recentIds = await StorageManager.getRecentTrackedPostIds(100, context as any);
        
        if (!recentIds || recentIds.length === 0) {
            UtilityManager.log('[DeletionSync] No recent items to check for deletion.');
            return;
        }

        let foundDeleted = 0;

        const subreddit = await context.reddit.getCurrentSubreddit();
        const items = await subreddit.getCommentsAndPostsByIds(recentIds).all();
        
        const fetchedItemsMap = new Map();
        for (const item of items) {
            fetchedItemsMap.set(item.id, item);
        }
        UtilityManager.log(`[DeletionSync] Fetched ${recentIds.length} items. Checking for deletions...`);
        for (const id of recentIds) {
            try {
                let isDeleted = false;
                const item = fetchedItemsMap.get(id);

                if (!item) {
                    UtilityManager.log(`[DeletionSync] Found 404 for ${id}. Item hard deleted. Queuing...`);
                    isDeleted = true;
                } else if (id.startsWith('t3_') && 'removedByCategory' in item && item.removedByCategory === 'deleted') {
                    isDeleted = true;
                } else if (id.startsWith('t1_') && 'authorName' in item && item.authorName === '[deleted]') {
                    isDeleted = true;
                }

                if (isDeleted) {
                    const targetData = id.startsWith('t3_') 
                        ? { postId: id, type: 'PostDelete' }
                        : { commentId: id, type: 'CommentDelete' };
                    
                    await QueueManager.enqueue({ handler: 'DeletionHandler', data: targetData }, context, 12);
                    foundDeleted++;
                }
            } catch (error) {
                UtilityManager.error(`[DeletionSync] Failed to process status for ${id}:`, error);
            }
        }

        UtilityManager.log(`[DeletionSync] Deletion sync complete. Queued ${foundDeleted} missed deletions.`);
    } catch (error) {
        UtilityManager.error(`[DeletionSync] CRITICAL ERROR during deletion sync job:`, error);
    }
}