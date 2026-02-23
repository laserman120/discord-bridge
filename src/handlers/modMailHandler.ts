import { Devvit, Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { UtilityManager } from '../managers/utilityManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';
import { PublicPostHandler } from '../handlers/publicPostHandler.js';
import { APP_USERNAME } from '../config/constants.js'

export class ModMailHandler {

    static async handle(event: any, context: TriggerContext): Promise<void> {
        const webhookUrl = await context.settings.get('WEBHOOK_MODMAIL') as string | undefined;
        if (!webhookUrl) return;

        const targetId = event.conversationId;
        if (!targetId) return;

        const cleanId = targetId.replace('ModmailConversation_', '');

        const { conversation } = await context.reddit.modMail.getConversation({
            conversationId: cleanId,
            markRead: false,
        });

        if (!conversation) {
            console.log("[ModMailHandler] failed to fetch conversation!");
            return;
        }

        const messages = conversation.messages;
        const messageList = Object.values(messages).sort((a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        if (messageList.length === 0) return;

        const latestMessage = messageList[0];
        const isModAuthor = latestMessage.participatingAs === 'moderator' || latestMessage.author?.isMod;

        const logEntries = await StorageManager.getLinkedLogEntries(cleanId, context);
        logEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const latestLogEntry = logEntries[0];

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
                if (lastStatus === ItemState.Answered_Modmail || lastStatus === ItemState.Archived_Modmail) {
                    shouldCreateNew = true;
                    state = ItemState.New_Reply_Modmail;
                } else {

                    shouldCreateNew = false;

                    state = lastStatus === ItemState.New_Reply_Modmail ? ItemState.New_Reply_Modmail : ItemState.New_Modmail;
                }
            }
        }

        if (state == ItemState.New_Modmail && isModAuthor) {
            const allowNews = await context.settings.get('ALLOW_NOTIFICATIONS_IN_DISCORD') as boolean;
            if (allowNews && latestMessage.author?.name && latestMessage.author?.name.toLowerCase() == APP_USERNAME) {
                console.log(`[ModMailHandler] New conversation started by discord bridge app, creating notification...`)
            } else {
                console.log(`[ModMailHandler] New conversation started by Moderator, ignoring`)
                return;
            }
            
        }

        let ignoredUsersList = await context.settings.get('MODMAIL_AUTHOR_IGNORED') as string || "";
        let ignoredUsers = ignoredUsersList.split(";");

        if (latestMessage.author?.name && ignoredUsers.map(u => u.trim().toLowerCase()).includes(latestMessage.author.name.toLowerCase())) {
            console.log(`[ModMailHandler] Latest message author ${latestMessage.author.name} is in ignored list, skipping notification.`);
            return;
        }

        if (shouldCreateNew) {
            console.log(`[ModMailHandler] Creating NEW notification for ${cleanId} (State: ${state})`);

            const messageToShow = (!latestLogEntry) ? messageList[messageList.length - 1] : latestMessage;
            if (!messageToShow.id) {
                console.log("[ModMailHandler] No valid message found to show for new notification, aborting.");
                return;
            }
            const notificationString = await context.settings.get('MODMAIL_MESSAGE') as string | undefined;

            const payload = await ComponentManager.createModMailMessage(
                conversation.subject ?? "(No Subject)",
                cleanId,
                messageToShow,
                state,
                context,
                notificationString
            );

            const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context as any);

            if (messageId && !messageId.startsWith('failed')) {
                await StorageManager.createLogEntry({
                    redditId: cleanId,
                    discordMessageId: messageId,
                    channelType: ChannelType.ModMail,
                    currentStatus: state,
                    webhookUrl: webhookUrl
                }, context as any);

                await StorageManager.trackActiveModmail(cleanId, context as any);
                await StorageManager.markMessageAsProcessed(cleanId, messageToShow.id, context);
            }

        } else {
            console.log(`[ModMailHandler] Updating EXISTING ${cleanId} (State: ${state})`);
            if (latestLogEntry) {
                // 1. Get IDs we already sent
                const processedIds = await StorageManager.getProcessedMessageIds(cleanId, context);

                // 2. Filter Reddit messages for things we HAVEN'T sent yet
                // Filter out messages that are in processedIds, then sort Oldest -> Newest
                const messagesToBridge = Object.values(messages)
                    .filter((msg: any) => !processedIds.includes(msg.id))
                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                if (messagesToBridge.length === 0) {
                    console.log(`[ModMailHandler] No new messages to append for ${cleanId}`);
                    return;
                }

                const currentMessage = await WebhookManager.getMessage(latestLogEntry.webhookUrl, latestLogEntry.discordMessageId);
                if (!currentMessage) return;

                let components = currentMessage.components || [];
                let needsUpdate = false;

                if (latestLogEntry.currentStatus !== state) {
                    components = await ComponentManager.updateModMailState(components, state, context);
                    needsUpdate = true;
                }

                // 3. Process each unsent message in order
                for (const msg of messagesToBridge) {
                    if (!msg.id) { continue; }
                    const isMsgMod = msg.participatingAs === 'moderator' || msg.author?.isMod;

                    if (isMsgMod) {
                        // Move buttons logic (same as before)
                        const buttonRowIndex = components.findIndex((c: any) => c.type === 1);
                        let buttonRow = buttonRowIndex !== -1 ? components.splice(buttonRowIndex, 1)[0] : null;

                        const replyComponents = ComponentManager.createModMailReply(msg, true);
                        components.push(...replyComponents);
                        if (buttonRow) components.push(buttonRow);
                        needsUpdate = true;
                    } else {
                        // Append to main body logic
                        components = await ComponentManager.updateModMailBody(components, msg.bodyMarkdown || "...");
                        needsUpdate = true;
                    }

                    // 4. Mark this specific message ID as processed
                    await StorageManager.markMessageAsProcessed(cleanId, msg.id, context);
                }

                if (needsUpdate) {
                    await WebhookManager.editMessage(
                        latestLogEntry.webhookUrl,
                        latestLogEntry.discordMessageId,
                        {
                            flags: currentMessage.flags,
                            components: components
                        }
                    );

                    if (latestLogEntry.currentStatus !== state) {
                        await StorageManager.updateLogStatus(latestLogEntry.discordMessageId, state, context);
                    }
                }
            }
        }
    }
}