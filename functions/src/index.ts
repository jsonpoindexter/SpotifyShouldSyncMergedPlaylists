'use strict'
import { firestore } from 'firebase-admin/lib/firestore'
import * as functions from 'firebase-functions'
import * as express from 'express'
import * as cookieParser from 'cookie-parser'
import * as admin from 'firebase-admin'
import * as serviceAccount from './service-account.json'
import * as corsModule from 'cors'
import { validateFirebaseIdToken } from './utils/firebase'
import { checkSchema } from 'express-validator'
// import { Timestamp } from 'firebase-admin/lib/firestore'

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  }),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
})
export const db = admin.firestore()

// Controllers
import * as spotifyAuthController from './controllers/spotifyAuth'
import * as spotifyPlaylistController from './controllers/spotifyPlaylists'
import { SyncPlaylist } from './models/syncPlaylist'
import { isUnique } from './utils/general'
import { SpotifyClient } from './utils/spotifyClient'
import { Playlist } from './types/spotify'
import Timestamp = firestore.Timestamp

export const BASE_URL =
  process.env.FUNCTIONS_EMULATOR === 'true'
    ? 'http://localhost:5001/spotify-should-sync-merged-pla/us-central1/app'
    : 'https://us-central1-spotify-should-sync-merged-pla.cloudfunctions.net/app'

console.log(`BASE_URL: ${BASE_URL}`)

const cors = corsModule({ origin: true })

const app = express()
app.use(cors)
app.use(cookieParser())
app.use(express.json())
app.get('/', (req, res) => res.send())
app.get('/auth/spotify/redirect', spotifyAuthController.getRedirect)
app.get('/auth/spotify/callback', spotifyAuthController.getCallback)
app.get(
  '/spotify/playlists',
  validateFirebaseIdToken,
  spotifyPlaylistController.getAllPlaylists,
)
app.post(
  '/spotify/playlists/combine',
  validateFirebaseIdToken,
  checkSchema(
    {
      name: {
        isString: true,
        isLength: { options: { min: 0, max: 100 } },
        notEmpty: true,
      },
      playlistIds: {
        isArray: { options: { min: 1, max: 10 } }, // TODO: enforce client side
        notEmpty: true,
      },
      description: {
        isString: true,
        isLength: { options: { max: 300 } },
        optional: true,
      },
    },
    ['body'],
  ),
  spotifyPlaylistController.postCombinePlaylists,
)

exports.app = functions.https.onRequest(app)

// exports.syncFunction = functions.pubsub
//   .schedule('every day a 00:00')
//   .onRun((context) => console.log('This will run!'))

// exports.syncFunction = functions.pubsub
//   .schedule('every 10 seconds')
//   .onRun((context) => onSyncPlaylists())

const onSyncPlaylists = async () => {
  // Get all syncPlaylists from firestore
  const collectionMap = await SyncPlaylist.getCollection()
  // For each syncedPlaylist collection:
  for (const [userId, syncPlaylistMap] of Object.entries(collectionMap)) {
    // console.log(syncPlaylistMap)
    //  For each key:value in collection:
    const spotifyClient = await new SpotifyClient(userId)
    for (const {
      sourcePlaylists,
      lastSynced,
      destinationPlaylist,
    } of Object.values(syncPlaylistMap)) {
      // fetch current sourceePlaylists.snapshot_id from spotify is
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
      const currentDestinationPlaylist = await spotifyClient.getPlaylist(
        destinationPlaylist.id,
        'id,uri,snapshot_id,tracks.items(added_at,track(uri))',
      )

      // If there are no changed current sourcePlaylists AND the current destinationPlaylist hasn't changed then we can return
      if (
        !changedSourcePlaylists.length &&
        destinationPlaylist.snapshot_id ===
          currentDestinationPlaylist.snapshot_id
      )
        return

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
        .filter((track) => {
          console.log(Timestamp.fromDate(new Date(track.added_at)), lastSynced)
          return Timestamp.fromDate(new Date(track.added_at)) > lastSynced
        })
        .map((track) => track.uri)
      console.log('Add Tracks: ', addTrackIds)
      try {
        while (addTrackIds.length > 0) {
          await spotifyClient.addItemsToPlaylist(
            destinationPlaylist.id,
            addTrackIds.splice(0, 100),
          )
          // TODO: update lastSync and snapshotId
        }
      } catch (error) {
        console.log(
          `Error adding tracks to playlist ${destinationPlaylist.id}`,
          error,
        )
      }

      // Extract tracks to remove from destination playlist (tracks that are present in the destination playlist but not in the source playlists)
      const sourceTrackIds = sourceTracks.map((track) => track.uri)
      const destinationTrackIds = currentDestinationPlaylist.tracks.items.map(
        (track) => ({ uri: track.track.uri }),
      )
      const deleteTracks = destinationTrackIds.filter(
        (destinationTrackId) =>
          !sourceTrackIds.includes(destinationTrackId.uri),
      )
      console.log('Delete tracks: ', deleteTracks)
      try {
        while (deleteTracks.length > 0) {
          await spotifyClient.removeItemsFromPlaylist(
            destinationPlaylist.id,
            deleteTracks.splice(0, 100),
          )
        }
        // TODO: update lastSync and snapshotId
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
;(async () => onSyncPlaylists())()
