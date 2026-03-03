import { TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState, TranslationKey } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { APP_USERNAME } from '../config/constants.js';
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

        // 4. State Calculation Logic
        let shouldCreateNew = false;
        let state = ItemState.New_Modmail;

        if (!latestLogEntry) {
            shouldCreateNew = true;
            state = ItemState.New_Modmail;
        } else {
            const lastStatus = latestLogEntry.currentStatus;
            if (isModAuthor) {
                shouldCreateNew = false;
                state = ItemState.Answered_Modmail;
            } else {
                // If it was Answered/Archived and a user replies, we create a NEW message in Discord
                if (lastStatus === ItemState.Answered_Modmail || lastStatus === ItemState.Archived_Modmail) {
                    shouldCreateNew = true;
                    state = ItemState.New_Reply_Modmail;
                } else {
                    shouldCreateNew = false;
                    state = lastStatus === ItemState.New_Reply_Modmail ? ItemState.New_Reply_Modmail : ItemState.New_Modmail;
                }
            }
        }

        // 5. Special Filter: Ignore threads started by Mods (unless from this App)
        if (state === ItemState.New_Modmail && isModAuthor) {
            const allowNews = await context.settings.get('ALLOW_NOTIFICATIONS_IN_DISCORD') as boolean;
            if (allowNews && latestMessage.author?.name?.toLowerCase() === APP_USERNAME.toLowerCase()) {
                console.log(`[ModMailHandler] New conversation started by app, proceeding.`);
            } else {
                console.log(`[ModMailHandler] New conversation started by Moderator, ignoring.`);
                return;
            }
        }

        // 6. Ignore User Filter
        let ignoredUsersList = await context.settings.get('MODMAIL_AUTHOR_IGNORED') as string || "";
        let ignoredUsers = ignoredUsersList.split(";").map(u => u.trim().toLowerCase());
        if (latestMessage.author?.name && ignoredUsers.includes(latestMessage.author.name.toLowerCase())) {
            return;
        }

        // 7. Route to Creation or Update logic
        if (shouldCreateNew) {
            await this.handleNewNotification(conversation, cleanId, latestLogEntry, messageList, state, webhookUrl, context);
        } else if (latestLogEntry) {
            await this.handleExistingUpdate(conversation, cleanId, latestLogEntry, state, context);
        }
    }

    /**
     * Logic for creating a brand new Discord notification for a modmail thread.
     * @private
     */
    private static async handleNewNotification(conversation: any, cleanId: string, latestLogEntry: any, messageList: any[], state: ItemState, webhookUrl: string, context: TriggerContext) {
        // If no log exists, show the very first message. Otherwise show the latest reply.
        const messageToShow = (!latestLogEntry) ? messageList[messageList.length - 1] : messageList[0];
        if (!messageToShow.id) return;

        const notificationString = await context.settings.get('MODMAIL_MESSAGE') as string | undefined;
        const payload = await ComponentManager.createModMailMessage(
            conversation.subject ?? await TranslationHelper.t(TranslationKey.MODMAIL_NO_SUBJECT, context),
            cleanId,
            messageToShow,
            state,
            context,
            notificationString
        );

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
            await StorageManager.markMessageAsProcessed(cleanId, messageToShow.id, context);
        }
    }

    /**
     * Logic for appending messages to an existing Discord notification.
     * @private
     */
    private static async handleExistingUpdate(conversation: any, cleanId: string, latestLogEntry: any, state: ItemState, context: TriggerContext) {
        const processedIds = await StorageManager.getProcessedMessageIds(cleanId, context);
        
        // Filter for unsent messages, sort Oldest -> Newest for proper reading order
        const messagesToBridge = (Object.values(conversation.messages) as ModmailMessage[])
            .filter((msg) => !processedIds.includes(msg.id))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (messagesToBridge.length === 0) return;

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
                const buttonRowIndex = components.findIndex((c: any) => c.type === 1);
                let buttonRow = buttonRowIndex !== -1 ? components.splice(buttonRowIndex, 1)[0] : null;

                const replyComponents = await ComponentManager.createModMailReply(msg, true, context);
                components.push(...replyComponents);
                if (buttonRow) components.push(buttonRow);
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