import { firestore } from 'firebase-admin/lib/firestore'
import { SyncPlaylist } from '../models/syncPlaylist'
import { Playlist } from '../types/spotify'
import logger from './logger'
import { SpotifyClient } from './spotifyClient'
import Timestamp = firestore.Timestamp

/**
 * Iterate through all user created sync playlists and syn source playlists into the destination playlist (one way)
 * NOTE: currently, if a user deletes a track from the destination playlist the tracks will not be synced from the
 *  source playlists again UNLESS the uses re-adds that song to the source playlist since we are filtering out tracks
 *  that have a added_at time that is greater than the lastSync
 *
 *  NOTE: maybe we should limit how many track add/remove syncs we do per user each run? The current filter() method
 *    for added_at would not work for this
 * @returns {Promise<void>}
 */
export const onSyncPlaylists = async (): Promise<void> => {
  // Get all syncPlaylists mappings from firestore
  const collectionMap = await SyncPlaylist.getCollection()
  logger.debug(`Starting sync for ${Object.keys(collectionMap).length} user(s)`)
  // For each syncedPlaylist collection:
  for (const [userId, syncPlaylistMap] of Object.entries(collectionMap)) {
    logger.debug(
      `[${userId}] Syncing ${
        Object.keys(syncPlaylistMap).length
      } destination playlist(s) to ${
        Object.values(syncPlaylistMap).flatMap(
          (syncPlaylistObj) => syncPlaylistObj.sourcePlaylists,
        ).length
      }`,
    )
    const spotifyClient = await new SpotifyClient(userId)
    for (const {
      sourcePlaylists,
      lastSynced,
      destinationPlaylist,
    } of Object.values(syncPlaylistMap)) {
      logger.debug(
        `[${userId}] Fetching destination playlist ${destinationPlaylist.id}`,
      )
      if (!(await spotifyClient.doesUserHavePlaylist(destinationPlaylist.id))) {
        logger.debug(
          `[${userId}] Playlist ${destinationPlaylist.id} no longer exists on user ${userId}. Removing from firebase...`,
        )
        await SyncPlaylist.deleteOne(userId, destinationPlaylist.id)
        continue
      }

      // Fetch the destination playlist
      const currentDestinationPlaylist = await spotifyClient.getPlaylist(
        destinationPlaylist.id,
        'id,uri,snapshot_id,tracks.items(added_at,track(uri))',
      )
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
      if (!changedSourcePlaylists.length) {
        logger.debug(
          `[${userId}:${destinationPlaylist.id}] No updates to ${sourcePlaylists.length} source playlist(s)`,
        )
        continue
      }

      // Parse unique tracks from changed source playlists
      const newlyAddedSourceTracks = changedSourcePlaylists
        .flatMap((currentVal) => currentVal.tracks.items)
        .map((track) => ({ uri: track.track.uri, added_at: track.added_at }))
        .reduce<{ added_at: Date; uri: string }[]>(
          (accumulator, current) =>
            accumulator.some((item) => item.uri === current.uri)
              ? accumulator
              : [...accumulator, current],
          [],
        )

      // Extract tracks to add to destination playlist (tracks that were added after the last sync date)
      const addTrackIds = newlyAddedSourceTracks
        .filter(
          (track) => Timestamp.fromDate(new Date(track.added_at)) > lastSynced,
        )
        .map((track) => track.uri)
      if (addTrackIds.length) {
        logger.debug(
          `[${userId}] Adding ${addTrackIds.length} track(s) to ${destinationPlaylist.id}`,
        )
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
          if (error.isAxiosError) {
            logger.error(error)
            logger.error(
              `Error removing tracks from playlist: ${error.message}`,
            )
          } else {
            logger.error(`Error removing tracks from playlist: ${error}`)
          }
        }
      }

      // Extract tracks to remove from destination playlist (tracks that are present in the destination playlist but not in the source playlists)
      const sourceTrackIds = currentSourcePlaylists
        .flatMap((currentVal) => currentVal.tracks.items)
        .map((track) => track.track.uri)

      const destinationTrackIds = currentDestinationPlaylist.tracks.items.map(
        (track) => track.track.uri,
      )

      const deleteTracks = destinationTrackIds.filter(
        (destinationTrackId) => !sourceTrackIds.includes(destinationTrackId),
      )

      if (deleteTracks.length) {
        logger.debug(
          `[${userId}] Removing ${deleteTracks.length} track(s) from ${destinationPlaylist.id}`,
        )
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
            logger.error(error)
            logger.error(
              `Error removing tracks from playlist: ${error.message}`,
            )
          } else {
            logger.error(`Error removing tracks from playlist: ${error}`)
          }
        }
      }
    }
  }
  logger.debug('Completed sync')
}
