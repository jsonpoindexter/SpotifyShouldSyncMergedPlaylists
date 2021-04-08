import { Request, Response } from 'express'
import { Playlist, Track } from '../types/spotify'
import { validationResult } from 'express-validator'
import { SpotifyClient } from '../utils/spotifyClient'

export const getAllPlaylists = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { user } = req
  try {
    const spotifyClient = await new SpotifyClient(user.uid)
    const playlists: Playlist[] = await spotifyClient.getSpotifyPlaylistsRecursive(
      50,
    )
    res.send(playlists)
  } catch (e) {
    console.log(e)
    res.status(500).send(e.message)
  }
}

interface CombinePlaylistRequestBody {
  name: string
  playlistIds: string[]
  description?: string
}

/** Combine user requested playlists into one
 *
 * @param req
 * @param res
 */
export const postCombinePlaylists = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  const {
    name,
    playlistIds,
    description,
  } = req.body as CombinePlaylistRequestBody

  const spotifyClient = await new SpotifyClient(req.user.uid)
  const playlistTracks: string[] = (
    await Promise.all<Track[]>(
      playlistIds.map((playlistId) =>
        spotifyClient.getPlaylistItemsRecursive(
          playlistId,
          100,
          0,
          'offset,total,limit,items(track(uri))',
        ),
      ),
    )
  )
    .flat()
    .map((track) => track.track.uri)

  const createdPlaylist = await spotifyClient.createPlaylist(
    name,
    false,
    false,
    description,
  )

  while (playlistTracks.length > 0) {
    await spotifyClient.addItemsToPlaylist(
      createdPlaylist.id,
      playlistTracks.splice(0, 100),
    )
  }
  return res.status(200).send(createdPlaylist)
}

// NOTE: when we run sync process we pronanly want to start the OFFSET for playlist tracks near the playlist TOTAL since that will be the latest songsZ
// /**
//  * Sync songs from multiple sourcePlaylistIds into the destinationPlaylistId
//  * @param sourcePlaylistIds
//  * @param destinationPlaylistId
//  */
// const syncPlaylists = (
//   sourcePlaylistIds: string[],
//   destinationPlaylistId: string,
// ) => {}
