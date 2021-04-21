export interface Token {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token: string
}

export interface Profile {
  country: string
  display_name: string
  email: string
  external_urls: {
    spotify: string
  }
  followers: {
    href: string
    total: number
  }
  href: string
  id: string
  images: [
    {
      height: number
      url: string
      width: number
    },
  ]
  product: string
  type: string
  uri: string
}

export interface PlaylistsResponse {
  href: string
  items: Playlist[]
  limit: number
  next?: string
  offset: number
  previous?: string
  total: number
}

export interface Playlist {
  collaborative: boolean
  external_urls: {
    spotify: string
  }
  href: string
  id: string
  images: []
  name: string
  owner: {
    external_urls: {
      spotify: string
    }
    href: string
    id: string
    type: string
    uri: string
  }
  public: boolean
  snapshot_id: string
  tracks: PagingObject<Track>
  type: string
  uri: string
}

export interface Track {
  added_at: Date
  is_local: boolean
  track: {
    id: string
    uri: string
    name: string
  }
}

export interface PagingObject<T> {
  items: T[]
  href: string
  limit: number
  next: string
  offset: number
  previous: string
  total: number
}
