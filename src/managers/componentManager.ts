import { TriggerContext } from '@devvit/public-api';
import { ItemState, ChannelType } from '../config/enums.js';
import { UtilityManager } from './utilityManager.js';
import { ContentDetails } from './contentDataManager.js';

interface MediaItem {
    url: string;
}
interface StatusDetails {
    statusText: string;
    actionText: string;
}
interface GalleryItem {
    id?: number | string;
    media: MediaItem;
    description?: string;
    spoiler?: boolean;
}

interface ComponentV2 {
    type: number;
    id?: number | string;
    content?: string;           // For Type 10 (Text Display)
    style?: number;             // For Type 2 (Button)
    label?: string;             // For Type 2 (Button)
    url?: string;               // For Type 2 (Button)
    divider?: boolean;          // For Type 14 (Separator)
    spacing?: number;           // For Type 14 (Separator)
    accent_color?: number;      // For Type 17 (Container)
    components?: ComponentV2[]; // For Type 1 (Action Row), Type 17 (Container), Type 9 (Section)
    items?: GalleryItem[];      // For Type 12 (Media Gallery)
    accessory?: ComponentV2;    // For Type 9 (Section)
    media?: MediaItem;          // For Type 11 (Thumbnail)
    description?: string;       // For Type 11 (Thumbnail)
    spoiler?: boolean;          // For Type 11 (Thumbnail)
}

interface ComponentPayload {
    flags: number;
    components: ComponentV2[];
    embeds: any[];
    content: string;
}

export class ComponentManager {

