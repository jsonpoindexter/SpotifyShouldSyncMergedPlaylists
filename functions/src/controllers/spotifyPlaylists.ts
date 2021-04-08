import { Request, Response } from 'express'
import { Playlist } from '../types/spotify'
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
  playlistsIds: string[]
  description?: string
}

/** Combine user requested playlists into one
 *
 * @param req
 * @param res
 */
export const postCombinePlaylists = async (
  req: Request<unknown, CombinePlaylistRequestBody>,
  res: Response,
): Promise<Response> => {
  const errors = validationResult(req as Request)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  const { name, playlistsIds, description } = req.body

  const spotifyClient = await new SpotifyClient(req.user.uid)
  const playlistTracks = await spotifyClient.getPlaylistItemsRecursive(
    playlistsIds[0],
    100,
    0,
    'offset,total,limit,items(added_at,track(id))',
  )

  // Fetch songs in playlistIds

  // Create destination plyalist w/ name, descriotion and songs from playlistIds
  // Add new destinationPlaylistId, and sourcePlaylistIds to DB so schedular can use to sync
  // Respond with new playlist id or playlist obj

  return res.status(200).send(playlistTracks)
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
