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
                    statusText: '🔴 Removed',
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

    private static generateRandomId(): number {
        return Math.floor(Math.random() * 1000000000);
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
        const hideNsfwBody = await context.settings.get('NEW_PUBLIC_POST_HIDE_NSFW_BODY') as boolean || false;
        const hideSpoilerBody = await context.settings.get('NEW_PUBLIC_POST_HIDE_SPOILER_BODY') as boolean || false;
        const hideNsfwImage = await context.settings.get('NEW_PUBLIC_POST_HIDE_NSFW_IMAGE') as boolean || false;
        const hideSpoilerImage = await context.settings.get('NEW_PUBLIC_POST_HIDE_SPOILER_IMAGE') as boolean || false;
        const hideAuthorPublic = await context.settings.get('PUBLIC_POST_HIDE_AUTHOR') as boolean || false;
        const hideFlairPublic = await context.settings.get('PUBLIC_POST_HIDE_FLAIR') as boolean || false;
        const hideContentWarningPublic = await context.settings.get('PUBLIC_POST_HIDE_CONTENT_WARNING') as boolean || false;

        const addArcticShift = await context.settings.get('PRIVATE_POST_ADD_ARCTIC_SHIFT') as boolean || false;
        const hideAuthorButton = await context.settings.get('PRIVATE_HIDE_DEFAULT_AUTHOR') as boolean || false;

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
        const shouldHideImage = (details.isNSFW && hideNsfwImage && isPublic) || (details.isSpoiler && hideSpoilerImage && isPublic);
        if (shouldHideImage) {
            imageUrl = undefined;
        }

        let bodyContent = '';
        if (details.isNSFW && hideNsfwBody && isPublic) {
            bodyContent = '*[Hidden due to potential NSFW content]*';
        } else if (details.isSpoiler && hideSpoilerBody && isPublic) {
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

        if (hideAuthorPublic && status == ItemState.Public_Post) {
            // Skipped due to hidden
        } else {
            addField('Author', `u/${details.authorName}`);
        }
        

        if (status !== ItemState.Public_Post) {
            if (status === ItemState.Removed || status === ItemState.Awaiting_Review && details.removedBy) {
                addField('Last Action', `${actionText} by ${details.removedBy}`);
            } else {
                addField('Last Action', `${actionText}`);
            }
        }

        if (details.flairText) {
            if (hideFlairPublic && status == ItemState.Public_Post) {
                // Skipped due to hidden
            } else {
                addField('Flair', details.flairText);
            } 
        }

        if (details.contentWarning) {
            if(hideContentWarningPublic && status == ItemState.Public_Post) {
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

        if (status !== ItemState.Public_Post && status !== ItemState.Deleted && !hideAuthorButton) {
            buttons.push({
                id: this.generateRandomId(),
                type: 2,
                style: 5,
                label: "Author",
                url: `https://www.reddit.com/user/${details.authorName}`
            });
        }

        if (status !== ItemState.Public_Post && status !== ItemState.Deleted && addArcticShift) {
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
    }

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