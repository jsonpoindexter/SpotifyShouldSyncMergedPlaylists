import axios, { AxiosInstance } from 'axios'
import * as admin from 'firebase-admin'
import {
  PagingObject,
  Playlist,
  PlaylistsResponse,
  Track,
} from '../types/spotify'

const BASE_URL = 'https://api.spotify.com/v1'

export class SpotifyClient {
  client: AxiosInstance
  constructor(userId: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
    })
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return (async () => {
      const spotifyToken = (
        await admin.database().ref(`/spotifyAccessToken/${userId}`).get()
      ).val()
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.client.defaults.headers = {
        Authorization: `Bearer ${spotifyToken}`,
      }
      return this
    })()
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
    if (tracksResponse.total === limit) {
      return [
        ...tracksResponse.items,
        ...(await this.getPlaylistItemsRecursive(
          tracksResponse.next.replace(BASE_URL, ''),
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
}