    private static readonly FLAGS_COMPONENTS_V2 = 32768;

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
                    statusText: '🔴 Removed',
                    actionText: `Removed`
                };
            case ItemState.Spam:
                return {
                    statusText: '🔴 Removed (Spam)',
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
                return { statusText, actionText };
        }
    }

    private static generateRandomId(): string {
        return Math.floor(Math.random() * 1000000000).toString();
    }

    private static createDivider(): ComponentV2 {
        return {
            id: this.generateRandomId(),
            type: 14, // Separator
            divider: true,
            spacing: 1
        };
    }

    private static createBigDivider(): ComponentV2 {
        return {
            id: this.generateRandomId(),
            type: 14, // Separator
            divider: true,
            spacing: 1
        };
    }

    private static createInvisDivider(): ComponentV2 {
        return {
            id: this.generateRandomId(),
            type: 14, // Separator
            divider: false,
            spacing: 1
        };
    }

    private static createText(content: string): ComponentV2 {
        return {
            id: this.generateRandomId(),
            type: 10, // Text Display
            content: content
        };
    }

    static async createDefaultMessage(details: ContentDetails, status: ItemState, channelType: ChannelType, context: TriggerContext, pingableMessage?: string): Promise<ComponentPayload> {
        // --- SETTINGS FETCHING ---
        const publicShowMoreBody = await context.settings.get('PUBLIC_DISPLAY_MORE_BODY')
        const publicShowNsfwBody = await context.settings.get('PUBLIC_SHOW_NSFW_BODY') as boolean || false;
        const publicShowSpoilerBody = await context.settings.get('PUBLIC_SHOW_SPOILER_BODY') as boolean || false;
        const publicShowNsfwImage = await context.settings.get('PUBLIC_SHOW_NSFW_IMAGES') as boolean || false;
        const publicShowSpoilerImage = await context.settings.get('PUBLIC_SHOW_SPOILER_IMAGE') as boolean || false;
        const publicShowAuthor = await context.settings.get('PUBLIC_SHOW_AUTHOR') as boolean || false;
        const publicShowFlair = await context.settings.get('PUBLIC_SHOW_FLAIR') as boolean || false;
        const publicShowContentWarning = await context.settings.get('PUBLIC_SHOW_CONTENT_WARNING') as boolean || false;

        const showModQueueButton = await context.settings.get('MOD_QUEUE_BUTTON') as boolean || false;

        const privateShowMoreBody = await context.settings.get('PRIVATE_DISPLAY_MORE_BODY');
        const showArcticShift = await context.settings.get('PRIVATE_SHOW_ARCTIC_SHIFT_BUTTON') as boolean || false;
        const showAuthorButton = await context.settings.get('PRIVATE_SHOW_DEFAULT_AUTHOR_BUTTON') as boolean || false;

        const showAuthorAge = await context.settings.get('PRIVATE_SHOW_AUTHOR_AGE') as boolean || false;

        const showAuthorFlair = await context.settings.get('PRIVATE_SHOW_AUTHOR_FLAIR') as boolean || false;
        const showPostFlair = await context.settings.get('PRIVATE_SHOW_POST_FLAIR') as boolean || false;

        const showTotalKarma = await context.settings.get('PRIVATE_SHOW_TOTAL_KARMA') as boolean || false;
        const showLinkKarma = await context.settings.get('PRIVATE_SHOW_LINK_KARMA') as boolean || false;
        const showCommentKarma = await context.settings.get('PRIVATE_SHOW_COMMENT_KARMA') as boolean || false;
        const showTotalSubKarma = await context.settings.get('PRIVATE_SHOW_TOTAL_SUB_KARMA') as boolean || false;
        const showLinkSubKarma = await context.settings.get('PRIVATE_SHOW_LINK_SUB_KARMA') as boolean || false;
        const showCommentSubKarma = await context.settings.get('PRIVATE_SHOW_COMMENT_SUB_KARMA') as boolean || false;

        const { statusText, actionText } = this.getStatusDetails(status);
        const color = await UtilityManager.getColorFromState(status, context);
        const isPublic = status === ItemState.Public_Post;

        const rootComponents: ComponentV2[] = [];
        const cardComponents: ComponentV2[] = [];

        // PING MESSAGE
        if (pingableMessage) {
            rootComponents.push(this.createText(pingableMessage));
        }

        // TITLE & IMAGE HANDLING
        let titleText = details.type === 'post' ? details.title.substring(0, 256) : `Comment by ${details.authorName}`;
        const titleMarkdown = `### ${titleText}`;

        let imageUrl: string | undefined = details.imageUrl;
        if ((details.isNSFW && !publicShowNsfwImage && isPublic) || (details.isSpoiler && !publicShowSpoilerImage && isPublic)) {
            imageUrl = undefined;
        }

        // BODY CONTENT & SNIPPET
        let bodyContent = '';
        if (details.isNSFW && !publicShowNsfwBody && isPublic) {
            bodyContent = '*[Hidden due to potential NSFW content]*';
        } else if (details.isSpoiler && !publicShowSpoilerBody && isPublic) {
            bodyContent = '*[Hidden due to potential Spoilers]*';
        } else {
            const rawBodyContent = details.body || (details.isCrossPost ? details.crossPostBody : '') || '';
            bodyContent = UtilityManager.cleanBodyText(rawBodyContent);
        }

        const isMoreBody = !!(isPublic ? publicShowMoreBody : privateShowMoreBody);
        const bodyLimit = isMoreBody ? 1000 : 400;

        const snippet = bodyContent.length > bodyLimit
            ? bodyContent.substring(0, bodyLimit - 3) + '...'
            : bodyContent;
            
        // Combined text for the top of the card
        const headerContent = `${titleMarkdown}\n${snippet}`.trim();

        if (imageUrl) {
            cardComponents.push({
                id: this.generateRandomId().toString(),
                type: 9, // Section
                components: [this.createText(headerContent || "_Image post_")],
                accessory: {
                    id: this.generateRandomId().toString(),
                    type: 11, // Thumbnail
                    media: { url: imageUrl },
                    spoiler: isPublic && (details.isSpoiler || details.isNSFW)
                }
            });
        } else {
            if (headerContent) {
                cardComponents.push(this.createText(headerContent));
            } else {
                cardComponents.push(this.createText(titleMarkdown));
            }
        }

        cardComponents.push(this.createDivider());

        // --- THEMED GROUPING BLOCKS ---

        // --- Author Identity ---
        const authorLines: string[] = [];

        // Author Name & Status
        if (publicShowAuthor || !isPublic) {
            const safeAuthorName = UtilityManager.escapeMarkdown(details.authorName);
            let authorStr = `**Author:** u/${safeAuthorName}`;
            if (details.authorShadowbanned && !isPublic) authorStr += ` ⚠️ (Banned)`;
            authorLines.push(authorStr);
        }

        // Account Age
        if (!isPublic && showAuthorAge && status !== ItemState.Deleted && details.authorCreatedAt) {
            authorLines.push(`**Age:** ${UtilityManager.getAccountAgeString(details.authorCreatedAt)}`);
        }

        // Author Flair (User's flair in the sub)
        if (!isPublic && showAuthorFlair && status !== ItemState.Deleted && details.authorFlair) {
            authorLines.push(`**User Flair:** ${details.authorFlair}`);
        }

        if (authorLines.length > 0) {
            cardComponents.push(this.createText(authorLines.join(' • ')));
        }

        // --- SECTION B: Content Meta ---
        const contentLines: string[] = [];

        // Post Flair (The tag on the post)
        const canShowFlair = isPublic ? publicShowFlair : showPostFlair;
        if (details.flairText && canShowFlair) {
            contentLines.push(`**Post Flair:** ${details.flairText}`);
        }

        // Content Warnings (NSFW/Spoiler)
        if (details.contentWarning && (publicShowContentWarning || !isPublic)) {
            contentLines.push(`**Warning:** ${details.contentWarning}`);
        }

        // Crosspost Info
        if (details.isCrossPost) {
            contentLines.push(`**Crosspost From:** [r/${details.crossPostSubredditName}](${details.crossPostPermalink})`);
        }

        if (contentLines.length > 0) {
            // Only add a divider if there was an author block above it
            if (authorLines.length > 0) {
                cardComponents.push(this.createDivider());
            }
            cardComponents.push(this.createText(contentLines.join(' • ')));
        }

        // Always add a divider after the metadata blocks before moving to Karma/Mod info
        if (authorLines.length > 0 || contentLines.length > 0) {
            cardComponents.push(this.createDivider());
        }


        // Karma
        if (!isPublic && status !== ItemState.Deleted) {
            const karmaParts: string[] = [];
            if (showTotalKarma || showLinkKarma || showCommentKarma) {
                const parts = [];
                if (showTotalKarma) parts.push(`Total: ${((details.authorLinkKarma || 0) + (details.authorCommentKarma || 0))}`);
                if (showLinkKarma) parts.push(`P: ${details.authorLinkKarma || 0}`);
                if (showCommentKarma) parts.push(`C: ${details.authorCommentKarma || 0}`);
                karmaParts.push(`**Global Karma:** ${parts.join(' / ')}`);
            }
            if (showTotalSubKarma || showLinkSubKarma || showCommentSubKarma) {
                const parts = [];
                if (showTotalSubKarma) parts.push(`Total: ${((details.authorSubredditLinkKarma || 0) + (details.authorSubredditCommentKarma || 0))}`);
                if (showLinkSubKarma) parts.push(`P: ${details.authorSubredditLinkKarma || 0}`);
                if (showCommentSubKarma) parts.push(`C: ${details.authorSubredditCommentKarma || 0}`);
                karmaParts.push(`**Subreddit Karma:** ${parts.join(' / ')}`);
            }

            if (karmaParts.length > 0) {
                cardComponents.push(this.createText(karmaParts.join('\n')));
                cardComponents.push(this.createDivider());
            }
        }

        // Moderation (Status & Actions)
        if (!isPublic) {
            const modLines: string[] = [];
            modLines.push(`**Status:** ${statusText} • **Action:** ${actionText}${details.removedBy ? ` by ${details.removedBy}` : ''}`);

            if (details.reportCount || (details.reportReasons && details.reportReasons.length > 0)) {
                let reportStr = `**Reports:** ${details.reportCount || 0}`;
                if (details.reportReasons?.length) reportStr += ` (${details.reportReasons.join(', ').substring(0, 100)})`;
                modLines.push(reportStr);
            }

            if (details.removalReason) modLines.push(`**Removal Reason:** ${details.removalReason.substring(0, 200)}`);
            if (modLines.length > 0) {
                cardComponents.push(this.createText(modLines.join('\n')));
                cardComponents.push(this.createDivider());
            }
        }

        // FOOTER: Subreddit & Time
        const timestamp = Math.floor(new Date(details.createdAt).getTime() / 1000);
        cardComponents.push(this.createText(`r/${details.subredditName} • <t:${timestamp}:f>`));

        // WRAP IN CONTAINER
        if (cardComponents.length > 0) {
            rootComponents.push({
                type: 17,
                id: this.generateRandomId(),
                accent_color: color,
                components: cardComponents
            });
        }

        // BUTTONS
        const buttons: ComponentV2[] = [];
        buttons.push({
            id: this.generateRandomId(),
            type: 2, style: 5,
            label: details.type === 'comment' ? "Comment" : "Post",
            url: details.permalink
        });

        if (!isPublic && status !== ItemState.Deleted) {
            if (showAuthorButton) buttons.push({
                id: this.generateRandomId(), type: 2, style: 5,
                label: "Author", url: `https://www.reddit.com/user/${details.authorName}`
            });
            if (showArcticShift) buttons.push({
                id: this.generateRandomId(), type: 2, style: 5,
                label: "Author A-S", url: `https://arctic-shift.photon-reddit.com/search?fun=posts_search&author=${details.authorName}&limit=10&sort=desc`
            });
        }

        if (channelType == ChannelType.ModQueue && showModQueueButton) {
            buttons.push({
                id: this.generateRandomId(),
                type: 2, style: 5,
                label: "Open Queue",
                url: `https://www.reddit.com/mod/${details.subredditName}/queue`
            });
        }

        rootComponents.push({
            type: 1,
            id: this.generateRandomId(),
            components: buttons
        });

        return {
            flags: 32768,
            components: rootComponents,
            embeds: [],
            content: ''
        };
    }

    /*
    static async createDefaultMessage(details: ContentDetails, status: ItemState, channelType: ChannelType, context: TriggerContext, pingableMessage?: string): Promise<ComponentPayload> {
        const publicShowNsfwBody = await context.settings.get('PUBLIC_SHOW_NSFW_BODY') as boolean || false;
        const publicShowSpoilerBody = await context.settings.get('PUBLIC_SHOW_SPOILER_BODY') as boolean || false;
        const publicShowNsfwImage = await context.settings.get('PUBLIC_SHOW_NSFW_IMAGES') as boolean || false;
        const publicShowSpoilerImage = await context.settings.get('PUBLIC_SHOW_SPOILER_IMAGE') as boolean || false;
        const publicShowAuthor = await context.settings.get('PUBLIC_SHOW_AUTHOR') as boolean || false;
        const publicShowFlair = await context.settings.get('PUBLIC_SHOW_FLAIR') as boolean || false;
        const publicShowContentWarning = await context.settings.get('PUBLIC_SHOW_CONTENT_WARNING') as boolean || false;

        const showArcticShift = await context.settings.get('PRIVATE_SHOW_ARCTIC_SHIFT_BUTTON') as boolean || false;
        const showAuthorButton = await context.settings.get('PRIVATE_SHOW_DEFAULT_AUTHOR_BUTTON') as boolean || false;

        const showTotalKarma = await context.settings.get('PRIVATE_SHOW_TOTAL_KARMA') as boolean || false;
        const showLinkKarma = await context.settings.get('PRIVATE_SHOW_LINK_KARMA') as boolean || false;
        const showCommentKarma = await context.settings.get('PRIVATE_SHOW_COMMENT_KARMA') as boolean || false;
        const showTotalSubKarma = await context.settings.get('PRIVATE_SHOW_TOTAL_SUB_KARMA') as boolean || false;
        const showLinkSubKarma = await context.settings.get('PRIVATE_SHOW_LINK_SUB_KARMA') as boolean || false;
        const showCommentSubKarma = await context.settings.get('PRIVATE_SHOW_COMMENT_SUB_KARMA') as boolean || false;

        const { statusText, actionText } = this.getStatusDetails(status);
        const color = await UtilityManager.getColorFromState(status, context);

        const rootComponents: ComponentV2[] = [];

        const cardComponents: ComponentV2[] = [];

        const isPublic = status === ItemState.Public_Post;

        let titleText = details.type === 'post' ? details.title.substring(0, 256) : `Comment by ${details.authorName}`;

        if (pingableMessage) {
            rootComponents.push(this.createText(pingableMessage));
        }

        titleText = `### ${titleText}`;
        

        const titleMarkdown = `${titleText}`;

        let imageUrl: string | undefined = details.imageUrl;
        const shouldHideImage = (details.isNSFW && !publicShowNsfwImage && isPublic) || (details.isSpoiler && !publicShowSpoilerImage && isPublic);
        if (shouldHideImage) {
            imageUrl = undefined;
        }

        let bodyContent = '';
        if (details.isNSFW && !publicShowNsfwBody && isPublic) {
            bodyContent = '*[Hidden due to potential NSFW content]*';
        } else if (details.isSpoiler && !publicShowSpoilerBody && isPublic) {
            bodyContent = '*[Hidden due to potential Spoilers]*';
        } else {
            if (details.body) {
                bodyContent = details.body;
            } else if (details.isCrossPost && details.crossPostBody) {
                bodyContent = details.crossPostBody;
            }
        }

        if (!bodyContent && imageUrl) {
            cardComponents.push({
                id: this.generateRandomId(),
                type: 9,
                components: [
                    this.createText(titleMarkdown)
                ],
                accessory: {
                    id: this.generateRandomId(),
                    type: 11, 
                    media: { url: imageUrl },
                    spoiler: isPublic && (details.isSpoiler || details.isNSFW) || false
                }
            });
            imageUrl = undefined;
        } else {
            cardComponents.push(this.createText(titleMarkdown));
        }

        cardComponents.push(this.createInvisDivider());

        if (bodyContent) {
            const snippet = bodyContent.substring(0, 400) + (bodyContent.length > 400 ? '...' : '');

            if (imageUrl) {
                cardComponents.push({
                    id: this.generateRandomId(),
                    type: 9, 
                    components: [
                        this.createText(snippet)
                    ],
                    accessory: {
                        id: this.generateRandomId(),
                        type: 11, 
                        media: { url: imageUrl },
                        spoiler: isPublic && (details.isSpoiler || details.isNSFW) || false
                    }
                });
                imageUrl = undefined; 
            } else {
                cardComponents.push(this.createText(snippet));
            }
            cardComponents.push(this.createBigDivider());
        } else {
            cardComponents.push(this.createDivider());
        }

        const fields: { label: string, value: string, fullWidth: boolean }[] = [];

        const addField = (label: string, value: string, fullWidth: boolean = false) => {
            fields.push({ label, value, fullWidth });
        };

        if (status !== ItemState.Public_Post) {
            addField('Status', statusText);
        }

        if (!publicShowAuthor && status == ItemState.Public_Post) {
            // Skipped due to hidden
        } else {
            addField('Author', `u/${details.authorName}`);
        }


        if (status !== ItemState.Public_Post && status !== ItemState.Deleted) {
            if (details.authorShadowbanned) {
                addField('Author Status', 'Banned/Shadowbanned ⚠️', true)
            }

            // User Karma Fields
            if (showTotalKarma && details.authorCommentKarma !== undefined && details.authorLinkKarma !== undefined) {
                const totalKarma = details.authorCommentKarma + details.authorLinkKarma;
                addField('Total Karma', totalKarma.toString());
            }

            if (showLinkKarma && details.authorLinkKarma !== undefined) {
                addField('Post Karma', details.authorLinkKarma.toString());
            }

            if (showCommentKarma && details.authorCommentKarma !== undefined) {
                addField('Comment Karma', details.authorCommentKarma.toString());
            }

            if (showTotalSubKarma && details.authorSubredditCommentKarma !== undefined && details.authorSubredditLinkKarma !== undefined) {
                const totalSubKarma = details.authorSubredditCommentKarma + details.authorSubredditLinkKarma;
                addField('Total Sub Karma', totalSubKarma.toString());
            }

            if (showLinkSubKarma && details.authorSubredditLinkKarma !== undefined) {
                addField('Post Sub Karma', details.authorSubredditLinkKarma.toString());
            }

            if (showCommentSubKarma && details.authorSubredditCommentKarma !== undefined) {
                addField('Comment Sub Karma', details.authorSubredditCommentKarma.toString());
            }

            // Action Details
            if (status === ItemState.Removed || status === ItemState.Awaiting_Review && details.removedBy) {
                addField('Last Action', `${actionText} by ${details.removedBy}`);
            } else {
                addField('Last Action', `${actionText}`);
            }
        }

        if (details.flairText) {
            if (!publicShowFlair && status == ItemState.Public_Post) {
                // Skipped due to hidden
            } else {
                addField('Flair', details.flairText);
            } 
        }

        if (details.contentWarning) {
            if (!publicShowContentWarning && status == ItemState.Public_Post) {
                // Skipped due to hidden
            } else {
                addField('Content Warning', details.contentWarning);
            }
        }

        if (status !== ItemState.Public_Post) {
            if (details.removalReason) {
                addField('Removal Reason', details.removalReason.substring(0, 200));
            }

            if (details.reportReasons && details.reportReasons.length > 0) {
                addField('Report Reason', details.reportReasons.join(', ').substring(0, 200));
            }

            if (details.reportCount) {
                addField('Report Count', details.reportCount.toString());
            }
        }
        if (details.isCrossPost) {
            addField('Crosspost From', `r/${details.crossPostSubredditName}`);
        }

        while (fields.length > 0) {
            const current = fields.shift()!;

            if (current.fullWidth || fields.length === 0) {
                cardComponents.push(this.createText(`**${current.label}:** ${current.value}`));
                cardComponents.push(this.createDivider());
                continue;
            }

            const next = fields[0];
            if (next.fullWidth) {
                cardComponents.push(this.createText(`**${current.label}:** ${current.value}`));
                cardComponents.push(this.createDivider());
                continue;
            }

            fields.shift();

            const separator = `\u00A0\u00A0\u00A0•\u00A0\u00A0\u00A0`;
            const combinedText = `**${current.label}:** ${current.value}${separator}**${next.label}:** ${next.value}`;

            cardComponents.push(this.createText(combinedText));
            cardComponents.push(this.createDivider());
        }

        const timestamp = Math.floor(new Date(details.createdAt).getTime() / 1000);
        cardComponents.push(this.createText(`r/${details.subredditName} • <t:${timestamp}:f>`));

        rootComponents.push({
            type: 17,
            id: this.generateRandomId(),
            accent_color: color,
            components: cardComponents
        });

        // --- BUTTON ROW (Type 1 - Action Row) ---
        const buttons: ComponentV2[] = [];

        let buttonLabel = "Post";
        if (details.type === 'comment') {
            buttonLabel = "Comment"
        }

        buttons.push({
            id: this.generateRandomId(),
            type: 2, 
            style: 5, 
            label: buttonLabel,
            url: details.permalink
        });

        if (status !== ItemState.Public_Post && status !== ItemState.Deleted && showAuthorButton) {
            buttons.push({
                id: this.generateRandomId(),
                type: 2,
                style: 5,
                label: "Author",
                url: `https://www.reddit.com/user/${details.authorName}`
            });
        }

        if (status !== ItemState.Public_Post && status !== ItemState.Deleted && showArcticShift) {
            buttons.push({
                id: this.generateRandomId(),
                type: 2,
                style: 5,
                label: "Author A-S",
                url: `https://arctic-shift.photon-reddit.com/search?fun=posts_search&author=${details.authorName}&limit=10&sort=desc`
                
            });
        }

        rootComponents.push({
            type: 1, 
            id: this.generateRandomId(),
            components: buttons
        });

        // Return Final Payload
        return {
            flags: this.FLAGS_COMPONENTS_V2, // 32768
            components: rootComponents,
            embeds: [],
            content: ''
        };
    } */

    static async createModMailMessage(subject: string, conversationId: string, initialMessage: any, status: ItemState, context: TriggerContext, pingableMessage?: string): Promise<ComponentPayload> {
        const color = await UtilityManager.getColorFromState(status, context);
        const statusText = UtilityManager.getStatusTextModMail(status);

        const rootComponents: ComponentV2[] = [];

        const cardComponents: ComponentV2[] = [];

        if (pingableMessage) {
            rootComponents.push(this.createText(pingableMessage));
        }

        cardComponents.push(this.createText(`### ${subject}`));

        let body = initialMessage?.bodyMarkdown || "No content.";
        if (body.length > 500) body = body.substring(0, 490) + '...';
        cardComponents.push(this.createText(body));

        cardComponents.push(this.createDivider());

        const userName = initialMessage?.author?.name || 'Unknown';
        const metaLine = `**User:** u/${userName} • **Status:** ${statusText} • **ID:** ${conversationId}`;
        cardComponents.push(this.createText(metaLine));

        rootComponents.push({
            type: 17,
            id: this.generateRandomId(),
            accent_color: color,
            components: cardComponents
        });

        const buttons: ComponentV2[] = [];
        buttons.push({
            id: this.generateRandomId(),
            type: 2,
            style: 5,
            label: "Open Modmail",
            url: `https://mod.reddit.com/mail/all/${conversationId}`
        });

        buttons.push({
            id: this.generateRandomId(),
            type: 2,
            style: 5,
            label: "User Profile",
            url: `https://www.reddit.com/user/${initialMessage?.author?.name}`
        });

        rootComponents.push({
            type: 1,
            id: this.generateRandomId(),
            components: buttons
        });

        return {
            flags: this.FLAGS_COMPONENTS_V2,
            components: rootComponents,
            embeds: [],
            content: ''
        };
    }

    static createModMailReply(message: any, isModerator: boolean): ComponentV2[] {
        const components: ComponentV2[] = [];

        components.push(this.createDivider());

        const accentColor = isModerator ? 0x2ECC71 : 0xE67E22;
        const authorPrefix = isModerator ? "Moderator Replied" : "User Replied";
        const authorName = message.author?.name || "Unknown";

        const replyContainerComponents: ComponentV2[] = [];
        replyContainerComponents.push(this.createText(`### ${authorPrefix}: u/${authorName}`));

        let body = message.bodyMarkdown || "No content.";
        if (body.length > 500) body = body.substring(0, 490) + '...';

        replyContainerComponents.push(this.createText(body));

        components.push({
            type: 17, // Container
            id: this.generateRandomId(),
            accent_color: accentColor,
            components: replyContainerComponents
        });

        return components;
    }

    static async updateModMailState(existingComponents: ComponentV2[], newState: ItemState, context: TriggerContext): Promise<ComponentV2[]> {
        const color = await UtilityManager.getColorFromState(newState, context);
        const statusText = UtilityManager.getStatusTextModMail(newState);

        const mainContainer = existingComponents.find(c => c.type === 17);

        if (!mainContainer || !mainContainer.components) {
            console.warn('[ComponentManager] Could not find main container to update state.');
            return existingComponents;
        }

        mainContainer.accent_color = color;

        const metaComponent = mainContainer.components.find(c => c.content && c.content.includes('**Status:**'));

        if (metaComponent && metaComponent.content) {
            metaComponent.content = metaComponent.content.replace(
                /\*\*Status:\*\* (.*?)( • |$)/,
                `**Status:** ${statusText}$2`
            );
        }

        return existingComponents;
    }

    static async updateModMailBody(existingComponents: ComponentV2[], newBodyText: string): Promise<ComponentV2[]> {
        const updatedComponents: ComponentV2[] = JSON.parse(JSON.stringify(existingComponents));

        // 1. Find the Main Container (First Type 17)
        const mainContainer = updatedComponents.find((c: ComponentV2) => c.type === 17);

        if (!mainContainer || !mainContainer.components) return updatedComponents;

        // 2. Find the Body Text Component
        const bodyComponent = mainContainer.components.find((c: ComponentV2) =>
            c.type === 10 &&
            c.content &&
            !c.content.startsWith('###') &&
            !c.content.includes('**User:**')
        );

        if (bodyComponent && bodyComponent.content) {
            let additionalContent = newBodyText || "No content.";

            // Separator for the appended message
            const separator = "\n\n**New Message:**\n";
            let newTotalContent = bodyComponent.content + separator + additionalContent;

            // Enforce limit of 500 chars total for the body field
            if (newTotalContent.length > 700) {
                newTotalContent = newTotalContent.substring(0, 697) + '...';
            }

            bodyComponent.content = newTotalContent;
            console.log(`[ComponentManager] Appended body content. New length: ${newTotalContent.length}`);
        } else {
            console.warn('[ComponentManager] Could not find body component to update.');
        }

        return updatedComponents;
    }
}