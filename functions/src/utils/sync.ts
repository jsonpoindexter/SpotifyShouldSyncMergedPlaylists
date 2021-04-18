import { firestore } from 'firebase-admin/lib/firestore'
import { SyncPlaylist } from '../models/syncPlaylist'
import { Playlist } from '../types/spotify'
import logger from './logger'
import { SpotifyClient } from './spotifyClient'
import Timestamp = firestore.Timestamp

/**
 * Iterate through all user created sync playlists and syn source playlists into the destination playlist (one way)
 * @returns {Promise<void>}
 */
export const onSyncPlaylists = async (): Promise<void> => {
  // Get all syncPlaylists mappings from firestore
  const collectionMap = await SyncPlaylist.getCollection()
  // For each syncedPlaylist collection:
  for (const [userId, syncPlaylistMap] of Object.entries(collectionMap)) {
    logger.debug(`Starting sync for ${userId}`)
    const spotifyClient = await new SpotifyClient(userId)
    for (const {
      sourcePlaylists,
      lastSynced,
      destinationPlaylist,
    } of Object.values(syncPlaylistMap)) {
      logger.debug(`Fetching destination playlist ${destinationPlaylist.id}`)
      // Fetch the destination playlist
      const currentDestinationPlaylist = await spotifyClient.getPlaylist(
        destinationPlaylist.id,
        'id,uri,followers,snapshot_id,tracks.items(added_at,track(uri))',
      )
      logger.debug(currentDestinationPlaylist)
      // If its been deleted then remove the firestore sync playlist entry

      // fetch current sourcePlaylists.snapshot_id from spotify is
      const currentSourcePlaylists: Playlist[] = await Promise.all(
        sourcePlaylists.map((playlist) =>
          spotifyClient.getPlaylist(
            playlist.id,
            'id,uri,snapshot_id,tracks.items(added_at,track(uri))',
          ),
        ),
      )

      //  Find source playlists that have been updated (their snapshot id's will not be the same)
      const changedSourcePlaylists = currentSourcePlaylists.filter(
        (changedPlaylist) =>
          !sourcePlaylists
            .flatMap((playlist) => playlist.snapshot_id)
            .includes(changedPlaylist.snapshot_id),
      )

      // If there are no changed current sourcePlaylists return
      if (!changedSourcePlaylists.length) return

      // Parse unique tracks from changed source playlists
      const sourceTracks = changedSourcePlaylists
        .flatMap((currentVal) => currentVal.tracks.items)
        .map((track) => ({ uri: track.track.uri, added_at: track.added_at }))
        .reduce<{ added_at: Date; uri: string }[]>( // Unique TODO:make sure this works
          (accumulator, current) =>
            accumulator.some((item) => item.uri === current.uri)
              ? accumulator
              : [...accumulator, current],
          [],
        )

      // Extract tracks to add to destination playlist (tracks that were added after the last sync date)
      const addTrackIds = sourceTracks
        .filter(
          (track) => Timestamp.fromDate(new Date(track.added_at)) > lastSynced,
        )
        .map((track) => track.uri)
      try {
        let snapshotId = ''
        while (addTrackIds.length > 0) {
          snapshotId = (
            await spotifyClient.addItemsToPlaylist(
              destinationPlaylist.id,
              addTrackIds.splice(0, 100),
            )
          ).snapshot_id
        }
        if (snapshotId)
          await SyncPlaylist.updateSnapshotId(
            userId,
            destinationPlaylist.id,
            snapshotId,
          )
      } catch (error) {
        console.log(
          `Error adding tracks to playlist ${destinationPlaylist.id}`,
          error,
        )
      }

      // Extract tracks to remove from destination playlist (tracks that are present in the destination playlist but not in the source playlists)
      const sourceTrackIds = sourceTracks.map((track) => track.uri)
      const destinationTrackIds = currentDestinationPlaylist.tracks.items.map(
        (track) => track.track.uri,
      )

      const deleteTracks = destinationTrackIds.filter(
        (destinationTrackId) => !sourceTrackIds.includes(destinationTrackId),
      )

      if (deleteTracks.length) {
        try {
          let snapshotId = ''
          while (deleteTracks.length > 0) {
            snapshotId = (
              await spotifyClient.removeItemsFromPlaylist(
                destinationPlaylist.id,
                deleteTracks.splice(0, 100),
              )
            ).snapshot_id
          }
          if (snapshotId)
            // Dont think this is technically necessary
            await SyncPlaylist.updateSnapshotId(
              userId,
              destinationPlaylist.id,
              snapshotId,
            )
        } catch (error) {
          if (error.isAxiosError) {
            console.log('Error removing tracks from playlist', error.message)
            console.log(error)
          } else {
            console.log('Error removing tracks from playlist', error)
          }
        }
      }
    }
  }
}
