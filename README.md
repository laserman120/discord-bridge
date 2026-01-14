
# Discord-Bridge

An app to help bridge the gap between reddit and discord. 
Making at easy to keep track of anything related to your subreddit directly from your discord server.

---

## Features

- Automatic notifications for a variety of events:
  - New posts
  - Removals, as well as why the removal occured
  - Spam removals
  - Reports
  - ModMail
  - ModLog
  - Posts made with specific flairs
  - Comments/Posts made by users with specific flairs
  - Possible Moderator Abuse detection
  - Comments/Posts made by moderators

- State Aware Messages:
  -  Every post / comment / ModMail has a state it can be in, a few examples would be:
	  -  Live (Visible to everyone)
	  - Approved (Approved by a moderator)
	  - Removed (Removed by a moderator)
	  - Automated Removal (Removed by AutoMod or similar)
	  - Deleted ( Deleted by the author or reddit)
	  - ...
  - If a post is approved/removed/deleted or similar all private messages related to the post or comment will update to reflect the current state
  - ModMail notifications will update when replied or when archived

| New Post Notification | Same Message after removal |
| :---: | :---: |
| ![New Post](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/NewPost.png) | ![Same Message after removal](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/NewPostUpdated.png) |

---	

## Basic Setup and Configuration

- To learn how to create a webhook URL, check out the official [Intro to Webhooks (Discord Support)](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)

- If you want to ping a specific user or role in custom messages you can use this format:
 	- User: `<@USER__ID>`
	- Role: `<@&ROLE__ID>`

- **Any feature will only become active once a valid Discord webhook URL is provided for that feed type.**
- Pingable notification messages are **optional** and can be left empty if not desired.

	![Basic Setup Example](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/Settings.png)

