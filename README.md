# Spotify Should Sync Merged Playlists
## App will allow users to combine two or more playlists into a single playlists and keep the playlist synced
      
## Top Level Requirements
### Firebase
Running firebase functions on trigger and schedule
* AddUser() -> triggered on spotify user access approval (playlist read/write): adds user profileId:token to firestore
* CombinePlaylists () -> Triggered on user request to combine two or more playlists, add list of source playlists anbd destination playlist ids to firebase
* Scheduler() -> runs 1x a day to go through user profiles / playlists and runs CombinePlaylists
### Firestore
Storing user data
* Profile: Spotify.profileId:userToken
* CombinedPlaylists: Spotify.profileId:JSON.stringify({source.playlistId:destination.playlistId[]})

## App Flow
1. User Access
   * User will need to approve app to access their playlists (read/write)
      * add user's token to firestore: profileId:token
2. If user is approved they need to provide:
   * source playlist Ids array
   * destination playlist name
3. Firebase combine playlists function will 
   ^ Fetch profileId:token from firestore
   * Fetch songs in source playlists array
   * Create destination playlist (if name doesnt exists)
   * Add source playlist songs to destination (shuffle?)
4. Setup recurring tasks to trigger firebase function (will require story spotify access token for refresh)
   * For each profileId:token in fire store: Run combine function
   

## ToDo
[ ] Optimize combining playlists so that (possibly some sort of playlist or song 'lastModified') 
[ ] On first user req to combine playlist Error out on destination playlist already exists
[ ]
