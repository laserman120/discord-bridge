import { Post, Comment, ModAction, ModActionTrigger, TriggerContext } from '@devvit/public-api';
import { ItemState, ChannelType } from '../config/enums.js';
import { UtilityManager } from './utilityManager.js';
import { ContentDetails, ModActionDetails } from './contentDataManager.js';

interface StatusDetails {
    statusText: string;
    actionText: string;
}

export class EmbedManager {
    private static getStatusDetails(status: ItemState): StatusDetails {
        let color = 0x95a5a6; // Gray
        let statusText = 'Unknown';
        let actionText = 'N/A';

        switch (status) {
            case ItemState.Approved:
                return {
                    statusText: '✅ Approved',
                    actionText: `Approved`
                };
            case ItemState.Removed:
                return {
                    statusText: '❌ Removed',
                    actionText: `Removed`
                };
            case ItemState.Spam:
                return {
                    statusText: '❌ Removed',
                    actionText: `Identified as Spam`
                };
            case ItemState.Awaiting_Review:
                return {
					statusText: '⏳ Awaiting Review',
					actionText: 'Auto-Removed'
				};
            case ItemState.Deleted:
                return {
                    statusText: '🗑️ Deleted',
                    actionText: 'Deleted by User/Reddit'
                };
            case ItemState.Live:
                return {
                    statusText: '🟢 Live',
                    actionText: 'None'
                };
            case ItemState.Unhandled_Report:
                return {
                    statusText: '⚠️ Reported',
                    actionText: 'Awaiting Review'
                };
            default:
                return {statusText, actionText };
        }
    }

    private static getModActionColor(action: string): number {
        const criticalActions = ['banuser', 'spamlink', 'removelink', 'removecomment', 'spamcomment'];
        const positiveActions = ['approve', 'approvelink', 'approvecomment', 'unbanuser', 'distinguish'];
        const settingsActions = ['community_styling', 'modqueue', 'wikirevise', 'createrule', 'editrule'];

        if (criticalActions.includes(action)) return 0xF04747; // Red
        if (positiveActions.includes(action)) return 0x2ECC71; // Green
        if (settingsActions.includes(action)) return 0x95a5a6; // Grey

        return 0x3498DB; // Blue (Default/Neutral)
    }

