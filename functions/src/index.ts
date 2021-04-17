'use strict'
import * as cookieParser from 'cookie-parser'
import * as corsModule from 'cors'
import * as express from 'express'
import { checkSchema } from 'express-validator'
import * as functions from 'firebase-functions'
// Controllers
import * as spotifyAuthController from './controllers/spotifyAuth'
import * as spotifyPlaylistController from './controllers/spotifyPlaylists'
import { validateFirebaseIdToken } from './utils/firebase'
import { onSyncPlaylists } from './utils/sync'

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

exports.syncFunction = functions.pubsub
  .schedule('0 * * * *') // Every hour on the hour
  .onRun((context) => onSyncPlaylists())
