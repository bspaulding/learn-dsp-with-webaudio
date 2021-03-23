// WebKit doesn't like this...
// import easingFunctions from "./easing.js";
// so hacking around it for now :(
const { cos, sin, PI } = Math;
const easingFunctions = {
  easeInSine(x) {
    return 1 - cos((x * PI) / 2);
  },
  easeOutSine(x) {
    return sin((x * PI) / 2);
  }
};

// logBase(10, y) => log base 10 of y
const logBase = (base, x) => Math.log(x) / Math.log(base);

// magnitude (0-1) to decibel conversion, ie:
//   ydb = 20 (log base 10 of ymag)
//   mag2db(0) => -Infinity
//	 mag2db(1) => 0
const mag2db = mag => 20 * logBase(10, mag);
const db2mag = ydb => Math.pow(10, ydb / 20);

// rms is the root mean square
//	xs is an enumerable of numbers
const rms = xs =>
  Math.pow(xs.reduce((acc, x) => acc + Math.pow(x, 2), 0) / xs.length, 0.5);

const reduceMagByDb = (sample, reductionDb) =>
  (sample < 0 ? -1 : 1) * db2mag(mag2db(Math.abs(sample)) - reductionDb);

const rmsBufferLengthSeconds = 0.2;
const rmsBufferLength = Math.ceil(sampleRate * rmsBufferLengthSeconds);

class CompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "input-gain",
        defaultValue: 1,
        minValue: 0,
        maxValue: 5,
        automationRate: "a-rate"
      },
      {
        name: "output-gain",
        defaultValue: 1,
        minValue: 0,
        maxValue: 5,
        automationRate: "a-rate"
      },
      {
        name: "threshold",
        defaultValue: -40,
        minValue: -80,
        maxValue: 0,
        automationRate: "a-rate"
      },
      {
        name: "ratio",
        defaultValue: 2,
        minValue: 1,
        maxValue: 20,
        automationRate: "a-rate"
      },
      {
        name: "attack",
        defaultValue: 15,
        minValue: 0,
        maxValue: 200,
        automationRate: "a-rate"
      },
      {
        name: "release",
        defaultValue: 50,
        minValue: 5,
        maxValue: 5000,
        automationRate: "a-rate"
      },
      {
        name: "bypass",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate"
      }
    ];
  }

  constructor() {
    super();
    this.sampleClock = 0;
    this.reductionDb = 0;
    this.rmsBuffers = [
      new Float32Array(rmsBufferLength),
      new Float32Array(rmsBufferLength)
    ];
    this.envelopeState = 0;
  }

  process(inputs, outputs, parameters) {
    try {
      const threshold = parameters["threshold"][0];
      const ratio = parameters["ratio"][0];
      const bypass = parameters["bypass"][0];
      const inputGain = parameters["input-gain"][0];
      const outputGain = parameters["output-gain"][0];
      const attackMs = parameters["attack"][0];
      const releaseMs = parameters["release"][0];

      const thrlin = db2mag(threshold);
      const cteAT = Math.exp((-2.0 * Math.PI * 1000.0) / attackMs / sampleRate);
      const cteRL = Math.exp(
        (-2.0 * Math.PI * 1000.0) / releaseMs / sampleRate
      );

      const { rmsBuffers, sampleClock } = this;

      const metrics = [];

      let rmsDb;
      inputs.forEach((channels, i) => {
        const srms = Math.max.apply(
          null,
          channels.map((_, c) => rms(rmsBuffers[c]))
        );
        rmsDb = mag2db(srms);

        channels.forEach((samples, c) => {
          samples.forEach((sampleRaw, s) => {
            const sample = inputGain * sampleRaw;
            // write sample to rmsBuffer
            const rmsBufferIndex = (sampleClock + s) % rmsBufferLength;
            rmsBuffers[c][s] = sample;

            const sideInput = srms;
            const cte = sideInput >= this.envelopeState ? cteAT : cteRL;
            const env = sideInput + cte * (this.envelopeState - sideInput);
            this.envelopeState = env;

            const sampleCompressedRaw =
              sample < thrlin ? sample : thrlin + (sample - thrlin) / ratio;
            const sampleCompressedClipped = Math.min(sampleCompressedRaw, 1);
            const sampleCompressed = sampleCompressedClipped;

            this.reductionDb =
              sample < thrlin ? 0 : mag2db(sample - sampleCompressed);

            if (isNaN(sampleCompressed)) {
              console.warn("compressed sample value was NaN!");
            }

            metrics.push({ sample, sampleCompressed });

            outputs[i][c][s] =
              outputGain *
              (bypass || isNaN(sampleCompressed) ? sample : sampleCompressed);
          });
        });

        if (channels.length) {
          this.sampleClock += channels[0].length;
        }
      });

      const samples = metrics.map(m => m.sample);
      const samplesCompressed = metrics.map(m => m.sampleCompressed);
      this.port.postMessage(
        JSON.stringify({
          type: "metrics",
          payload: {
            reductionDb: this.reductionDb,
            rmsDb,
            samples,
            samplesCompressed
          }
        })
      );

      // TODO: can't seem to be able to return false here, even though docs say i should be able to?
      return true;
    } catch (e) {
      this.port.postMessage(
        JSON.stringify({
          type: "error",
          payload: {
            message: e.message
          }
        })
      );
      return false;
    }
  }
}

registerProcessor("compressor-processor", CompressorProcessor);
