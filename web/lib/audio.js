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
let CANVAS = {}

class Node {
  constructor(name, sample) {
    this.node = {
      name: name,
      sample: sample,
      pattern: [],
    }

  }
  onBeat(beats) {
    if (typeof beats == "string") {
      beats = beats.split(" ").map(i => parseFloat(i))
    }
    this.node.pattern.beats = beats
    return this
  }
  inBars(bars) {
    if (typeof bars == "string") {
      bars = bars.split(" ").map(i => parseInt(i))
    }
    this.node.pattern.bars = bars
    return this
  }
  play() {
    CANVAS[this.node.name] = this.node
    return this
  }
  off() {
    CANVAS[this.node.name] = {}
    return this
  }
}

const calculateBeats = (pattern) => {
  let finalPattern = []
  if (!pattern.bars) {
    [1, 2, 3, 4].forEach( bar => {
      pattern.beats.forEach( beat => {
        finalPattern.push(beat + (bar - 1) * 4)
      })
    })
  }
  return finalPattern
}

const calculateSampleTimes = (phraseStartTime, beatsArr) => {
  return beatsArr.map( b => ((b - 1) * CONFIG.tempo / 1000) + phraseStartTime )
}

const decodeSample = async (context, url) => {
  const response = await fetch(url)
  const rawSampleData = await response.arrayBuffer()
  return new Promise((resolve, reject) => {
    context.decodeAudioData(
      rawSampleData,
      decoded => {
        resolve(decoded) // type AudioBuffer
      },
      error => reject(`Error loading ${url}: ${error}`)
    )
  })
}

const scheduleNodes = (context) => {
  let phraseStartTime = context.currentTime

  Object.keys(CANVAS).forEach( async nodeName => {
    let node = CANVAS[nodeName]

    // Generate AudioContext times from pattern
    // 
    calculateSampleTimes(phraseStartTime, calculateBeats(node.pattern)).forEach(async soundStartTime => {
      let source = context.createBufferSource()

      // Download and decode sample if it hasn't been yet
      if (node.sample.decoded) {
        source.buffer = node.sample.decoded
      } else {
        node.sample.decoded = await decodeSample(context, SAMPLES_BASE_URL + node.sample.file)
        source.buffer = node.sample.decoded
      }

      // TODO: bug here with duration undef on loops
      source.playbackRate.value = node.sample.beat_stretch ?
        node.decoded.duration / (CONFIG.tempo / 1000 * node.sample.beat_stretch) : 1

      source.connect(context.destination)
      source.start(soundStartTime + 1)
    })
  })
}

const startTimerLoop = (context) => {
  console.log("beginning of startPlayback")
  DEBUG.startTime = context.currentTime

  scheduleNodes(context)

  setTimeout(() => {
    let variance = ((DEBUG.startTime + (CONFIG.tempo * 16 / 1000)) - context.currentTime) * 1000
    console.log(`Variance on expected was: ${ variance }ms`)

    startTimerLoop(context)
  }, CONFIG.tempo * CONFIG.barsInPhrase * CONFIG.beatsInBar)
}


const main = async () => {
  const response = await fetch("https://chopsticks.jasongwartz.com/chopsticks/static/sampledata.json")
  const data = await response.json()

  SAMPLES = Object.keys(data).reduce((obj, key) => {
    obj[key] = new Node(key, data[key])
    return obj
  }, {}) // Initial reduce value of emptyObj

  startTimerLoop(new AudioContext())
}

main()