    static async createDefaultEmbed(details: ContentDetails, status: ItemState, channelType: ChannelType, context: TriggerContext): Promise<any> {
        const NSFWImagesHidden = await context.settings.get('NEW_PUBLIC_POST_HIDE_NSFW_IMAGE') as boolean || false;
        const NSFWBodyHidden = await context.settings.get('NEW_PUBLIC_POST_HIDE_NSFW_BODY') as boolean || false;
        const SPOILERImagesHidden = await context.settings.get('NEW_PUBLIC_POST_HIDE_SPOILER_IMAGE') as boolean || false;
        const SPOILERBodyHidden = await context.settings.get('NEW_PUBLIC_POST_HIDE_SPOILER_BODY') as boolean || false;


        const { statusText, actionText } = this.getStatusDetails(status);

        const color = await UtilityManager.getColorFromState(status, context);

        let description = '';
        if (status == ItemState.Public_Post && NSFWBodyHidden && details.contentWarning == "NSFW" || status == ItemState.Public_Post && SPOILERBodyHidden && details.contentWarning == "Spoilers")
        {
            /* empty */
        }
        else
        {
            if (details.body) {
                description = (details.body.substring(0, 300) + (details.body.length > 300 ? '...' : ''))
            }
            else if (details.isCrossPost && details.crossPostBody) {
                description = (details.crossPostBody.substring(0, 300) + (details.crossPostBody.length > 300 ? '...' : ''));
            }
        }

        const footerText = `r/${details.subredditName}`;

        let imageUrl;
        if (status == ItemState.Public_Post && NSFWImagesHidden && details.contentWarning == "NSFW" || status == ItemState.Public_Post && SPOILERImagesHidden && details.contentWarning == "Spoilers") {
            imageUrl = undefined;
        } else {
            imageUrl = details.imageUrl;
        }

        const fields = [
            { name: 'Author', value: `u/${details.authorName}`, inline: true }
        ];

        if (details.isCrossPost) {
            fields.push({ name: 'Crosspost from:', value: `[r/${details.crossPostSubredditName}](${details.crossPostPermalink})`, inline: true });
        }

        if (details.flairText) {
            fields.splice(1, 0, { name: 'Flair', value: details.flairText, inline: true });
        }

        if (details.contentWarning) {
            fields.push({ name: 'Content Warning', value: details.contentWarning, inline: true });
        }

        if (status != ItemState.Public_Post) {
            fields.push({ name: 'Status', value: statusText, inline: true });
        
            if (status === ItemState.Removed && details.removedBy)
            {
                fields.push({ name: 'Last Action', value: actionText + " by " + details.removedBy, inline: true });
            }
            else if (status === ItemState.Awaiting_Review && details.removedBy)
            {
                fields.push({ name: 'Last Action', value: actionText + " by " + details.removedBy, inline: true });
            }
            else
            {
                fields.push({ name: 'Last Action', value: actionText, inline: true });
            }

            if (details.removalReason) {
                fields.push({ name: 'Removal Reason', value: details.removalReason.substring(0, 1024), inline: true });
            }
        
            if (details.reportReasons && details.reportReasons.length > 0) {
                fields.push({ name: 'Report Reasons', value: details.reportReasons.join(', ').substring(0, 1024), inline: false });
            }

            if (details.reportCount) {
                fields.push({ name: 'Report Count', value: details.reportCount.toString(), inline: true });
            }
        }

        const title = details.type === 'post' ? details.title.substring(0, 256) : details.title;

        const embed: any = {
            title: title,
            url: details.permalink,
            description: description,
            color: color,
            fields: fields,
            timestamp: new Date(details.createdAt).toISOString(),
            footer: { text: footerText },
        };

        if (imageUrl) {
            embed.image = { url: imageUrl };
        }

        return {
            embeds: [embed]
        };
    }

    static createModLogEmbed(event: any, targetData: ModActionDetails, channelType: ChannelType): any{
        const color = this.getModActionColor(event.action);
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
            footer: { text: `r/${event.subreddit.name || 'Subreddit'} • ${channelType}` },
        };

        return {
            embeds: [embed]
        };
    }

    static async createModMailEmbed(conversationTitle: string, conversationId: string, userMessage: any, moderatorReply: any | undefined, status: ItemState, context: TriggerContext): Promise<unknown> {
        const color = await UtilityManager.getColorFromState(status, context);
        const statusText = UtilityManager.getStatusTextModMail(status);
        const permalink = `https://mod.reddit.com/mail/all/${conversationId}`;
        const timestamp = new Date().toISOString();

        let description = userMessage?.bodyMarkdown || "No content.";
        if (description.length > 400) description = description.substring(0, 390) + '...';

        const fields = [
            { name: 'User', value: `u/${userMessage?.author?.name || 'Unknown'}`, inline: true },
            { name: 'Status', value: statusText, inline: true },
        ];

        if (moderatorReply) {
            let replyBody = moderatorReply.bodyMarkdown || "No content.";
            if (replyBody.length > 400) replyBody = replyBody.substring(0, 390) + '...';

            fields.push({
                name: `↩️ Reply by u/${moderatorReply.author?.name}`,
                value: replyBody,
                inline: false
            });
        }

        return {
            embeds: [{
                title: `Modmail: ${conversationTitle}`,
                url: permalink,
                description: description,
                color: color,
                fields: fields,
                timestamp: timestamp,
                footer: { text: `Conversation ID: ${conversationId} • ${ChannelType.ModMail}` },
            }],
        };
    }
}