- Embed colors can be customized by providing a hex color code (eg. #FF0000 for red). If left empty a default color will be used.
- These colors represent the state of an item, for example a new post will use the "Live" color, while a removed post will use the "Removed" color.

	![Embed Color Customization](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/SettingsAppearance.png)

---

## Detailed Feature Information

- Public New Posts
	- This feed is designed to be used in public discord servers.
	- Posts that are no longer public (removed, deleted, filtered) will have their messages **deleted**.
	- Posts that were automatically filtered or removed will **not** show up in this feed at all.
	- If a post becomes approved after being filtered or removed at any point, it will be **resent**.
	- Public messages will never show any information regarding moderation.

	![Public Message Example](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/NewPostPublic.png)
	
	- To protect your discord community from potential spoilers or nsfw content you can configure how these cases should be handled.
	![Public Message Settings](https://raw.githubusercontent.com/laserman120/discord-bridge/f1bd36a62e3560c34831008d496eeefaf1f63d5c/assets/PublicPostSettings.png)
	- For each case you can select if the image should be shown or hidden, as well as the content body, which is the text part of a post.
		
- Private New Posts
	- This feed is designed to be used in **private moderator discord servers/channels**.
	- All new posts will be sent here, regardless of their state.
	- If a post is later removed or deleted, the message will update to reflect that.
	- It also contains moderatory information, including last action performed on that item, who performed that action and any removal reason provided if one exists.
	- This feed is ideal for keeping track of all new posts and their current state.

| Public Post Feed | Normal Post Feed |
|--|--|
| Will not show any moderation information | Will update to show the last action |
| Will be deleted if the post is removed | Will update to show the removal |
| Can hide information for Spoiler or NSFW posts | Will always show all post data |
| Will be deleted on post deletion | Will update to show deletion |
	
- Removals
	- This feed will notify you of any removals that occur in your subreddit.
	- Removal Types
		- There are 3 different removal types, each with their own pingable notification field:
			- Moderator Removal
			- Automatic Removal (AutoModerator)
			- Admin Removal (Similar to AdminTattler)
	- It will specify the type of removal (Moderator, AutoModerator, Admin) as well as who performed the removal and any reason provided.
	- If a removal is later reversed (approved) the message will update to reflect that change.
	- Depending on which type of removal occured the message color as well as the pingable notification text will be chosen accordingly.
	- This is an example for a post removed due to the Reputation Filter, as reddit is selected to be treated as automatic it will have its color and message set accordingly.

	![Removal Example](https://raw.githubusercontent.com/laserman120/discord-bridge/refs/heads/main/assets/PortAutoRemovalReputationMasked.png)
		
	- You can select which type of automated user is marked as "Automatic". So if you trust a removal by certain bots you can have them marked as moderator removals instead of automatic.

	![Removal User Selector](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/SettingsAutomaticUsers.png)
	
	- If you have an app that is capable of performing removals and you want to have those removals marked as automatic, you can simply add the app's username to the list.

	- Notes regarding Admin Removals:
		- Admin removals are removals performed by reddit administrators, usually for rule violations of reddit itself.
		- These will only create a new message if the post/comment was not already removed by a moderator or automatically.
		- If a post/comment is already removed by a moderator or automatically, and then later removed by an admin, the message will update to reflect the admin removal instead of creating a new message.
		- This behavior is different from apps like AdminTattler, which will always show you that an admin removal occured, even if the post/comment was already removed.
	
- Reports
	- This feed will notify you of any reports that occur in your subreddit.
	- It will specify what was reported (post or comment) and the reason provided.
	- If the reported item is later removed or deleted, the message will update to reflect that change.
	- Each report will generate its own message, so multiple reports on the same item will create multiple notifications.

	![Report Example](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/NewPostReport.png)
	 
- ModMail
	- This feed will notify you of any new ModMail conversations as well as replies to existing conversations.
	- It will specify who sent the message (user or moderator) and the content of the message.
	- If a conversation is archived, the message will update to reflect that change.
	- For simplicity and size reasons, only the latest message in a conversation will be shown in the notification.
	
| New Mod Mail Notification | The same notification after a moderator replied |
| :---: | :---: |
| ![New Mod Mail](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/ModMailNew.png) | ![Replied by a moderator](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/ModMailReply.png) |
 
- ModLog
	- This feed will notify you of any ModLog actions that occur in your subreddit.
	- You can select which ModLog actions will trigger a notification, allowing you to mute less relevant actions.

	![Mod Log Selector](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/SettingsModLogSelector.png)
		
	- You can use the custom modlog message system to specify specific messages when specific mod actions occur.
	- For flexibility this is a json strcture, but you can use pings the same way as in other notification messages.

	![ModLog CustomMessages](https://raw.githubusercontent.com/laserman120/discord-bridge/62e9f69ec8b898da4d2ae03d7e42d886a126e6dd/assets/CustomModLogMessage.png)

	- Each entry requires:
		- action    -  The modlog action that will trigger this custom message.
		- message   -  The message to send when this action occurs.

- Flair Watching
	- This feed will notify you of any posts or comments made by users with specific flairs, or posts with specific flairs.
	- To allow you an arbitrary amount of flairs to watch for this is in the form of a json configuration.
	![Flair Watching Example](https://raw.githubusercontent.com/laserman120/discord-bridge/6ba749aa5069cde1a01995e2ab80a2b5d61bb42d/assets/FlairWatchingSettings.png)
	- Each entry requires:
		- flair        -  This is the text that a flair needs to include to trigger a notification.
		- post         -  If enabled, posts with this flair will trigger a notification.
		- comment      -  If enabled, comments made by users with this flair will trigger a notification.
		- webhook      -  The webhook URL to send notifications to.
		- publicFormat -  If enabled, the notification will be sent in the public format, removing any moderation information.

	![Flair Watching Example](https://raw.githubusercontent.com/laserman120/discord-bridge/6ba749aa5069cde1a01995e2ab80a2b5d61bb42d/assets/PostFlairWatching.png)
	- If a flair watch is set to public format, the notification will be deleted if the post/comment is no longer public (removed, deleted, filtered).
	
- Moderator Watching
	- This feed will notify you of any new posts or comments made by moderators.
	- You can set this to either react to posts/comments or both.

	![Moderator Watching System Settings](https://raw.githubusercontent.com/laserman120/discord-bridge/77d6e97da760a41b7a41fed36bafc1a07e25982c/assets/ModeratorWatchingSettings.png) 
	
- Mod Abuse Warning System
	- This system will trigger a notification if a moderator performs **too many actions in a set period of time**.
	- You can configure the amount of actions, the time period, as well as the types of actions that should be monitored.
	- This is designed to help catch potential mod abuse early on.

	![Mod Abuse Warning System](https://raw.githubusercontent.com/laserman120/discord-bridge/62e9f69ec8b898da4d2ae03d7e42d886a126e6dd/assets/ModAbuseWarningSystemSettings.png)

---	

## This app will respect deletions

- This means that if a **post is deleted**, the corresponding message data in discord will be **replaced**.
- This includes the author of the post or comment, as well as the message body.
- To ensure no messages can be missed for any reason the app will delete sent messages after 13 days.

	![Deleted Message](https://raw.githubusercontent.com/laserman120/discord-bridge/7911dd9c27a6d9ef20fcf38abfcb6830af0aeb52/assets/NewPostDeletion.png)

---

# This app is still in development!

- It is likely that bugs or incorrectly identified events may occur.
- If you run into any issues feel free to let me know.
- The app will never perform any action on your subreddit, it is read-only by design.

---

## Changelog
- v0.0.48
  - Removed Anti-Evil Ops from the list of automatic removal users. These can never be marked as automatic as these are admin removals.
  - Reworked admin removals to now pull from a static list instead of checking for actions by non moderator accounts.
	- This should help avoid false positives. If you want a reliable notification for admin removals use an app like AdminTattler.
  - Potential fix for certain removals not creating a notification
- v0.0.37
  - Fixed an issue which lead to certain removals not creating notifications.
  - Fixed an issue that lead to certain reports appearing twice.
- v0.0.30
  - Added Queue system to hopefully avoid rate limiting as well as issues with the order of execution.
  - Adjusted execution timing to improve stability.
  - Fixed issue with incorrect removal reason being shown.
  - Added more options for automatic removals.
  - Minor fix for mod watching and flair watching not updating correctly upon deletion.
  - Updated Devvit
- v0.0.26
  - Fixed an issue which lead to removal reasons not showing up correctly in certain situations.
  - Added custom user entry field for marking additional apps for automatic removals
- v0.0.25
  - Added caching for certain reddit data to improve performance.
  - Added customizable messages for mod log messages.
  - Added Moderator Abuse warning system.
  - Added Moderator Watching system.
  - Added content warning configurations for public new post feed.
  - Added content warning information to messages.
  - Improved mod mail archival handling.
  - Added update system to update messages when necessary.
	- this includes body updates by the author
	- as well as changes if flair or content warnings
- v0.0.23
  - Hotfix due to an issue with deletions .
- v0.0.21
  - Added Flair Watching feature.
  - Minor fixes and improvements.
  - Updated dependencies.
- v0.0.16
  - Added an additional delay during old message removal to prevent rate limiting on discords end.
  - Added support for crossposts, now displaying if a post is a crosspost and from which subreddit, as well as linking to the original post.
	- It will now also fetch the post body from the original post.
  - Removed the "No Body" text in cases without a message body attached.
  - Hotfix for reports not sending notifications when reported by AutoModerator.
  - Fixed edge case in which a removed comment would be marked as Administrator removal incorrectly.
  - Fixed edge case in which report reasons were not shown correctly in certain situations.
  - Fixed an issue which lead the comment removals showing no moderator name.
  - Fixed issue in which a removed post/comment would be marked as Admin removal if the bot user was deselected from automatic removals.
- v0.0.14
  -	Initial Release.

---

## Important Links:
- [Source Code](https://github.com/laserman120/discord-bridge)
- [Privacy Policy](https://github.com/laserman120/discord-bridge/blob/main/PRIVACY.md)
- [Terms](https://github.com/laserman120/discord-bridge/blob/main/TERMS.md)