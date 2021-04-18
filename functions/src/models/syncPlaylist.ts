import { firestore } from 'firebase-admin/lib/firestore'
import db from '../services/db'
import { isObjectEmpty } from '../utils/general'
import WriteResult = firestore.WriteResult
import Timestamp = firestore.Timestamp
import DocumentSnapshot = firestore.DocumentSnapshot

/**
 * Useful for when we want to export our whole collection
 */
export type SyncPlaylistCollectionMap = {
  [userId: string]: SyncPlaylistMap
}

export type SyncPlaylistMap = {
  [destinationPlaylistId: string]: SyncPlaylistObj
}

interface PlaylistObj {
  id: string
  uri: string
  snapshot_id: string
}
interface SyncPlaylistObj {
  destinationPlaylist: PlaylistObj
  sourcePlaylists: PlaylistObj[]
  lastSynced: Timestamp
}

class _SyncPlaylist {
  private COLLECTION_PATH = 'syncPlaylists'
  private collectionRef = db.collection(this.COLLECTION_PATH)

  private getDocSnapshot = async (
    userId: string,
  ): Promise<DocumentSnapshot> => {
    const docSnapshot = await this.collectionRef.doc(userId).get()
    if (docSnapshot.exists) return docSnapshot
    throw Error(`docSnapshot ${docSnapshot.ref.path} does not exist`)
  }

  getCollection = async () => {
    let results: SyncPlaylistCollectionMap = {}
    const ref = await this.collectionRef.get()
    ref.docs.forEach((doc) => {
      results = { ...results, [`${doc.id}`]: doc.data() as SyncPlaylistMap }
    })
    return results
  }

  /**
   *  Add a new (or overwrite if exists) SyncPlaylistObj to a document
   * @param userId
   * @param payload
   */
  set = async (
    userId: string,
    payload: SyncPlaylistObj,
  ): Promise<WriteResult> => {
    const syncPlaylistMap = await this.get(userId)
    syncPlaylistMap[payload.destinationPlaylist.id] = payload
    return this.collectionRef.doc(userId).set(syncPlaylistMap)
  }
  /**
   * Returns all sync playlists in a SyncPlaylistMap for a user
   * @param userId
   */
  get = async (userId: string): Promise<SyncPlaylistMap> => {
    const docRef = await this.collectionRef.doc(userId).get()
    return (docRef.data() as SyncPlaylistMap) || {}
  }
  /**
   * Returns a singular SyncPlaylistObj from a SyncPlaylistMap for a user
   * @param userId
   * @param playlistId
   */
  getOne = async (
    userId: string,
    playlistId: string,
  ): Promise<SyncPlaylistObj> =>
    ((await this.getDocSnapshot(userId)).data() as SyncPlaylistMap)[playlistId]

  /**
   * Delete a single entry / sync job from a user's playlist map, or delete the entire collection if the document is now empty
   * @param {string} userId
   * @param {string} playlistId
   * @returns {Promise<FirebaseFirestore.WriteResult>}
   */
  deleteOne = async (
    userId: string,
    playlistId: string,
  ): Promise<WriteResult> => {
    const documentSnapshot = await this.getDocSnapshot(userId)
    const syncPlaylistMap = documentSnapshot.data() as SyncPlaylistMap
    // Remove the entire collection if the document is now empty
    if (isObjectEmpty(syncPlaylistMap)) {
      return await documentSnapshot.ref.delete()
    } else
      return await documentSnapshot.ref.update({
        [`${playlistId}`]: firestore.FieldValue.delete(),
      })
  }

  /**
   * Update a snapshot id of user's playlistObj sourcePlaylist or destinationPlaylist
   * If its a sourceplaylist we need to find the specific playlist
   * @param {string} userId
   * @param {string} destinationPlaylistId
   * @param {string} snapshotId
   * @param {string} sourcePlaylistId
   * @returns {Promise<void>}
   */
  updateSnapshotId = async (
    userId: string,
    destinationPlaylistId: string,
    snapshotId: string,
    sourcePlaylistId?: string,
  ) => {
    const documentSnapshot = await this.getDocSnapshot(userId)
    const syncPlaylistObj = (documentSnapshot.data() as SyncPlaylistMap)[
      destinationPlaylistId
    ]
    if (sourcePlaylistId) {
      const sourcePlaylist = syncPlaylistObj.sourcePlaylists.find(
        (sourcePlaylist) => sourcePlaylist.id === sourcePlaylistId,
      )
      if (!sourcePlaylist)
        throw Error(
          `sourcePlaylistId ${sourcePlaylistId} does not exist on ${destinationPlaylistId}`,
        )
      sourcePlaylist.snapshot_id = snapshotId
    } else {
      syncPlaylistObj.destinationPlaylist.snapshot_id = snapshotId
    }
    syncPlaylistObj.lastSynced = Timestamp.now()
    await documentSnapshot.ref.update(destinationPlaylistId, syncPlaylistObj)
  }
}

export const SyncPlaylist = new _SyncPlaylist()
