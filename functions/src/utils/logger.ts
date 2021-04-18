import { LoggingBunyan } from '@google-cloud/logging-bunyan'
import * as bunyan from 'bunyan'
import * as bformat from 'bunyan-format'

const loggingBunyan = new LoggingBunyan()

const formatOut = bformat({ outputMode: 'short' })

const logger = bunyan.createLogger({
  name: 'spotify-should-sync-merged-playlists',
  streams: [
    { stream: formatOut, level: 'debug' },
    loggingBunyan.stream('debug'),
  ],
})

export default logger
