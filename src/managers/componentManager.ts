import { TriggerContext } from '@devvit/public-api';
import { ItemState, ChannelType, TranslationKey } from '../config/enums.js';
import { UtilityManager } from '../helpers/utilityHelper.js';
import { ContentDetails } from './contentDataManager.js';
import { APP_ICON_URL } from '../config/constants.js';
import { TranslationHelper } from '../helpers/translationHelper.js';
import { DevvitContext } from '../types/context.js';

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
    avatar_url?: string;
}

export class ComponentManager {

    private static readonly FLAGS_COMPONENTS_V2 = 32768;

    private static async getStatusDetails(status: ItemState, context: DevvitContext): Promise<StatusDetails> {
        // Default fallback values
        let statusText = 'Unknown';
        let actionText = 'N/A';
    
        switch (status) {
            case ItemState.Approved:
                return {
                    statusText: await TranslationHelper.t(TranslationKey.STATE_APPROVED, context),
                    actionText: await TranslationHelper.t(TranslationKey.ACTION_APPROVED, context)
                };
            case ItemState.Removed:
                return {
                    statusText: await TranslationHelper.t(TranslationKey.STATE_REMOVED, context),
                    actionText: await TranslationHelper.t(TranslationKey.ACTION_REMOVED, context)
                };
            case ItemState.Spam:
                return {
                    statusText: await TranslationHelper.t(TranslationKey.STATE_SPAM, context),
                    actionText: await TranslationHelper.t(TranslationKey.ACTION_IDENTIFIED_SPAM, context)
                };
            case ItemState.Awaiting_Review:
                return {
                    statusText: await TranslationHelper.t(TranslationKey.STATE_AWAITING_REVIEW, context),
                    actionText: await TranslationHelper.t(TranslationKey.ACTION_AUTO_REMOVED, context)
                };
            case ItemState.Deleted:
                return {
                    statusText: await TranslationHelper.t(TranslationKey.STATE_DELETED, context),
                    actionText: await TranslationHelper.t(TranslationKey.ACTION_DELETED_BY_USER, context)
                };
            case ItemState.Live:
                return {
                    statusText: await TranslationHelper.t(TranslationKey.STATE_LIVE, context),
                    actionText: await TranslationHelper.t(TranslationKey.ACTION_NONE, context)
                };
            case ItemState.Unhandled_Report:
                return {
                    statusText: await TranslationHelper.t(TranslationKey.STATE_REPORTED, context),
                    actionText: await TranslationHelper.t(TranslationKey.ACTION_AWAITING_REVIEW, context)
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

        const publicShowIcon = await context.settings.get('PUBLIC_SHOW_DEFAULT_ICON') as boolean || false;
        const privateShowIcon = await context.settings.get('PRIVATE_SHOW_DEFAULT_ICON') as boolean || false;

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

        const { statusText, actionText } = await this.getStatusDetails(status, context);
        const color = await UtilityManager.getColorFromState(status, context);
        const isPublic = status === ItemState.Public_Post;

        const rootComponents: ComponentV2[] = [];
        const cardComponents: ComponentV2[] = [];

        // PING MESSAGE
        if (pingableMessage) {
            rootComponents.push(this.createText(pingableMessage));
        }

        // TITLE & IMAGE HANDLING
        let titleText = details.type === 'post' ? details.title.substring(0, 256) : await TranslationHelper.t(TranslationKey.TEXT_COMMENT_BY, context, { author: details.authorName });
        const titleMarkdown = `### ${titleText}`;

        let imageUrl: string | undefined = details.imageUrl;
        if ((details.isNSFW && !publicShowNsfwImage && isPublic) || (details.isSpoiler && !publicShowSpoilerImage && isPublic)) {
            imageUrl = undefined;
        }

        // BODY CONTENT & SNIPPET
        let bodyContent = '';
        if (details.isNSFW && !publicShowNsfwBody && isPublic) {
            bodyContent = await TranslationHelper.t(TranslationKey.TEXT_HIDDEN_NSFW, context);
        } else if (details.isSpoiler && !publicShowSpoilerBody && isPublic) {
            bodyContent = await TranslationHelper.t(TranslationKey.TEXT_HIDDEN_SPOILER, context);
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
                components: [this.createText(headerContent || await TranslationHelper.t(TranslationKey.TEXT_IMAGE_POST, context))],
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
            let authorStr = await TranslationHelper.t(TranslationKey.LABEL_AUTHOR, context, { author: safeAuthorName });
            if (details.authorShadowbanned && !isPublic) authorStr += await TranslationHelper.t(TranslationKey.LABEL_BANNED, context);
            authorLines.push(authorStr);
        }

        // Account Age
        if (!isPublic && showAuthorAge && status !== ItemState.Deleted && details.authorCreatedAt) {
            authorLines.push( await TranslationHelper.t(TranslationKey.LABEL_AGE, context, { age: UtilityManager.getAccountAgeString(details.authorCreatedAt) }) );
        }

        // Author Flair (User's flair in the sub)
        if (!isPublic && showAuthorFlair && status !== ItemState.Deleted && details.authorFlair) {
            authorLines.push( await TranslationHelper.t(TranslationKey.LABEL_USER_FLAIR, context, { flair: details.authorFlair }));
        }

        if (authorLines.length > 0) {
            cardComponents.push(this.createText(authorLines.join(' • ')));
        }

        // --- SECTION B: Content Meta ---
        const contentLines: string[] = [];

        // Post Flair (The tag on the post)
        const canShowFlair = isPublic ? publicShowFlair : showPostFlair;
        if (details.flairText && canShowFlair) {
            contentLines.push( await TranslationHelper.t(TranslationKey.LABEL_POST_FLAIR, context, { flair: details.flairText }) );
        }

        // Content Warnings (NSFW/Spoiler)
        if (details.contentWarning && (publicShowContentWarning || !isPublic)) {
            contentLines.push( await TranslationHelper.t(TranslationKey.LABEL_WARNING, context, { warning: details.contentWarning }) );
        }

        // Crosspost Info
        if (details.isCrossPost) {
            const crosspostLine = await TranslationHelper.t(TranslationKey.LABEL_CROSSPOST, context, {
                sub: details.crossPostSubredditName || 'unknown',
                url: details.crossPostPermalink || '#'
            });
            contentLines.push(crosspostLine);
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
                const parts: string[] = [];
                if (showTotalKarma) {
                    parts.push(await TranslationHelper.t(TranslationKey.KARMA_TOTAL, context, { 
                        val: (details.authorLinkKarma || 0) + (details.authorCommentKarma || 0) 
                    }));
                }
                if (showLinkKarma) {
                    parts.push(await TranslationHelper.t(TranslationKey.KARMA_POST, context, { 
                        val: details.authorLinkKarma || 0 
                    }));
                }
                if (showCommentKarma) {
                    parts.push(await TranslationHelper.t(TranslationKey.KARMA_COMMENT, context, { 
                        val: details.authorCommentKarma || 0 
                    }));
                }
                
                const header = await TranslationHelper.t(TranslationKey.KARMA_GLOBAL_HEADER, context);
                karmaParts.push(`${header} ${parts.join(' / ')}`);
            }
        
            // --- 2. Subreddit Karma ---
            if (showTotalSubKarma || showLinkSubKarma || showCommentSubKarma) {
                const parts: string[] = [];
                if (showTotalSubKarma) {
                    parts.push(await TranslationHelper.t(TranslationKey.KARMA_TOTAL, context, { 
                        val: (details.authorSubredditLinkKarma || 0) + (details.authorSubredditCommentKarma || 0) 
                    }));
                }
                if (showLinkSubKarma) {
                    parts.push(await TranslationHelper.t(TranslationKey.KARMA_POST, context, { 
                        val: details.authorSubredditLinkKarma || 0 
                    }));
                }
                if (showCommentSubKarma) {
                    parts.push(await TranslationHelper.t(TranslationKey.KARMA_COMMENT, context, { 
                        val: details.authorSubredditCommentKarma || 0 
                    }));
                }
        
                const header = await TranslationHelper.t(TranslationKey.KARMA_SUB_HEADER, context);
                karmaParts.push(`${header} ${parts.join(' / ')}`);
            }

            if (karmaParts.length > 0) {
                cardComponents.push(this.createText(karmaParts.join('\n')));
                cardComponents.push(this.createDivider());
            }
        }

        // Moderation (Status & Actions)
        if (!isPublic) {
            const modLines: string[] = [];
        
            // 1. Status & Action Line
            const { statusText, actionText } = await this.getStatusDetails(status, context);
            const showRemovedBy = (status === ItemState.Removed || status === ItemState.Awaiting_Review || status === ItemState.Spam) && details.removedBy;
        
            if (showRemovedBy) {
                modLines.push(await TranslationHelper.t(TranslationKey.STATUS_LINE_WITH_BY, context, {
                    status: statusText,
                    action: actionText,
                    user: details.removedBy!
                }));
            } else {
                modLines.push(await TranslationHelper.t(TranslationKey.STATUS_LINE_SIMPLE, context, {
                    status: statusText,
                    action: actionText
                }));
            }
        
            // 2. Reports Logic
            if (details.reportCount || (details.reportReasons && details.reportReasons.length > 0)) {
                const count = details.reportCount || 0;
                const reasons = details.reportReasons?.join(', ').substring(0, 100);
        
                if (reasons) {
                    modLines.push(await TranslationHelper.t(TranslationKey.LABEL_REPORTS_WITH_REASONS, context, {
                        count,
                        reasons
                    }));
                } else {
                    modLines.push(await TranslationHelper.t(TranslationKey.LABEL_REPORTS_COUNT_ONLY, context, {
                        count
                    }));
                }
            }
        
            // 3. Removal Reason
            if (details.removalReason) {
                modLines.push(await TranslationHelper.t(TranslationKey.LABEL_REMOVAL_REASON, context, {
                    reason: details.removalReason.substring(0, 200)
                }));
            }
        
            // Output to Card
            if (modLines.length > 0) {
                cardComponents.push(this.createText(modLines.join('\n')));
                cardComponents.push(this.createDivider());
            }
        }

        // FOOTER: Subreddit & Time
        const timestamp = Math.floor(new Date(details.createdAt).getTime() / 1000);
        cardComponents.push(this.createText( await TranslationHelper.t(TranslationKey.LABEL_PERMALINK_FOOTER, context, { sub: details.subredditName, time: timestamp })));

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
            label: details.type === 'comment' ? await TranslationHelper.t(TranslationKey.BUTTON_COMMENT, context) : await TranslationHelper.t(TranslationKey.BUTTON_POST, context),
            url: details.permalink
        });

