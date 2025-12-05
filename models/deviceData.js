const { Schema, model } = require("mongoose");


const deviceSchema = new Schema({
  temperature: {
    type: Number,
    required: true
  },
  humidity: {
    type: Number,
    required: true
  },
  gasLevel: {
    type: Number,
    required: true
  },
  breakCount: {
    type: Number,
    default: 0
  },
  motorRPM: {
    type: Number,
    default: 0
  },
  encoderCount: {
    type: Number,
    default: 0
  },
  lightState: {
    type: Boolean,
    default: false
  },
  fanState: {
    type: Boolean,
    default: false
  },
  motorState: {
    type: Boolean,
    default: false
  },
  rgbState: {
    type: Boolean,
    default: false
  },
  rgbRed: {
    type: Number,
    min: 0,
    max: 255,
    default: 255
  },
  rgbGreen: {
    type: Number,
    min: 0,
    max: 255,
    default: 255
  },
  rgbBlue: {
    type: Number,
    min: 0,
    max: 255,
    default: 255
  },
  ldrRaw: {
    type: Number,
    default: 0
  },
  encoderA: {
    type: Number,
    default: 0
  },
  encoderB: {
    type: Number,
    default: 0
  },
}, { timestamps: true });



const DeviceData = model('DeviceData', deviceSchema);

const DashboardToDbSchema = new Schema({
  breakCount: {
    type: Number,
    default: 0
  },
  lightState: {
    type: Boolean,
    default: false
  },
  fanState: {
    type: Boolean,
    default: false
  },
  motorState: {
    type: Boolean,
    default: false
  },
  rgbState: {
    type: Boolean,
    default: false
  },
  rgbRed: {
    type: Number,
    min: 0,
    max: 255,
    default: 255
  },
  rgbGreen: {
    type: Number,
    min: 0,
    max: 255,
    default: 255
  },
  rgbBlue: {
    type: Number,
    min: 0,
    max: 255,
    default: 255
  },

})
const DashboardToDb = model('DashboardToDb',DashboardToDbSchema);
module.exports = {DeviceData,DashboardToDb}