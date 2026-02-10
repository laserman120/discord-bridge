import { Devvit, JobContext, Post } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { QueueManager } from '../managers/queueManager.js';

export async function checkSpamQueue(event: any, context: JobContext): Promise<void> {
    const scanEnabled = await context.settings.get('REMOVALS_SCAN_SPAM') as boolean || false;

    if (!scanEnabled) {
        return;
    }

    console.log('[SpamCheck] Starting Spam Queue Check...');

    const PRUNE_AGE_SECONDS = 13 * 86400;
    const subreddit = await context.reddit.getCurrentSubreddit();

    const spamQueue = await subreddit.getSpam({ limit: 100, type: "all" }).all();

    const now = Date.now();
    const cutoffTimestamp = now - (PRUNE_AGE_SECONDS * 1000);

    for (const item of spamQueue) {
        const isPost = item.id.startsWith("t3_");

        if (item.createdAt.getTime() < cutoffTimestamp) {
            continue;
        }

        let isSilentRemoval = false;

        if (isPost) {
            const post = item as Post;
            if (post.removedByCategory && post.removedByCategory !== "moderator" && post.removedByCategory !== "author") {
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

            if (hasConflictingLog) {
                console.log(`[SpamCheck] Conflict detected for ${item.id}. Real: Removed/Spam, DB: Live/Other.`);
                await QueueManager.enqueue({
                    handler: 'StateSyncHandler',
                    data: {
                        targetId: item.id,
                        targetState: ItemState.Spam,
                        id: item.id
                    }
                }, context);
            } else if (alreadyLogged) {
                // It's in the spam queue and we already logged it as removed.
                console.log(`[SpamCheck] ${item.id} is correctly logged as removed.`);
            } else {
                console.log(`[SpamCheck] New silent removal detected: ${item.id}.`);
                const mockEvent = {
                    targetId: item.id,
                    targetState: ItemState.Spam,
                    id: item.id
                };

                await QueueManager.enqueue({
                    handler: 'SpamRemovalHandler',
                    data: mockEvent
                }, context);

                await QueueManager.enqueue({
                    handler: 'StateSyncHandler',
                    data: mockEvent
                }, context);
            }
        } else {
            // Manually removed by mod, or deleted by user.
        }
    }
    console.log('[SpamCheck] Check completed.');
}