        if (!isPublic && status !== ItemState.Deleted) {
            if (showAuthorButton) buttons.push({
                id: this.generateRandomId(), type: 2, style: 5,
                label: await TranslationHelper.t(TranslationKey.BUTTON_AUTHOR, context), url: `https://www.reddit.com/user/${details.authorName}`
            });
            if (showArcticShift) buttons.push({
                id: this.generateRandomId(), type: 2, style: 5,
                label: await TranslationHelper.t(TranslationKey.BUTTON_ARCTIC_SHIFT, context), url: `https://arctic-shift.photon-reddit.com/search?fun=posts_search&author=${details.authorName}&limit=10&sort=desc`
            });
        }

        if (channelType == ChannelType.ModQueue && showModQueueButton) {
            buttons.push({
                id: this.generateRandomId(),
                type: 2, style: 5,
                label: await TranslationHelper.t(TranslationKey.BUTTON_OPEN_QUEUE, context),
                url: `https://www.reddit.com/mod/${details.subredditName}/queue`
            });
        }

        rootComponents.push({
            type: 1,
            id: this.generateRandomId(),
            components: buttons
        });

        let finalAvatarUrl: string | undefined;

        if (isPublic && publicShowIcon) {
            finalAvatarUrl = APP_ICON_URL;
        } else if (!isPublic && privateShowIcon) {
            finalAvatarUrl = APP_ICON_URL;
        }

