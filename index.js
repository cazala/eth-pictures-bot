require('dotenv').config()
const fetch = require('isomorphic-fetch')
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')

const OPENSEA_API = process.env.OPENSEA_API
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const TWEET_DELAY = process.env.TWEET_DELAY
const POLL_INTERVAL = process.env.POLL_INTERVAL

console.log('OPENSEA_API', OPENSEA_API)
console.log('CONTRACT_ADDRESS', CONTRACT_ADDRESS)

const Twitter = require('twitter')

const client = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN_KEY,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET
})

// create image directory
if (!fs.existsSync(path.resolve(__dirname, './images'))) {
  fs.mkdirSync('./images')
}

async function poll() {
  console.log('Polling...')
  try {
    let db
    try {
      db = require('./db.json')
    } catch (e) {
      db = { lastId: -1 }
    }

    console.log(`Last ID: ${db.lastId}`)
    const json = await fetch(
      `${OPENSEA_API}/api/v1/assets?asset_contract_address=${CONTRACT_ADDRESS}`
    )
    const { assets } = await json.json()
    console.log(`Fetched ${assets.length} assets`)
    for (const asset of assets.sort((a, b) =>
      Number(a.token_id) > Number(b.token_id) ? 1 : -1
    )) {
      try {
        const id = +asset.token_id
        if (id > db.lastId) {
          console.log(`New picture #${id}`)
          const image = await fetch(asset.image_url)
          const imagePath = path.resolve(__dirname, `./images/${id}.png`)
          if (!fs.existsSync(imagePath)) {
            await new Promise((resolve, reject) =>
              image.body
                .pipe(fs.createWriteStream(imagePath))
                .on('close', () => resolve())
                .on('error', e => reject(e.message))
            )
          }

          const data = fs.readFileSync(imagePath)

          // Make post request on media endpoint. Pass file data as media parameter
          const media = await client.post('media/upload', { media: data })

          const status = {
            status: `#${id} | https://eth.pictures | #NFT`,
            media_ids: media.media_id_string // Pass the media id string
          }

          const tweet = await client.post('statuses/update', status)
          console.log(tweet.id)

          // update counter
          fs.writeFileSync('./db.json', JSON.stringify({ lastId: id }, null, 2))

          // remove image from disk
          rimraf.sync(imagePath)

          await new Promise(resolve => setTimeout(resolve, TWEET_DELAY))
        }
      } catch (e) {
        console.log(`Error: ${e.message}`)
      }
    }
  } catch (e) {
    console.log(`Error: ${e.message}`)
  }
  console.log(`Timeout ${POLL_INTERVAL} ms`)
  setTimeout(poll, POLL_INTERVAL)
}

poll()
