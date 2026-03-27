import { Post, TriggerContext } from '@devvit/public-api';
import { ItemState, ChannelType, TranslationKey } from '../config/enums.js';
import { DevvitContext } from '../types/context.js';
import { TranslationHelper } from './translationHelper.js';

/**
 * Shared utility functions for state mapping, color conversion, 
 * markdown sanitization, and setting validation.
 */
export class UtilityManager {
    /**
     * Maps a Reddit ModAction string to our internal ItemState.
     */
    static getStateFromModAction(action: string): ItemState | null {
        const mapping: Record<string, ItemState> = {
            'approvelink': ItemState.Approved,
            'approvecomment': ItemState.Approved,
            'removelink': ItemState.Removed,
            'removecomment': ItemState.Removed,
            'spamlink': ItemState.Spam,
            'spamcomment': ItemState.Spam,
        };
        return mapping[action] || null;
    }

    /**
     * Resolves the configured decimal color code for a given item state.
     */
    static async getColorFromState(state: ItemState, context: DevvitContext): Promise<number> {
        const { settings } = context;
        
        // Define setting keys for each state
        const colorKeys: Record<ItemState, string> = {
            [ItemState.Public_Post]: 'publicPostColorCode',
            [ItemState.Live]: 'liveColorCode',
            [ItemState.Approved]: 'approvedColorCode',
            [ItemState.Removed]: 'removedColorCode',
            [ItemState.Spam]: 'spamColorCode',
            [ItemState.Awaiting_Review]: 'awaitingReviewColorCode',
            [ItemState.Deleted]: 'deletedColorCode',
            [ItemState.Unhandled_Report]: 'unhandledReportColorCode',
            [ItemState.New_Modmail]: 'newModMailColorCode',
            [ItemState.Answered_Modmail]: 'answeredModMailColorCode',
            [ItemState.Archived_Modmail]: 'archivedModMailColorCode',
            [ItemState.New_Reply_Modmail]: 'newReplyModMailColorCode',
        };

        // Default fallbacks if settings are empty
        const fallbacks: Partial<Record<ItemState, string>> = {
            [ItemState.Approved]: '#2ECC71',
            [ItemState.Removed]: '#E74C3C',
            [ItemState.Spam]: '#E74C3C',
            [ItemState.Awaiting_Review]: '#E67E22',
            [ItemState.Deleted]: '#808080',
            [ItemState.Unhandled_Report]: '#F1C40F',
            [ItemState.New_Modmail]: '#3498DB',
            [ItemState.New_Reply_Modmail]: '#9B59B6',
        };

        const hex = (await settings.get(colorKeys[state]) as string) || fallbacks[state] || '#71c7d6';
        return this.hexToDecimal(hex);
    }

    /**
     * Converts Hex color strings (e.g. #FFFFFF) to Discord-friendly Decimals.
     */
    static hexToDecimal(hex: string): number {
        return parseInt(hex.replace('#', ''), 16);
    }

    /**
     * Returns a human-readable string for Modmail conversation states.
     */
    static async getStatusTextModMail(status: ItemState, context: TriggerContext): Promise<string> {
        const labels: Partial<Record<ItemState, string>> = {
            [ItemState.New_Modmail]: await TranslationHelper.t(TranslationKey.MODMAIL_NEW, context),
            [ItemState.Answered_Modmail]: await TranslationHelper.t(TranslationKey.MODMAIL_REPLIED, context),
            [ItemState.Archived_Modmail]: await TranslationHelper.t(TranslationKey.MODMAIL_ARCHIVED, context),
            [ItemState.New_Reply_Modmail]: await TranslationHelper.t(TranslationKey.MODMAIL_NEW_REPLY, context)
        };
        return labels[status] ?? 'Unknown';
    }

