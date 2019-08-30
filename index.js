require('dotenv').config()
const fs = require('fs')
const axios = require('axios')

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
    const response = await axios.get(
      `${OPENSEA_API}/api/v1/assets?asset_contract_address=${CONTRACT_ADDRESS}`
    )
    const { assets } = response.data
    console.log(`Fetched ${assets.length} assets`)
    for (const asset of assets.sort((a, b) =>
      Number(a.token_id) > Number(b.token_id) ? 1 : -1
    )) {
      try {
        const id = +asset.token_id
        if (id > db.lastId) {
          console.log(`New picture #${id}`)

          console.log(`Fetching ${asset.image_url}`)
          const image = await axios.get(asset.image_url, {
            responseType: 'arraybuffer'
          })
          const data = Buffer.from(image.data)

          // Make post request on media endpoint. Pass file data as media parameter
          console.log(`Posting media: ${data.length} bytes`)
          const media = await client.post('media/upload', { media: data })

          const status = {
            status: `#${id} | https://eth.pictures | #NFT`,
            media_ids: media.media_id_string // Pass the media id string
          }
          console.log(`Posting tweet for media id: ${media.media_id_string}`)

          const tweet = await client.post('statuses/update', status)
          console.log(`Success! Tweet id: ${tweet.id}`)

          // update counter
          db.lastId = id
          console.log(`Updating counter: ${db.lastId}`)
          fs.writeFileSync('./db.json', JSON.stringify(db, null, 2))

          console.log(`Waiting ${TWEET_DELAY} ms`)
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
