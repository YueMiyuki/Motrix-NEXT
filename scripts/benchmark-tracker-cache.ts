import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import axios from 'axios'
import { fetchBtTrackerFromSource, clearTrackerSourceCache } from '../src/shared/utils/tracker'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function run() {
  const source = ['https://tracker-source-1.example.com', 'https://tracker-source-2.example.com']
  const originalGet = axios.get
  let requestCount = 0

  axios.get = (async (url: string) => {
    requestCount += 1
    await sleep(30)
    return {
      data: `${url}-body`,
    }
  }) as typeof axios.get

  try {
    clearTrackerSourceCache()

    const firstStart = performance.now()
    await fetchBtTrackerFromSource(source)
    const firstElapsedMs = performance.now() - firstStart
    const firstRequestCount = requestCount

    const secondStart = performance.now()
    await fetchBtTrackerFromSource(source)
    const secondElapsedMs = performance.now() - secondStart
    const secondRequestCount = requestCount - firstRequestCount

    clearTrackerSourceCache()
    requestCount = 0
    await Promise.all([
      fetchBtTrackerFromSource(source),
      fetchBtTrackerFromSource(source),
      fetchBtTrackerFromSource(source),
    ])
    const concurrentRequestCount = requestCount

    assert.equal(firstRequestCount, 2, 'first call should hit both tracker endpoints')
    assert.equal(secondRequestCount, 0, 'second call should be served from cache')
    assert.equal(concurrentRequestCount, 2, 'concurrent calls should share in-flight requests')

    console.log('tracker cache benchmark')
    console.log(`- first call network requests: ${firstRequestCount}`)
    console.log(`- second call network requests: ${secondRequestCount}`)
    console.log(`- concurrent (x3) network requests: ${concurrentRequestCount}`)
    console.log(`- first call elapsed: ${Math.round(firstElapsedMs)} ms`)
    console.log(`- second call elapsed: ${Math.round(secondElapsedMs)} ms`)
  } finally {
    axios.get = originalGet
    clearTrackerSourceCache()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
