import axios, { AxiosInstance } from 'axios'
import { Request, Response } from 'express'
import * as admin from 'firebase-admin'
import { Playlist, PlaylistResponse } from '../types/spotify'

const getSpotifyPlaylistRecusive = async (
  client: AxiosInstance,
  url: string,
): Promise<Playlist[]> => {
  const data = (await client.get<PlaylistResponse>(url)).data
  console.log(data)
  if (data.next) {
    return [
      ...data.items,
      ...(await getSpotifyPlaylistRecusive(client, data.next)),
    ]
  }
  return data.items
}

export const getAllPlaylists = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { user } = req
  try {
    // Get access token from database
    const spotifyToken = (
      await admin.database().ref(`/spotifyAccessToken/${user.uid}`).get()
    ).val()

    const client = axios.create({
      headers: {
        authorization: `Bearer ${spotifyToken}`,
      },
    })
    const playlists: Playlist[] = await getSpotifyPlaylistRecusive(
      client,
      'https://api.spotify.com/v1/me/playlists',
    )
    res.send(playlists)
  } catch (e) {
    console.log(e)
    res.status(500).send(e.message)
  }
}
