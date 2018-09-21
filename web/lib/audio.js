"use strict"

const DEFAULTS = {
  tempo: 500.0, // milliseconds per beat - 1000 = 60bpm
}
const DEBUG = {}
const CONFIG = {
  barsInPhrase: 4,
  beatsInBar: 4,
  tempo: DEFAULTS.tempo,
}

const SAMPLES_BASE_URL = "https://chopsticks.jasongwartz.com/chopsticks/"

let SAMPLES = {}
let CANVAS = []

const calculateSampleTimes = (phraseStartTime, beatsArr) => {
  let beatsTime = beatsArr.map( b => (b - 1) * CONFIG.tempo / 1000 + phraseStartTime )
}

const scheduleNodes = (context, nodesToSchedule) => {
  nodesToSchedule.map( async (node) => {
    let source = context.createBufferSource()
    if (node.sample.decoded) {
      source.buffer = node.sample.decoded
    } else {
      const response = await fetch(SAMPLES_BASE_URL + node.sample.file)
      const rawSampleData = await response.arrayBuffer()
      await new Promise((resolve, reject) => {
        context.decodeAudioData(
          rawSampleData,
          decoded => {
            node.sample.decoded = decoded // type AudioBuffer
            resolve()
          },
          error => reject(`Error loading ${node.sample.file}: ${error}`)
        )
      })
      source.buffer = node.sample.decoded
    }
    source.playbackRate.value = node.sample.beat_stretch ?
      node.decoded.duration / (CONFIG.tempo / 1000 * node.sample.beat_stretch) : 1
    source.connect(context.destination)
    source.start()
  })
}

const addToCanvas = (sample) => {
  let node = {sample: sample}
  CANVAS.push(node)
}

const startTimerLoop = (context) => {
  console.log("beginning of startPlayback")
  DEBUG.startTime = context.currentTime

  scheduleNodes(context, CANVAS)

  setTimeout(() => {
    let variance = ((DEBUG.startTime + (CONFIG.tempo * 16 / 1000)) - context.currentTime) * 1000
    console.log(`Variance on expected was: ${ variance }ms`)

    startTimerLoop(context)
  }, CONFIG.tempo * CONFIG.barsInPhrase * CONFIG.beatsInBar)
}


const main = async () => {
  const response = await fetch("https://chopsticks.jasongwartz.com/chopsticks/static/sampledata.json")
  const data = await response.json()

  for (let name in data) {
    SAMPLES[name] = Object.assign({play: addToCanvas}, data[name])
  }
  startTimerLoop(new AudioContext())
}

main()