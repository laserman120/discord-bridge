
# Discord-Bridge

An app to help bridge the gap between reddit and discord. 
Making at easy to keep track of anything related to your subreddit directly from your discord server.

![Preview Gif](https://raw.githubusercontent.com/laserman120/discord-bridge/262e0344fe9f93b9fa9f374be2c0b0f0012fc63a/assets/Discord-Bridge_Preview.gif)

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
---

## Detailed Explanation of Features and Configuration

- **Before installing it is highly recommended to check out the Wiki pages here:** [Discord Bridge Wiki](https://github.com/laserman120/discord-bridge/wiki)
- These pages contain detailed explanations of each feature, as well as configuration instructions and examples.

---

# This app is still in development!

- It is likely that bugs or incorrectly identified events may occur.
- If you run into any issues feel free to let me know.
- The app will never perform any action on your subreddit, it is read-only by design.

---

## Changelog
- v0.0.59
  - Complete rework of the message system, to improve visibility and maintainability.
	- This should generally also allow more customization as well as more fields.
	- The title hyperlink was replaced with dedicated buttons
  - Added Update and News notification systems.
	- These will create a new modmail conversation to notify users of new update or general news regarding the app
	- These can be disabled in the settings if desired.
  - Added new ModQueue stream, which will mirror the mod queue of your subreddit.
	- Unlike the other streams, items that have been handled will be completely deleted from the discord channel.
  - Improved Mod Mail handling, which will now update to show messages sent back to back
	- This has a character limit to avoid hitting discords size constraints.
  - Added settings to further adjust how public messages are displayed.
  - Added setting to add an additional button to open a user profile with Arctic-Shifts User Info.
  - Added a setting to remove the author button.
  - Added setting to ignore specific authors of modmails, useful for bot messages that are less important.
  - Added setting to ignore moderator removals in the removal stream.
  - Added setting to ignore removals of specific authors. (For example when a comment by AutoModerator is removed by a moderator)
  - Fixed message data not updating if the author changes a post to or from spoiler or nsfw.
  - Fixed message data not updating if the author changes a post flair. 
  - Fixed messages not updating correctly in certain situations if the action was performed too quickly after automatic removal.
- v0.0.50
  - Reduced reddit api usage
  - Fixed an issue that could lead to missed deletions
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