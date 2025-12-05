const { Schema, model } = require("mongoose");

const MachineRegistrySchema = Schema({
  devices: {         // 🔄 Renamed from "machines"
    type: [String],
    default: []
  }
});

const MachineRegistry = model('MachineRegistry', MachineRegistrySchema);
module.exports = MachineRegistry;
