export enum ItemState {
    Live = 'LIVE',
    Removed = 'REMOVED',
    Approved = 'APPROVED',
    Deleted = 'DELETED',
    Spam = 'SPAM',
    Awaiting_Review = 'AWAITING_REVIEW',
    Unhandled_Report = 'UNHANDLED_REPORT',
    Public_Post = 'PUBLIC_POST',
    New_Modmail = 'NEW_MODMAIL',
    Answered_Modmail = 'ANSWERED_MODMAIL',
    New_Reply_Modmail = 'NEW_REPLY_MODMAIL',
    Archived_Modmail = 'ARCHIVED_MODMAIL',
}

export enum ChannelType {
    PublicNewPosts = 'PUBLIC_NEW_POSTS_CHANNEL',
    NewPosts = 'NEW_POSTS_CHANNEL',
    Reports = 'REPORTS_CHANNEL',
    Removals = 'REMOVALS_CHANNEL',
    ModMail = 'MODMAIL_CHANNEL',
    ModLog = 'MODLOG_CHANNEL',
    FlairWatch = 'FLAIR_WATCH_CHANNEL',
    PublicFlairWatch = 'PUBLIC_FLAIR_WATCH_CHANNEL',
}
export enum ContentType {
    Post = 'POST',
    Comment = 'COMMENT',
    Modmail = 'MODMAIL',
}