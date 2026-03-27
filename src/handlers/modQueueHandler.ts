import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { UtilityManager } from '../helpers/utilityHelper.js';


type ThresholdRule = {
    Threshold: number;
    Comparator: ">" | "<" | "=" | ">=" | "<=";
    Message_Removal: string;
    Message_Report: string;
};

/**
 * Handles items entering the Moderator Queue.
 * Tracks reports and removals that require manual moderator review.
 */
export class ModQueueHandler extends BaseHandler {
    /**
     * Processes a potential ModQueue entry.
     * @param event - The trigger event data.
     * @param context - The Devvit execution context.
     * @param currentQueue - The list of items currently in the Subreddit's ModQueue.
     * @param preFetchedContent - Optional content already fetched by the QueueManager.
     */
    static async handle(event: any, context: TriggerContext, currentQueue: (Post | Comment)[], preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = this.getRedditId(event);
        if (!targetId) return;

        const webhookUrl = await context.settings.get('WEBHOOK_MOD_QUEUE') as string | undefined;
        if (!webhookUrl) return;

        // 1. Prevent Duplicate Logs
        if (await this.isAlreadyLogged(targetId, ChannelType.ModQueue, context)) {
            return;
        }

        // 2. Queue Verification
        // Even if a trigger fires, we verify the item is actually IN the queue
        const existsInQueue = currentQueue.some(item => item.id === targetId);
        if (!existsInQueue) return;

        // 3. Resolve Content
        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem || contentItem.isApproved()) return;

        // 4. Determine Item State
        const contentData = await ContentDataManager.gatherDetails(contentItem, context, event);
        let state = ItemState.Live;

        if (contentData.reportCount && contentData.reportCount > 0) {
            state = ItemState.Unhandled_Report;
        } else if (contentItem.isRemoved() || contentItem.isSpam() || contentData.removedBy) {
            state = ItemState.Awaiting_Review;
        }

        console.log(`[ModQueueHandler] Logging new entry: ${targetId} (${state})`);

        const queueCount = currentQueue.length;
        const thresholdJson = await context.settings.get('MOD_QUEUE_THRESHOLDS_JSON') as string || "{}";
        let notificationString: string | undefined;

        try {
            const rules: Record<string, ThresholdRule> = JSON.parse(thresholdJson);
            
            // Sort rules by Threshold descending so we hit the highest "priority" first
            const sortedRules = Object.values(rules).sort((a, b) => b.Threshold - a.Threshold);
        
            for (const rule of sortedRules) {
                if (UtilityManager.evaluateThreshold(queueCount, rule.Threshold, rule.Comparator)) {
                    notificationString = state === ItemState.Unhandled_Report 
                        ? rule.Message_Report 
                        : rule.Message_Removal;
                    
                    console.log(`[ModQueueHandler] Threshold met: ${rule.Threshold}. Using custom alert.`);
                    break; // Stop at the highest matching threshold
                }
            }
        } catch (e) {
            console.error("[ModQueueHandler] Error parsing thresholds:", e);
        }
        
        // Fallback to default settings if no threshold was met or JSON failed
        if (!notificationString) {
            notificationString = state === ItemState.Unhandled_Report
                ? await context.settings.get('MOD_QUEUE_MESSAGE_REPORT') as string | undefined
                : await context.settings.get('MOD_QUEUE_MESSAGE_REMOVAL') as string | undefined;
        }
        if(notificationString) {
            notificationString = notificationString.replace('{{count}}', queueCount.toString());
        }
        
        // 6. Dispatch and Store
        const payload = await ComponentManager.createDefaultMessage(contentData, state, ChannelType.ModQueue, context, notificationString);
        const discordMessageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

        if (discordMessageId && !discordMessageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: targetId,
                discordMessageId: discordMessageId,
                channelType: ChannelType.ModQueue,
                currentStatus: state,
                webhookUrl: webhookUrl
            }, context);
        }
    }

    /**
     * Updates or deletes a ModQueue Discord log based on a state change on Reddit.
     * If an item is no longer in the ModQueue, the Discord message is removed.
     */
    static async handlePossibleStateChange(itemId: string, state: ItemState, context: TriggerContext, contentItem: Post | Comment): Promise<void> {
        if (!itemId || !context.subredditName) return;

        const logEntries = await StorageManager.getLinkedLogEntries(itemId, context);
        const modQueueLog = logEntries.find(entry => entry.channelType === ChannelType.ModQueue);

        if (modQueueLog && [ItemState.Removed, ItemState.Approved, ItemState.Spam, ItemState.Deleted].includes(state)) {
            // Fetch the latest queue to confirm it's actually gone
            const subreddit = await context.reddit.getSubredditByName(context.subredditName);
            const currentQueue = await subreddit.getModQueue().all();
            const stillInQueue = currentQueue.some(item => item.id === itemId);

            if (stillInQueue) return;

            // Remove from Discord and DB since the item is handled
            await WebhookManager.deleteMessage(modQueueLog.webhookUrl, modQueueLog.discordMessageId, context);
            await StorageManager.deleteLogEntry(modQueueLog, context);
            console.log(`[ModQueueHandler] Removed handled item ${itemId} from Discord.`);
        }
    }
}