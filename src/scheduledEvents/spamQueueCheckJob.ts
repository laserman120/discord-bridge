import { Devvit, JobContext, Post } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { QueueManager } from '../managers/queueManager.js';
import { PRUNE_AGE_SECONDS } from '../config/constants.js';
import { UtilityManager } from '../helpers/utilityHelper.js';

export async function checkSpamQueue(event: any, context: JobContext): Promise<void> {
    const scanEnabled = await context.settings.get('REMOVALS_SCAN_SPAM') as boolean || false;

    UtilityManager.log('[SpamCheck] Starting Spam Queue Check...');

    const subreddit = await context.reddit.getCurrentSubreddit();

    const spamQueue = await subreddit.getSpam({ limit: 100, type: "all" }).all();

    const now = Date.now();
    const cutoffTimestamp = now - (PRUNE_AGE_SECONDS * 1000);
    const processedKey = `spamcheck:processed`;

    for (const item of spamQueue) {
        const isPost = item.id.startsWith("t3_");

        if (item.createdAt.getTime() < cutoffTimestamp) {
            continue;
        }

        const isProcessed = await context.redis.zScore(processedKey, item.id);
        if (isProcessed !== undefined) {
            continue;
        }

        let isSilentRemoval = false;

        if (isPost) {
            const post = item as Post;
            if (post.removedByCategory && post.removedByCategory !== "moderator" && post.removedByCategory !== "author" && post.removedByCategory !== "automod_filtered") {
                isSilentRemoval = true;
            }
        } else if (!item.isRemoved() && !item.isSpam()) {
                isSilentRemoval = true;
        }

        if (isSilentRemoval) {
            const existingLogs = await StorageManager.getLinkedLogEntries(item.id, context);

            const alreadyLogged = existingLogs.some(entry => entry.channelType === ChannelType.Removals);

            const hasConflictingLog = existingLogs.length > 0 && !existingLogs.some(entry =>
                entry.currentStatus === ItemState.Spam || entry.currentStatus === ItemState.Removed
            );

            const mockEvent = {
                targetId: item.id,
                targetState: ItemState.Spam,
                id: item.id
            };

            if (existingLogs.length > 0) {
                if (hasConflictingLog && !alreadyLogged) {
                    // Logs do exist, but not in removals
                    UtilityManager.log(`[SpamCheck] Conflict detected for ${item.id}. Real: Removed/Spam, DB: Live/Other.`);
                    if (scanEnabled) {
                        await QueueManager.enqueue({
                            handler: 'SpamRemovalHandler',
                            data: mockEvent
                        }, context);
                    }
                    await QueueManager.enqueue({
                        handler: 'StateSyncHandler',
                        data: mockEvent
                    }, context);
                } else if (hasConflictingLog && alreadyLogged) {
                    // Logs exist and are in removals, but not marked as spam/removed
                    UtilityManager.log(`[SpamCheck] Conflict detected for ${item.id}. Real: Removed/Spam, DB: Live/Other, but already logged in removals.`);
                    await QueueManager.enqueue({
                        handler: 'StateSyncHandler',
                        data: mockEvent
                    }, context);
                } else {
                    // Item has logs and currentStatus IS Spam or Removed. It is correctly handled.
                    UtilityManager.log(`[SpamCheck] ${item.id} is already correctly tracked as Spam/Removed.`);
                }
            } else {
                // Truly no logs exist for the item
                UtilityManager.log(`[SpamCheck] New silent removal detected: ${item.id}.`);

                if (scanEnabled) {
                    await QueueManager.enqueue({
                        handler: 'SpamRemovalHandler',
                        data: mockEvent
                    }, context);
                }

                await QueueManager.enqueue({
                    handler: 'StateSyncHandler',
                    data: mockEvent
                }, context);

                await Promise.all([
                    context.redis.zAdd(processedKey, { member: item.id, score: now }),
                    context.redis.expire(processedKey, PRUNE_AGE_SECONDS)
                ]);
            }
        } else {
            // Manually removed by mod, or deleted by user.
        }
    }
    UtilityManager.log('[SpamCheck] Check completed.');
}
