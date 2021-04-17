import axios from 'axios'
import * as crypto from 'crypto'
import { Request, Response } from 'express'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import * as oauth2lib from 'simple-oauth2'
import { Token } from 'simple-oauth2'
import { BASE_URL } from '../index'
import db from '../services/db'
import { Profile } from '../types/spotify'

export const credentials = {
  client: {
    id: functions.config().spotify.client_id,
    secret: functions.config().spotify.client_secret,
  },
  auth: {
    tokenHost: 'https://accounts.spotify.com',
    tokenPath: '/api/token',
  },
}
const oauth2 = new oauth2lib.AuthorizationCode(credentials)

export const getCallback = async (
  req: Request,
  res: Response,
): Promise<void> => {
  console.log('/auth/spotify/callback')
  // Check that we received a State Cookie.
  if (!req.cookies || !req.cookies.state) {
    res
      .status(400)
      .send(
        'State cookie not set or expired. Maybe you took too long to authorize. Please try again.',
      )
    // Check the State Cookie is equal to the state parameter.
  } else if (req.cookies.state !== req.query.state) {
    res.status(400).send('State validation failed')
  }
  console.log('Requesting access token via oauth')
  const accessToken = await oauth2.getToken({
    code: req.query.code as string,
    redirect_uri: `${BASE_URL}/auth/spotify/callback`,
  })
  console.log(`AccessToken: ${JSON.stringify(accessToken)}`)
  try {
    const profile = (
      await axios.get<Profile>('https://api.spotify.com/v1/me', {
        headers: { authorization: `Bearer ${accessToken.token.access_token}` },
      })
    ).data
    console.log(`Profile: ${JSON.stringify(profile)}`)
    const userId = profile.id
    const name = profile.display_name
    const photoUrl = profile.images[0].url
    const firebaseToken = await createFirebaseAccount(
      userId,
      name,
      photoUrl,
      accessToken.token,
    )
    // Serve an HTML page that signs the user in and updates the user profile.
    res.send(signInFirebaseTemplate(firebaseToken))
  } catch (e) {
    res.status(500).send(`Fetching Spotify access token failed: ${e.message}`)
  }
}

export const getRedirect = (req: Request, res: Response): void => {
  // Generate a random state verification cookie.
  const state =
    (req.cookies && req.cookies.state) || crypto.randomBytes(20).toString('hex')
  // Allow unsecure cookies on localhost.
  const secureCookie = req.get('host')?.indexOf('localhost:') !== 0
  res.cookie('state', state.toString(), {
    maxAge: 3600000,
    secure: secureCookie,
    httpOnly: true,
  })
  const scopes = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public', // creating public playlist
    'playlist-modify-private', // creating private playlist
  ].join(' ')
  res.redirect(
    'https://accounts.spotify.com/authorize' +
      '?response_type=code' +
      `&state=${state}` +
      '&client_id=' +
      functions.config().spotify.client_id +
      (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
      '&redirect_uri=' +
      encodeURIComponent(`${BASE_URL}/auth/spotify/callback`),
  )
}

// Exchange the auth code for an access token.
async function createFirebaseAccount(
  userId: string,
  name: string,
  photoUrl: string,
  accessToken: Token,
) {
  // The uid we'll assign to the user.
  const uid = `spotify:${userId}`
  const firebaseTask = db
    .collection('spotifyAccessTokens')
    .doc(uid)
    .set(accessToken)
    .catch((error: Error) => {
      console.log('err')
      throw error
    })
  // Create the custom token.
  // Create or update the user account.
  const userCreationTask = admin
    .auth()
    .updateUser(uid, {
      displayName: name,
      photoURL: photoUrl,
    })
    .catch((error) => {
      // If user does not exists we create it.
      if (error.code === 'auth/user-not-found') {
        return admin.auth().createUser({
          uid: uid,
          displayName: name,
          photoURL: photoUrl,
        })
      }
      throw error
    })

  // Wait for all async task to complete then generate and return a custom auth token.
  await Promise.all([userCreationTask, firebaseTask])
  // Create a Firebase custom auth token.
  const token = await admin.auth().createCustomToken(uid)
  console.log('Created Custom token for UID "', uid, '" Token:', token)
  return token
}

/**
 * Generates the HTML template that signs the user in Firebase using the given token and closes the
 * popup.
 */
function signInFirebaseTemplate(token: string) {
  return `
    <script>
       window.opener.postMessage('${token}', '*')
       window.close()
    </script>`
}
