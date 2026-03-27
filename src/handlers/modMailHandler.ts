import { TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState, TranslationKey } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { APP_USERNAME, MAX_MODMAIL_AGE_MS } from '../config/constants.js';
import { TranslationHelper } from '../helpers/translationHelper.js';

interface ModmailMessage {
    id: string;
    date: string;
    bodyMarkdown: string;
    participatingAs?: string;
    author?: {
        name: string;
        isMod: boolean;
    };
}

/**
 * Manages Modmail conversations. 
 * Bridges new threads to Discord and appends replies to existing Discord messages
 * while maintaining conversation state (New, Reply, Answered).
 */
export class ModMailHandler extends BaseHandler {
    /**
     * Primary handler for Modmail events.
     * @param event - The Modmail event data.
     * @param context - The Devvit execution context.
     */
    static async handle(event: any, context: TriggerContext): Promise<void> {
        const webhookUrl = await context.settings.get('WEBHOOK_MODMAIL') as string | undefined;
        if (!webhookUrl) return;

        const targetId = event.conversationId;
        if (!targetId) return;

        const cleanId = targetId.replace('ModmailConversation_', '');

        // 1. Fetch conversation data
        const { conversation } = await context.reddit.modMail.getConversation({
            conversationId: cleanId,
            markRead: false,
        });

        if (!conversation) {
            console.log("[ModMailHandler] failed to fetch conversation!");
            return;
        }

        // 2. Sort messages Newest -> Oldest to identify current state
        const messageList = Object.values(conversation.messages).sort((a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        if (messageList.length === 0) return;

        const latestMessage = messageList[0];
        const isModAuthor = latestMessage.participatingAs === 'moderator' || latestMessage.author?.isMod;

        // 3. Determine logging history
        const logEntries = await StorageManager.getLinkedLogEntries(cleanId, context);
        logEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const latestLogEntry = logEntries[0];

        // 4. Identify NEW and FRESH messages
        const now = Date.now();
        const processedIds = await StorageManager.getProcessedMessageIds(cleanId, context);

        const messagesToBridge = (Object.values(conversation.messages) as ModmailMessage[])
            .filter((msg) => {
                const isNew = !processedIds.includes(msg.id);
                const isFresh = (now - new Date(msg.date).getTime()) < MAX_MODMAIL_AGE_MS;
                return isNew && isFresh;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // If no fresh messages to process, just stop.
        if (messagesToBridge.length === 0) return;

        // 5. State Calculation: Does this batch contain a USER reply?
        const containsUserReply = messagesToBridge.some(msg => !(msg.participatingAs === 'moderator' || msg.author?.isMod));

        let shouldCreateNew = false;
        let state = ItemState.New_Modmail;

        if (!latestLogEntry || containsUserReply) {
            shouldCreateNew = true;
            state = containsUserReply ? ItemState.New_Reply_Modmail : ItemState.New_Modmail;
        } else {
            shouldCreateNew = false;
            state = ItemState.Answered_Modmail;
        }

        // 6. Filter: Ignore threads started by Mods (unless from this App)
        if (state === ItemState.New_Modmail && isModAuthor) {
            const allowNews = await context.settings.get('ALLOW_NOTIFICATIONS_IN_DISCORD') as boolean;
            if (!(allowNews && latestMessage.author?.name?.toLowerCase() === APP_USERNAME.toLowerCase())) {
                return;
            }
        }

        // 7. Route with the pre-filtered message list
        if (shouldCreateNew) {
            await this.handleNewNotification(conversation, cleanId, latestLogEntry, messagesToBridge, state, webhookUrl, context);
        } else if (latestLogEntry) {
            await this.handleExistingUpdate(conversation, cleanId, latestLogEntry, messagesToBridge, state, context);
        }
    }

    /**
     * Logic for creating a brand new Discord notification for a modmail thread.
     * @private
     */
    private static async handleNewNotification(conversation: any, cleanId: string, latestLogEntry: any, messagesToBridge: any[], state: ItemState, webhookUrl: string, context: TriggerContext) {
        // Use the first message in the batch for the main card
        const triggerMessage = messagesToBridge[0];
        const notificationString = await context.settings.get('MODMAIL_MESSAGE') as string | undefined;

        let payload = await ComponentManager.createModMailMessage(
            conversation.subject ?? "No Subject",
            cleanId,
            triggerMessage,
            state,
            context,
            notificationString
        );

        // If there are more messages in this batch (like a quick Mod follow-up), append them
        if (messagesToBridge.length > 1) {
            for (let i = 1; i < messagesToBridge.length; i++) {
                const msg = messagesToBridge[i];
                const isMsgMod = msg.participatingAs === 'moderator' || msg.author?.isMod;
                
                if (isMsgMod) {
                    payload.components = await ComponentManager.appendModeratorReply(payload.components, msg, context);
                    
                    payload.components = await ComponentManager.updateModMailState(payload.components, ItemState.Answered_Modmail, context);
                    
                    state = ItemState.Answered_Modmail; 
                } else {
                    payload.components = await ComponentManager.updateModMailBody(payload.components, msg.bodyMarkdown, context);
                    
                    state = ItemState.New_Reply_Modmail;
                }
            }
        }

        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);
        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: cleanId,
                discordMessageId: messageId,
                channelType: ChannelType.ModMail,
                currentStatus: state,
                webhookUrl: webhookUrl
            }, context);

            await StorageManager.trackActiveModmail(cleanId, context);
            
            // Mark all messages in this batch as processed
            for (const msg of messagesToBridge) {
                await StorageManager.markMessageAsProcessed(cleanId, msg.id, context);
            }
        }
    }

    /**
     * Logic for appending messages to an existing Discord notification.
     * @private
     */
    private static async handleExistingUpdate(conversation: any, cleanId: string, latestLogEntry: any, messagesToBridge: any[], state: ItemState, context: TriggerContext) {
        const currentMessage = await WebhookManager.getMessage(latestLogEntry.webhookUrl, latestLogEntry.discordMessageId);
        if (!currentMessage) return;

        let components = currentMessage.components || [];
        let needsUpdate = false;

        // Sync visual state (colors/labels)
        if (latestLogEntry.currentStatus !== state) {
            components = await ComponentManager.updateModMailState(components, state, context);
            needsUpdate = true;
        }

        for (const msg of messagesToBridge) {
            if (!msg.id) continue;
            const isMsgMod = msg.participatingAs === 'moderator' || msg.author?.isMod;

            if (isMsgMod) {
                // Keep buttons at the bottom: remove them, add message, put them back
                components = await ComponentManager.appendModeratorReply(components, msg, context);
            } else {
                components = await ComponentManager.updateModMailBody(components, msg.bodyMarkdown || "...", context);
            }

            await StorageManager.markMessageAsProcessed(cleanId, msg.id, context);
            needsUpdate = true;
        }

        if (needsUpdate) {
            await WebhookManager.editMessage(
                latestLogEntry.webhookUrl,
                latestLogEntry.discordMessageId,
                { flags: currentMessage.flags, components }
            );

            if (latestLogEntry.currentStatus !== state) {
                await StorageManager.updateLogStatus(latestLogEntry.discordMessageId, state, context);
            }
        }
    }
}