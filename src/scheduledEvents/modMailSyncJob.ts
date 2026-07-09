import { Devvit, JobContext } from '@devvit/public-api';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ItemState } from '../config/enums.js';
import { ComponentManager } from '../managers/componentManager.js';
import { UtilityManager } from '../helpers/utilityHelper.js';

export async function checkModMailStatus(event: any, context: JobContext): Promise<void> {
    UtilityManager.log('[ModMailSync] Starting ModMail Archival Check...');

    const activeIds = await StorageManager.getActiveModmailIds(context as any);

    if (activeIds.length === 0) {
        UtilityManager.log('[ModMailSync] No active modmail conversations to check.');
        return;
    }

    UtilityManager.log(`[ModMailSync] Checking ${activeIds.length} active conversations...`);

    for (const conversationId of activeIds) {
        try {
            const { conversation } = await context.reddit.modMail.getConversation({
                conversationId: conversationId,
                markRead: false
            });

            if (!conversation) {
                UtilityManager.log(`[ModMailSync] Could not fetch conversation ${conversationId}. Skipping.`);
                continue;
            }

            const isArchived = conversation.state == "Archived";

            if (isArchived) {
                UtilityManager.log(`[ModMailSync] Conversation ${conversationId} is now Archived. Updating Discord.`);

                const logEntries = await StorageManager.getLinkedLogEntries(conversationId, context as any);
                const deleteOnHandle = await context.settings.get('MODMAIL_DELETE_ON_HANDLE') as boolean;

                for (const entry of logEntries) {
                    if (entry.currentStatus !== ItemState.Archived_Modmail) {

                        if (deleteOnHandle) {
                            const success = await WebhookManager.deleteMessage(entry.webhookUrl, entry.discordMessageId);
                            if (success) await StorageManager.deleteLogEntry(entry, context as any);
                            continue;
                        }
                        
                        const message = await WebhookManager.getMessage(entry.webhookUrl, entry.discordMessageId);

                        if (message && message.components) {
                            const updatedComponents = await ComponentManager.updateModMailState(
                                message.components,
                                ItemState.Archived_Modmail,
                                context as any
                            );

                            await WebhookManager.editMessage(
                                entry.webhookUrl,
                                entry.discordMessageId,
                                {
                                    flags: message.flags,
                                    components: updatedComponents
                                }
                            );
                        } else {
                            UtilityManager.log(`[ModMailSync] Message ${entry.discordMessageId} not found or has no components.`);
                        }

                        // 4. Update Database
                        await StorageManager.updateLogStatus(
                            entry.discordMessageId,
                            ItemState.Archived_Modmail,
                            context as any
                        );
                    }
                }

                await StorageManager.untrackActiveModmail(conversationId, context as any);
            }
        } catch (e) {
            UtilityManager.error(`[ModMailSync] Failed to check/update conversation ${conversationId}:`, e);
        }
    }
    UtilityManager.log('[ModMailSync] ModMail check complete.');
}