import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';

export abstract class BaseHandler {
    /**
     * Extracts a Reddit ThingID (t1_ or t3_) from a variety of event shapes.
     * @param event - The raw event object from Devvit triggers or the Queue Manager.
     * @returns The resolved ID string or undefined if no ID is found.
     */
    public static getRedditId(event: any): string | undefined {
        return (
            event.id ||
            event.postId ||
            event.commentId ||
            event.targetPost?.id ||
            event.targetComment?.id ||
            event.targetId ||
            event.conversationId?.replace('ModmailConversation_', '')
        );
    }

    /**
     * Standardized fetch logic that respects pre-fetched content to save API calls.
     * @param id - The Reddit ThingID to fetch.
     * @param context - The Devvit execution context.
     * @param preFetched - Optional pre-fetched Post or Comment object from a batch fetch.
     * @returns A Promise resolving to the Content item or null if the fetch fails.
     */
    protected static async fetchContent(
        id: string, 
        context: TriggerContext, 
        preFetched?: Post | Comment
    ): Promise<Post | Comment | null> {
        if (preFetched) return preFetched;
        try {
            return id.startsWith('t3_') 
                ? await context.reddit.getPostById(id) 
                : await context.reddit.getCommentById(id);
        } catch (e) {
            console.error(`[BaseHandler] Failed fetch for ${id}:`, e);
            return null;
        }
    }

    /**
     * Checks if this specific item has already been sent to a specific channel.
     */
    protected static async isAlreadyLogged(id: string, channel: ChannelType, context: TriggerContext): Promise<boolean> {
        const logs = await StorageManager.getLinkedLogEntries(id, context);
        return logs.some(entry => entry.channelType === channel);
    }
}