    /**
     * Fetches notification strings based on the channel type.
     * Note: Removals return an array [Mod, Auto, Admin, Spam].
     */
    static async getMessageFromChannelType(channelType: ChannelType, context: DevvitContext): Promise<string[] | undefined> {
        const { settings } = context;

        switch (channelType) {
            case ChannelType.Removals:
                const results = await Promise.all([
                    settings.get('REMOVE_MESSAGE_MODERATOR'),
                    settings.get('REMOVE_MESSAGE_AUTOMATIC'),
                    settings.get('REMOVE_MESSAGE_ADMIN'),
                    settings.get('REMOVE_MESSAGE_SPAM')
                ]);
                return results.map(val => (val as string) || '');

            case ChannelType.NewPosts: return [await settings.get('NEW_POST_MESSAGE') as string ?? ''];
            case ChannelType.Reports: return [await settings.get('REPORT_MESSAGE') as string ?? ''];
            case ChannelType.ModLog: return [await settings.get('MODLOG_MESSAGE') as string ?? ''];
            case ChannelType.ModMail: return [await settings.get('MODMAIL_MESSAGE') as string ?? ''];
            default: return undefined;
        }
    }

    /**
     * Attempts to find the highest quality image URL available for a post.
     */
    static async getBestImageUrl(post: Post): Promise<string | undefined> {
        try {
            // 1. Direct URL check
            if (post.url && /\.(jpeg|jpg|gif|png|webp)$/i.test(post.url)) return post.url;

            // 2. Reddit Preview images (Highest Quality)
            const rawPost = post as any;
            const preview = rawPost.preview?.images?.[0]?.source?.url;
            if (preview) return preview.replace(/&amp;/g, '&');

            // 3. Enriched Thumbnails
            const enriched = await post.getEnrichedThumbnail();
            if (enriched) {
                return enriched.isObfuscatedDefault 
                    ? enriched.obfuscatedImage?.url 
                    : enriched.image.url;
            }

            // 4. Standard Thumbnail fallback
            if (post.thumbnail?.url.startsWith('http')) return post.thumbnail.url;

            return undefined;
        } catch (error) {
            console.error(`[UtilityManager] Error resolving image: ${error}`);
            return undefined;
        }
    }

    static evaluateThreshold(count: number, threshold: number, comparator: string): boolean {
        switch (comparator) {
            case ">": return count > threshold;
            case "<": return count < threshold;
            case "=": return count === threshold;
            case ">=": return count >= threshold;
            case "<=": return count <= threshold;
            default: return false;
        }
    }

    /**
     * Escapes Discord-specific markdown characters to prevent formatting breakages.
     */
    static escapeMarkdown(text: string): string {
        return text.replace(/([_*~`|<>])/g, '\\$1');
    }

    /**
     * Sanitizes and transforms Reddit Markdown into Discord-friendly Markdown.
     */
    static cleanBodyText(text: string): string {
        if (!text) return "";

        let cleaned = text
            // 1. Fix Reddit's Pre-Escaped Links & Flatten Redundant URLs
            .replace(/\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^\)]+)\)/gi, (match, label, url) => {
                if (label.replaceAll("\\", "").trim() === url.trim() || label.startsWith("http")) {
                    return url;
                }
                return `[${label.replaceAll("\\", "")}](${url})`;
            })

            // 2. Spoilers
            .replace(/>!(.*?)!</g, "||$1||")

            // 3. Media Placeholders
            .replace(/!\[video\]\(.*?\)/gi, "[Video]")
            .replace(/!\[img\]\(.*?\)/gi, "[Image]")
            .replace(/!\[gif\]\(.*?\)/gi, "[GIF]")

            // 4. Remove Zero Width Spaces
            .replace(/\u200b|&#8203;/g, "")

            // 5. Headers (H1, H2, H3 -> Bold)
            .replace(/^(?:#{1,3})\s+(.+)$/gm, "**$1**")

            // 6. Superscript to Italics (Original two-step logic)
            .replace(/\^\((.*?)\)/g, "*$1*")
            .replace(/\^(\S+)/g, "*$1*")

            // 7. Quote Fix
            .replace(/^>(?!\s)(.*)$/gm, "> $1")

            // 8. Indented Code Blocks
            // Wraps each line, then merges adjacent blocks to create a proper Discord code block
            .replace(/^ {4,}(.*)$/gm, "```\n$1\n```")
            .replace(/```\n```/g, "") 

            // 9. Clean up random backslashes on basic Markdown chars
            .replace(/\\([_~*])/g, "$1")

            // 10. Collapse 3+ newlines into exactly 2
            .replace(/\n{3,}/g, "\n\n");

        return cleaned.trim();
    }

    /**
     * Formats a Date object into a readable "X Years, Y Days" string.
     */
    static getAccountAgeString(createdAt: Date | string): string {
        const dateObj = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
        if (!dateObj || isNaN(dateObj.getTime())) return "Unknown";

        const totalDays = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
        if (totalDays < 365) return `${totalDays} Days`;

        const years = Math.floor(totalDays / 365);
        const remainingDays = totalDays % 365;
        return `${years} Years, ${remainingDays} Days`;
    }

    /**
     * Validates the JSON configuration string used for Flair-specific routing.
     * Ensures the input is a valid JSON array and contains required properties.
     */
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
                // Re-uses the internal webhook validator
                if (entry.webhook && this.validateWebhookUrl(entry.webhook)) {
                    return `Entry #${i + 1}: Invalid 'webhook' URL.`;
                }
            }
        } catch (e) {
            return "Invalid JSON Syntax. Please check your brackets and quotes.";
        }
        return undefined;
    }

