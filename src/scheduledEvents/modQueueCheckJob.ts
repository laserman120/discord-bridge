import { Devvit, JobContext } from '@devvit/public-api';
import { ChannelType } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';

export async function checkModQueue(event: any, context: JobContext): Promise<void> {

    const webhookUrl = await context.settings.get('WEBHOOK_MOD_QUEUE') as string | undefined;

    if (!webhookUrl) {
        return;
    }

    console.log('[ModQueueCheckJob] Starting Mod Queue Check...');

    const subreddit = await context.reddit.getCurrentSubreddit();
    const currentQueue = await subreddit.getModQueue().all();

    const queueIds = new Set<string>();
    for (const item of currentQueue) {
        queueIds.add(item.id);
    }

    console.log(`[ModQueueCheckJob] Reddit Queue has ${queueIds.size} items.`);

    const recentLogs = await StorageManager.getRecentLogEntries(200, context);

    let deletedCount = 0;

    for (const entry of recentLogs) {
        if (entry.channelType !== ChannelType.ModQueue) {
            continue;
        }

        if (!queueIds.has(entry.redditId)) {

            console.log(`[ModQueueCheckJob] Orphaned item found: ${entry.redditId}. Deleting from Discord.`);

            await WebhookManager.deleteMessage(entry.webhookUrl, entry.discordMessageId);
            await StorageManager.deleteLogEntry(entry, context as any);

            deletedCount++;
        }
    }




    console.log(`[ModQueueCheckJob] Check completed. Cleaned up ${deletedCount} messages.`);
}