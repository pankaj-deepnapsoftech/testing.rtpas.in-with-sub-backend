const { Schema, model } = require("mongoose");

const machineStatusSchema = new Schema({
  device_id: { type: String, required: true },  // 🔄 Renamed from "machine"
  count: { type: Number, required: true },
  design: { type: String, required: true },
  efficiency: { type: Number, required: true },
  error1: { type: Number, required: true },
  error2: { type: Number, required: true },
  status: {type: String, required: true},
  shift: { type: String, required: true },
  timestamp: { type: String, required: true }
}, {
  timestamps: true
});

const MachineStatus = model('MachineStatus', machineStatusSchema);
module.exports = MachineStatus;