    // #region Validators
    static validateWebhookUrl(url: string | undefined): string | undefined {
        if (!url) return undefined;
        const regex = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+$/;
        return regex.test(url.trim()) ? undefined : "Invalid Webhook URL.";
    }

    static validateHexColor(hex: string | undefined): string | undefined {
        if (!hex) return undefined;
        const regex = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
        return regex.test(hex) ? undefined : "Invalid Hex Color (Format: #RRGGBB).";
    }

    static validateUsernameList(value: string | undefined): string | undefined {
        if (!value?.trim()) return undefined;
        const names = value.split(';');
        for (const rawName of names) {
            const name = rawName.trim();
            if (!name) continue;
            if (/\s/.test(name)) return `Invalid username '${name}': Spaces not allowed.`;
            if (!/^[\w-]+$/.test(name)) return `Invalid username '${name}': Illegal characters.`;
        }
        return undefined;
    }
    // #endregion

    static validateTranslationConfig(value?: string): string | void {
        if (!value) return; // Valid
        try {
            const parsed = JSON.parse(value);
            if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                return 'Translation config must be a JSON object (e.g., { "key": "value" }).';
            }
            // No return here means it returns undefined, which Devvit treats as valid
        } catch (e) {
            return 'Invalid JSON format. Please check for missing commas or quotes.';
        }
    }

    /**
     * Validates the Mod Queue Threshold JSON structure.
     * Returns a string error message if invalid, or undefined if valid.
     */
    static validateThresholdJson(value?: string): string | undefined {
        if (!value) return undefined;
        try {
            const parsed = JSON.parse(value);
            
            // Ensure it's an object and not an array
            if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                return "Must be a JSON Object (Key-Value pairs)";
            }

            const validComparators = [">", "<", "=", ">=", "<="];

            for (const key in parsed) {
                const rule = parsed[key];
                
                if (typeof rule.Threshold !== 'number') {
                    return `Rule '${key}': 'Threshold' must be a number.`;
                }
                if (!validComparators.includes(rule.Comparator)) {
                    return `Rule '${key}': Invalid 'Comparator'. Use: >, <, =, >=, or <=`;
                }
                if (!rule.Message_Removal || typeof rule.Message_Removal !== 'string') {
                    return `Rule '${key}': 'Message_Removal' is required text.`;
                }
                if (!rule.Message_Report || typeof rule.Message_Report !== 'string') {
                    return `Rule '${key}': 'Message_Report' is required text.`;
                }
            }
        } catch (e) {
            return "Invalid JSON format. Check your commas and brackets!";
        }
        return undefined;
    }
}