import axios, { AxiosInstance, AxiosResponse } from 'axios'
import {
  PagingObject,
  Playlist,
  PlaylistsResponse,
  Token,
  Track,
} from '../types/spotify'
import { db } from '../index'
import { credentials } from '../controllers/spotifyAuth'

const BASE_URL = 'https://api.spotify.com/v1'

export class SpotifyClient {
  client!: AxiosInstance
  userId: string
  token!: Token // The full spotify token
  constructor(userId: string) {
    this.userId = userId.replace('spotify:', '')
    this.client = axios.create({
      baseURL: BASE_URL,
    })

    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        // Note: cant specify AxiosRequestConfig here bc _retry doesnt exist on it
        const originalRequest = error.config
        // Catch all 1st time auth error responses
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          try {
            await this.refreshAccessToken()
            originalRequest.headers[
              'Authorization'
            ] = `Bearer ${this.token.access_token}`
          } catch (e) {
            return Promise.reject(e)
          }
          return this.client(originalRequest)
        }
        return Promise.reject(error)
      },
    )
    // Fetch access token from firebase
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return (async () => {
      const doc = await db.collection('spotifyAccessTokens').doc(userId).get()
      if (!doc.exists)
        throw Error(`doc for spotifyAccessTokens\\${userId} does not exist`)
      this.token = doc.data() as Token
      this.client.defaults.headers = {
        Authorization: `Bearer ${this.token.access_token}`,
      }
      return this
    })()
  }

  /**
   * Refresh access token
   * https://developer.spotify.com/documentation/general/guides/authorization-guide/#4-requesting-a-refreshed-access-token-spotify-returns-a-new-access-token-to-your-app
   */
  async refreshAccessToken(): Promise<void> {
    const params = new URLSearchParams()
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', this.token.refresh_token)
    const encodedStr = Buffer.from(
      `${credentials.client.id}:${credentials.client.secret}`,
      'utf8',
    ).toString('base64')
    const newToken = (
      await this.client.post('/token', params, {
        baseURL: 'https://accounts.spotify.com/api',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${encodedStr}`,
        },
      })
    ).data
    this.token.access_token = newToken.access_token
    this.client.defaults.headers[
      'Authorization'
    ] = `Bearer ${this.token.access_token}`
    await db
      .collection('spotifyAccessTokens')
      .doc(`spotify:${this.userId}`)
      .set(this.token)
  }

  /**
   * Get a List of Current User's Playlists
   * https://developer.spotify.com/documentation/web-api/reference/#endpoint-get-a-list-of-current-users-playlists
   * @param url
   * @param limit - The maximum number of playlists to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  async getPlaylists(url: string, limit: number): Promise<PlaylistsResponse> {
    return (
      await this.client.get(url, {
        params: {
          limit,
        },
      })
    ).data
  }

  /**
   * Get a single playlist
   * https://developer.spotify.com/documentation/web-api/reference/#endpoint-get-playlist
   * @param playlistId
   * @param fields
   */
  getPlaylist = async (playlistId: string, fields: string): Promise<Playlist> =>
    (await this.client.get(`/playlists/${playlistId}`, { params: { fields } }))
      .data

  /**
   * Recursively gets the current user's playlists
   * @param url
   * @param limit
   */
  getSpotifyPlaylistsRecursive = async (
    limit: number,
    url = `${BASE_URL}/me/playlists`,
  ): Promise<Playlist[]> => {
    const playlistsResponse = await this.getPlaylists(url, limit)
    if (playlistsResponse.next) {
      return [
        ...playlistsResponse.items,
        ...(await this.getSpotifyPlaylistsRecursive(
          limit,
          playlistsResponse.next.replace(BASE_URL, ''),
        )),
      ]
    }
    return playlistsResponse.items
  }

  getPlaylistItemsRecursive = async (
    playlistId: string,
    limit = 100,
    offset = 0,
    fields?: string,
  ): Promise<Track[]> => {
    const tracksResponse = await this.getPlaylistItems(
      playlistId,
      limit,
      offset,
      fields,
    )
    if (tracksResponse.total > limit + offset) {
      return [
        ...tracksResponse.items,
        ...(await this.getPlaylistItemsRecursive(
          playlistId,
          limit,
          offset + limit,
          fields,
        )),
      ]
    }
    return tracksResponse.items
  }

  /**
   * Get a playlist owned by a Spotify user.
   * https://developer.spotify.com/documentation/web-api/reference/#endpoint-get-playlists-tracks
   */
  getPlaylistItems = async (
    playlistId: string,
    limit: number,
    offset: number,
    fields?: string,
  ): Promise<PagingObject<Track>> => {
    return (
      await this.client.get<PagingObject<Track>>(
        `/playlists/${playlistId}/tracks`,
        {
          params: {
            limit,
            offset,
            fields,
          },
        },
      )
    ).data
  }

  /**
   * https://developer.spotify.com/documentation/web-api/reference/#endpoint-create-playlist
   */
  createPlaylist = async (
    name: string,
    isPublic: boolean,
    collaborative: boolean,
    description?: string,
  ): Promise<Playlist> =>
    (
      await this.client.post(`/users/${this.userId}/playlists`, {
        name,
        public: isPublic,
        collaborative,
        description,
      })
    ).data

  /**
   * https://developer.spotify.com/documentation/web-api/reference/#endpoint-add-tracks-to-playlist
   */
  addItemsToPlaylist = async (
    playlistId: string,
    tracks: string[], // trackObj.track.uri[], ex: ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh","spotify:track:1301WleyT98MSxVHPZCA6M"]
    position?: number,
  ): Promise<{ snapshot_id: string }> =>
    (
      await this.client.post(`/playlists/${playlistId}/tracks`, tracks, {
        params: { position },
      })
    ).data
}
