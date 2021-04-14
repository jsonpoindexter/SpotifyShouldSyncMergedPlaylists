'use strict'
import * as functions from 'firebase-functions'
import * as express from 'express'
import * as cookieParser from 'cookie-parser'
import * as admin from 'firebase-admin'
import * as serviceAccount from './service-account.json'
import * as corsModule from 'cors'
import { validateFirebaseIdToken } from './utils/firebase'
import { checkSchema } from 'express-validator'

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
import {SyncPlaylist,, SyncPlaylistMap SyncPlaylistMap} from './models/syncPlaylist'
import { SpotifyClient } from './utils/spotifyClient'
import { Playlist } from './types/spotify'

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
//
const onSyncPlaylists = async () => {
  // Get all syncPlaylists from firestore
  const collectionMap = await SyncPlaylist.getCollection()
  // For each syncedPlaylist collection:
  for (const [userId, syncPlaylistMap] of Object.entries(collectionMap)) {
    //  For each key:value in collection:
    const spotifyClient = await new SpotifyClient(userId)
    for (const syncPlaylistObj of Object.values(syncPlaylistMap)) {
      //    fetch current sourceePlaylists.snapshot_id from spotify is
      const currentSourcePlaylists: Playlist[] = await Promise.all(
        syncPlaylistObj.sourcePlaylists.map((playlist) =>
          spotifyClient.getPlaylist(
            playlist.id,
            'id,uri,snapshot_id,tracks.items(track(uri))',
          ),
        ),
      )
      console.log(syncPlaylistObj.sourcePlaylists.flatMap((playlist) => playlist.snapshot_id))
      console.log(currentSourcePlaylists.flatMap((playlist) => playlist.snapshot_id))
      //
      // const tracks = sourcePlaylists
      //   .flatMap((currentVal) => currentVal.tracks.items)
      //   .map((track) => track.track.uri)
      //    for each different playlist snapshot id:
      //      fetch songs for playlist that have a 'addedDate' greater than collection.lasySybnced date
      //      add those songs to destination playlist
    }
  }
}
;(async () => onSyncPlaylists())()
