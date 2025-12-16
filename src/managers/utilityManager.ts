import { TriggerContext } from '@devvit/public-api';
import { ItemState, ChannelType } from '../config/enums.js';
import { Post } from '@devvit/public-api';

export class UtilityManager {
    static getStateFromModAction(action: string): ItemState | null {
        switch (action) {
            case 'approvelink':
            case 'approvecomment':
                return ItemState.Approved;
            case 'removelink':
            case 'removecomment':
                return ItemState.Removed;
            case 'spamlink':
            case 'spamcomment':
                return ItemState.Spam;
            default:
                return null;
        }
    }

    static async getColorFromState(state: ItemState, context: TriggerContext): Promise<number> {
        const settings = context.settings;
        let colorCode: string;
        switch (state) {
            case ItemState.Public_Post:
                colorCode = (await settings.get('publicPostColorCode') as string) || '#71c7d6';
                break;
            case ItemState.Live:
                colorCode = (await settings.get('liveColorCode') as string) || '#71c7d6';
                break;
            case ItemState.Approved:
                colorCode = (await settings.get('approvedColorCode') as string) || '#2ECC71';
                break;
            case ItemState.Removed:
                colorCode = (await settings.get('removedColorCode') as string) || '#E74C3C';
                break;
            case ItemState.Spam:
                colorCode = (await settings.get('spamColorCode') as string) || '#E74C3C';
                break;
            case ItemState.Awaiting_Review:
                colorCode = (await settings.get('awaitingReviewColorCode') as string) || '#E67E22';
                break;
            case ItemState.Deleted:
                colorCode = (await settings.get('deletedColorCode') as string) || '#808080';
                break;
            case ItemState.Unhandled_Report:
                colorCode = (await settings.get('unhandledReportColorCode') as string) || '#F1C40F';
                break;
            case ItemState.New_Modmail:
                colorCode = (await settings.get('newModMailColorCode') as string) || '#3498DB';
                break;
            case ItemState.Answered_Modmail:
                colorCode = (await settings.get('answeredModMailColorCode') as string) || '#2ECC71';
                break;
            case ItemState.Archived_Modmail:
                colorCode = (await settings.get('archivedModMailColorCode') as string) || '#2ECC71';
                break;
            case ItemState.New_Reply_Modmail:
                colorCode = (await settings.get('newReplyModMailColorCode') as string) || '#9B59B6';
                break;
            default:
                colorCode = '#95a5a6';
                break;
        }
        return UtilityManager.hexToDecimal(colorCode);
    }

    static hexToDecimal(hex: string): number {
        return parseInt(hex.replace('#', ''), 16);
    }

    static async getMessageFromChannelType(channelType: ChannelType, context: TriggerContext): Promise<string[] | undefined> {
        const settings = context.settings;

        switch (channelType) {
            case ChannelType.NewPosts:
                const newPostMsg = await settings.get('NEW_POST_MESSAGE') as string | undefined;
                return newPostMsg ? [newPostMsg] : undefined;

            case ChannelType.Removals:
                const modMsg = await settings.get('REMOVE_MESSAGE_MODERATOR') as string | undefined;
                const autoMsg = await settings.get('REMOVE_MESSAGE_AUTOMATIC') as string | undefined;
                const adminMsg = await settings.get('REMOVE_MESSAGE_ADMIN') as string | undefined;

                // 0=Mod, 1=Auto, 2=Admin
                return [modMsg || '', autoMsg || '', adminMsg || ''];

            case ChannelType.Reports:
                const reportMsg = await settings.get('REPORT_MESSAGE') as string | undefined;
                return reportMsg ? [reportMsg] : undefined;

            case ChannelType.ModLog:
                const modLogMsg = await settings.get('MODLOG_MESSAGE') as string | undefined;
                return modLogMsg ? [modLogMsg] : undefined;

            case ChannelType.ModMail:
                const modMailMsg = await settings.get('MODMAIL_MESSAGE') as string | undefined;
                return modMailMsg ? [modMailMsg] : undefined;

            default:
                return undefined;
        }
    }

    static async getBestImageUrl(post: Post): Promise<string | undefined> {
        try {
            if (post.url && /\.(jpeg|jpg|gif|png|webp)$/i.test(post.url)) {
                console.log("Found URL ", post.url);
                return post.url;
            }


            const rawPost = post as any;
            console.log("checking raw post data ", rawPost.preview?.images?.[0]?.source?.url);
            if (rawPost.preview?.images?.[0]?.source?.url) {
                return rawPost.preview.images[0].source.url.replace(/&amp;/g, '&');
            }

            console.log("checking thumbnail ", post.thumbnail);
            if (post.thumbnail && post.thumbnail.url.startsWith('http')) {
                return post.thumbnail.url;
            }

            const enrichedThumbnail = await post.getEnrichedThumbnail();
            if (enrichedThumbnail && enrichedThumbnail.isObfuscatedDefault) {
                return enrichedThumbnail.obfuscatedImage?.url;
            } else if (enrichedThumbnail) {
                return enrichedThumbnail.image.url;
            }

            return undefined;
        } catch (error) {
            console.error(`[UtilityManager] Error getting best image URL: ${error}`);
            return undefined;
        }
    }

    static validateWebhookUrl(url: string | undefined): string | undefined {
        if (!url) return undefined;

        const trimmedUrl = url.trim();

        const regex = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+$/;

        if (!regex.test(trimmedUrl)) {
            return "Invalid Webhook URL. Must be a valid Discord webhook.";
        }
        return undefined;
    }

    static validateHexColor(hex: string | undefined): string | undefined {
        if (!hex) return undefined;

        const regex = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

        if (!regex.test(hex)) {
            return "Invalid Hex Color. Format: #RRGGBB or #RGB";
        }
        return undefined;
    }

    static validateFlairConfig(configString: string | undefined): string | undefined {
        if (!configString || configString.trim() === '') return undefined;

        try {
            const config = JSON.parse(configString);

            if (!Array.isArray(config)) {
                return "Configuration must be a JSON Array: [...]";
            }

            for (let i = 0; i < config.length; i++) {
                const entry = config[i];
                if (!entry.flair || typeof entry.flair !== 'string') {
                    return `Entry #${i + 1}: Missing or invalid 'flair' property.`;
                }
                if (entry.webhook && this.validateWebhookUrl(entry.webhook)) {
                    return `Entry #${i + 1}: Invalid 'webhook' URL.`;
                }
            }
        } catch (e) {
            return "Invalid JSON Syntax. Please check your brackets and quotes.";
        }
        return undefined;
    }
}