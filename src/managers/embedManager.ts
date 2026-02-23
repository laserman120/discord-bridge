import { Post, Comment, ModAction, TriggerContext } from '@devvit/public-api';
import { ItemState, ChannelType } from '../config/enums.js';
import { UtilityManager } from './utilityManager.js';
import { ContentDetails, ModActionDetails } from './contentDataManager.js';
import { APP_ICON_MODLOG_BLUE, APP_ICON_MODLOG_GREEN, APP_ICON_MODLOG_GREY, APP_ICON_MODLOG_RED } from '../config/constants.js';

export class EmbedManager {
    private static getModActionColor(action: string): [number, string] {
        const criticalActions = ['banuser', 'spamlink', 'removelink', 'removecomment', 'spamcomment'];
        const positiveActions = ['approve', 'approvelink', 'approvecomment', 'unbanuser', 'distinguish'];
        const settingsActions = ['community_styling', 'modqueue', 'wikirevise', 'createrule', 'editrule'];

        if (criticalActions.includes(action)) return [0xF04747, APP_ICON_MODLOG_RED]; // Red
        if (positiveActions.includes(action)) return [0x2ECC71, APP_ICON_MODLOG_GREEN]; // Green
        if (settingsActions.includes(action)) return [0x95a5a6, APP_ICON_MODLOG_GREY]; // Grey

        return [0x3498DB, APP_ICON_MODLOG_BLUE]; // Blue (Default/Neutral)
    }

    static async createModLogEmbed(event: any, targetData: ModActionDetails, channelType: ChannelType, context: TriggerContext): Promise<any>{

        const showIcon = await context.settings.get('MODLOG_SHOW_DEFAULT_ICON') as boolean || false;

        const actionData = this.getModActionColor(event.action);
        const color = actionData[0];
        let finalAvatarUrl: string | undefined;

        if (showIcon) {
            finalAvatarUrl = actionData[1];
        }

        const moderatorName = event.moderator?.name || 'Reddit';
        const timestamp = event.actionedAt ? new Date(event.actionedAt).toISOString() : new Date().toISOString();

        let description = event.details || event.description || "";

        if (!description) {
            if (event.action === 'sticky') description = "Stickied content";
            if (event.action === 'unsticky') description = "Unstickied content";
            if (event.action === 'lock') description = "Locked content";
            if (event.action === 'unlock') description = "Unlocked content";
        }

        const fields = [
            { name: 'Moderator', value: `u/${moderatorName}`, inline: true },
            { name: 'Action', value: `\`${event.action}\``, inline: true },
        ];

        if (targetData.targetType === 'content' && targetData.contentDetails) {
            fields.push({ name: 'Target', value: `[${targetData.targetName}](${targetData.targetUrl})`, inline: true });

            if (targetData.contentDetails.body) {
                const snippet = targetData.contentDetails.body.substring(0, 150).replace(/\n/g, ' ');
                description = description ? `${description}\n\n> ${snippet}...` : `> ${snippet}...`;
            }
        } else if (targetData.targetType === 'user') {
            fields.push({ name: 'User', value: `[${targetData.targetName}](${targetData.targetUrl})`, inline: true });
        } else {
            fields.push({ name: 'Target', value: targetData.targetName, inline: true });
        }

        const embed: any = {
            title: `Mod Action: ${event.action}`,
            description: description || undefined,
            color: color,
            fields: fields,
            timestamp: timestamp,
            footer: { text: `r/${event.subreddit.name || 'Subreddit'}` },
        };

        return {
            embeds: [embed],
            avatar_url: finalAvatarUrl
        };
    }
}