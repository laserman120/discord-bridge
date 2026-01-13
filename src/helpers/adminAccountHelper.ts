const ADMIN_ACCOUNTS = new Set([
    'anti_evil_ops',
    'anti_evil ops',
    'anti_evil operations',
    'modcodeofconduct',
    'reddit_legal',    
    'reddit legal', 
    'aevo',             
    'safety',   
    '[ redacted ]',
]);

export function isAdminAccount(username?: string): boolean {
    if (!username) return false;
    return ADMIN_ACCOUNTS.has(username.toLowerCase());
}