        return {
            flags: 32768,
            components: rootComponents,
            embeds: [],
            content: '',
            avatar_url: finalAvatarUrl
        };
    }

    static async createModMailMessage(subject: string, conversationId: string, initialMessage: any, status: ItemState, context: TriggerContext, pingableMessage?: string): Promise<ComponentPayload> {
        const showArcticShift = await context.settings.get('MODMAIL_SHOW_ARCTIC_SHIFT_BUTTON') as boolean || false;
        const showIcon = await context.settings.get('MODMAIL_SHOW_DEFAULT_ICON') as boolean || false;
        const color = await UtilityManager.getColorFromState(status, context);
        const statusText = await UtilityManager.getStatusTextModMail(status, context);

        const rootComponents: ComponentV2[] = [];

        const cardComponents: ComponentV2[] = [];

        if (pingableMessage) {
            rootComponents.push(this.createText(pingableMessage));
        }

    cardComponents.push(this.createText( "### " + await TranslationHelper.t(TranslationKey.MODMAIL_SUBJECT_HEADER, context, { subject: subject })));

        let body = initialMessage?.bodyMarkdown || await TranslationHelper.t(TranslationKey.TEXT_NO_CONTENT, context);
        if (body.length > 500) body = body.substring(0, 490) + '...';
        cardComponents.push(this.createText(body));

        cardComponents.push(this.createDivider());

        const userName = initialMessage?.author?.name || await TranslationHelper.t(TranslationKey.TEXT_NO_USERNAME, context);
        const userPart = await TranslationHelper.t(TranslationKey.LABEL_META_USER, context, { user: userName });
        const statusPart = await TranslationHelper.t(TranslationKey.LABEL_META_STATUS, context, { status: statusText });
        const idPart = await TranslationHelper.t(TranslationKey.LABEL_META_ID, context, { id: conversationId });
        const sep = await TranslationHelper.t(TranslationKey.META_SEPARATOR, context);
        const metaLine = [ userPart, statusPart, idPart ].join(sep);
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
            label: await TranslationHelper.t(TranslationKey.BUTTON_OPEN_MODMAIL, context),
            url: `https://mod.reddit.com/mail/all/${conversationId}`
        });

        buttons.push({
            id: this.generateRandomId(),
            type: 2,
            style: 5,
            label: await TranslationHelper.t(TranslationKey.BUTTON_AUTHOR_MODMAIL, context),
            url: `https://www.reddit.com/user/${initialMessage?.author?.name}`
        });

        if (showArcticShift) {
            buttons.push({
                id: this.generateRandomId(),
                type: 2,
                style: 5,
                label: await TranslationHelper.t(TranslationKey.BUTTON_ARCTIC_SHIFT, context),
                url: `https://arctic-shift.photon-reddit.com/search?fun=posts_search&author=${initialMessage?.author?.name}&limit=10&sort=desc`
            });

        }
        
        rootComponents.push({
            type: 1,
            id: this.generateRandomId(),
            components: buttons
        });

        let finalAvatarUrl: string | undefined;

        if (showIcon) {
            finalAvatarUrl = APP_ICON_URL;
        }

        return {
            flags: this.FLAGS_COMPONENTS_V2,
            components: rootComponents,
            embeds: [],
            content: '',
            avatar_url: finalAvatarUrl
        };
    }

    static async createModMailReply(message: any, isModerator: boolean, context: TriggerContext): Promise<ComponentV2[]> {
        const components: ComponentV2[] = [];

        components.push(this.createDivider());

        const accentColor = isModerator ? 0x2ECC71 : 0xE67E22;
        const authorName = message.author?.name || await TranslationHelper.t(TranslationKey.TEXT_NO_USERNAME, context);
        const authorPrefix = isModerator ? await TranslationHelper.t(TranslationKey.MODMAIL_MOD_REPLIED, context) : await TranslationHelper.t(TranslationKey.MODMAIL_USER_REPLIED, context, { user: authorName });

        const replyContainerComponents: ComponentV2[] = [];
        replyContainerComponents.push(this.createText("### " + authorPrefix));

        let body = message.bodyMarkdown || await TranslationHelper.t(TranslationKey.TEXT_NO_CONTENT, context);
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
        const statusText = await UtilityManager.getStatusTextModMail(newState, context);

        const mainContainer = existingComponents.find(c => c.type === 17);

        if (!mainContainer || !mainContainer.components) {
            console.warn('[ComponentManager] Could not find main container to update state.');
            return existingComponents;
        }

        mainContainer.accent_color = color;

        const statusLabel = await TranslationHelper.t(TranslationKey.LABEL_META_STATUS, context);
        const statusLabelClean = statusLabel.replace("{{status}}", "").trim();
        const separator = await TranslationHelper.t(TranslationKey.META_SEPARATOR, context);

        const metaComponent = mainContainer.components.find(c => c.content && c.content.includes(statusLabelClean));

        if (metaComponent && metaComponent.content) {

            const escapedLabel = statusLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const regex = new RegExp(`${escapedLabel}(.*?)( ${escapedSep}|$)`);

            metaComponent.content = metaComponent.content.replace(
                regex,
                `${statusLabel}${statusText}$2`
            );
        }

        return existingComponents;
    }

    static async updateModMailBody(existingComponents: ComponentV2[], newBodyText: string, context: TriggerContext): Promise<ComponentV2[]> {
        const updatedComponents: ComponentV2[] = JSON.parse(JSON.stringify(existingComponents));

        // 1. Find the Main Container (First Type 17)
        const mainContainer = updatedComponents.find((c: ComponentV2) => c.type === 17);

        if (!mainContainer || !mainContainer.components) return updatedComponents;

        const userPart = await TranslationHelper.t(TranslationKey.LABEL_META_USER, context, { user: '' });

        // 2. Find the Body Text Component
        const bodyComponent = mainContainer.components.find((c: ComponentV2) =>
            c.type === 10 &&
            c.content &&
            !c.content.startsWith('###') &&
            !c.content.includes(userPart)
        );

        if (bodyComponent && bodyComponent.content) {
            let additionalContent = newBodyText || await TranslationHelper.t(TranslationKey.TEXT_NO_CONTENT, context);

            // Separator for the appended message
            const separator = "\n\n";
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