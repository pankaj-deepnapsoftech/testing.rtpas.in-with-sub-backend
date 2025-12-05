const { DeviceData, DashboardToDb } = require("../models/deviceData.js");
const { TryCatch } = require("../utils/error");

// API to take the data from server and saves it into DB
exports.deviceData = TryCatch(async (req, res) => {
  console.log("yha pr");
  // console.log("req.body::", req.body);
  const {
    temperature,
    humidity,
    gasLevel,
    breakCount,
    motorRPM,
    encoderCount,
    lightState,
    fanState,
    motorState,
    rgbState,
    rgbRed,
    rgbGreen,
    rgbBlue,
    ldrRaw,
    encoderA,
    encoderB,
  } = req.body;
  console.log("request aa ri hai");

  // Static query to always refer to the same document
  const query = {}; // or: const query = { uniqueTag: 'device-1' };

  const updatedOrCreated = await DeviceData.findOneAndUpdate(
    query,
    {
      $set: {
        temperature,
        humidity,
        gasLevel,
        breakCount,
        motorRPM,
        encoderCount,
        lightState,
        fanState,
        motorState,
        rgbState,
        rgbRed,
        rgbGreen,
        rgbBlue,
        ldrRaw,
        encoderA,
        encoderB,
      },
    },
    { new: true, upsert: true }
  );

  return res.status(200).json({
    success: true,
    message: "Device data saved or updated successfully",
    data: updatedOrCreated,
  });
});

// API to take data from DB and to show it on dashboard
exports.getAllDeviceData = TryCatch(async (req, res) => {
  const data = await DeviceData.find().sort({ createdAt: -1 }); // latest first

  res.status(200).json({
    success: true,
    message: "All device data fetched successfully",
    count: data.length,
    data,
  });
});

// This API Controller is for dashboard to db data save
// ✅ POST controller

// ---> ye wali post se
// exports.dashboardToDb = TryCatch(async (req, res) => {
//   const newData = req.body;

//   // ✅ Check if any control record already exists
//   let existingRecord = await DeviceData.findOne();

//   if (!existingRecord) {
//     // First time: insert new document
//     const created = await DeviceData.create(newData);

//     const controlFields = {
//       lightState: created.lightState,
//       fanState: created.fanState,
//       motorState: created.motorState,
//       rgbState: created.rgbState,
//       breakCount: created.breakCount,
//       rgbRed: created.rgbRed,
//       rgbGreen: created.rgbGreen,
//       rgbBlue: created.rgbBlue,
//     };

//     global.io.to("nodemcu").emit("newControlData", controlFields);

//     return res.status(201).json({
//       message: "Control data created successfully",
//       data: created,
//     });
//   } else {
//     // Update existing document with new fields (only the ones sent)
//     Object.assign(existingRecord, newData); // only updates sent fields
//     await existingRecord.save();

//     const controlFields = {
//     lightState: existingRecord.lightState,
//     fanState: existingRecord.fanState,
//     motorState: existingRecord.motorState,
//     rgbState: existingRecord.rgbState,
//     breakCount: existingRecord.breakCount,
//     rgbRed: existingRecord.rgbRed,
//     rgbGreen: existingRecord.rgbGreen,
//     rgbBlue: existingRecord.rgbBlue
//   };

//     // ✅ Emit to NodeMCU after update
//      global.io.to('nodemcu').emit('newControlData', controlFields);


//     return res.status(200).json({
//       message: "Control data updated successfully",
//       data: existingRecord,
//     });
//   }
// });


// -->>> ye wali socket se

exports.dashboardToDb = TryCatch(async (req, res) => {
  const newData = req.body;
  console.log("ye new hai jaise hi dashboard pe tick hoga chalega");
  console.log("bhai dashboard to db yha aa ri hai");

  // Check if any control record already exists
  let existingRecord = await DeviceData.findOne();

  if (!existingRecord) {
    // First time: insert new document
    const created = await DeviceData.create(newData);

    const controlFields = {
      lightState: created.lightState,
      fanState: created.fanState,
      motorState: created.motorState,
      rgbState: created.rgbState,
      breakCount: created.breakCount,
      rgbRed: created.rgbRed,
      rgbGreen: created.rgbGreen,
      rgbBlue: created.rgbBlue,
    };

    // Emit to NodeMCU and frontend dashboard clients
    global.io.to('nodemcu').emit('newControlData', controlFields);
    global.io.to('dashboard').emit('controlDataUpdate', controlFields);

    return res.status(201).json({
      message: 'Control data created successfully',
      data: created,
    });
  } else {
    // Update existing document with new fields (only the ones sent)
    Object.assign(existingRecord, newData);
    await existingRecord.save();

    const controlFields = {
      lightState: existingRecord.lightState,
      fanState: existingRecord.fanState,
      motorState: existingRecord.motorState,
      rgbState: existingRecord.rgbState,
      breakCount: existingRecord.breakCount,
      rgbRed: existingRecord.rgbRed,
      rgbGreen: existingRecord.rgbGreen,
      rgbBlue: existingRecord.rgbBlue,
    };

    // Emit to NodeMCU and frontend dashboard clients
    global.io.to('nodemcu').emit('newControlData', controlFields);
    global.io.to('dashboard').emit('controlDataUpdate', controlFields);

    return res.status(200).json({
      message: 'Control data updated successfully',
      data: existingRecord,
    });
  }
});
























// This API Controller will give data from Database to Node MCU Server
// ✅ GET controller
exports.getDashboardControlState = TryCatch(async (req, res) => {
  // Get the latest (only) control state record
  const controlData = await DashboardToDb.findOne();

  if (!controlData) {
    return res.status(404).json({
      message: "No control data found",
    });
  }

  return res.status(200).json(controlData);
});

// This is the extra API, which is the merger of two APIs

exports.deviceDataMerger = TryCatch(async (req, res) => {
  console.log("req.body::", req.body);

  const incomingData = req.body;

  const query = {}; // single device case

  let existingDevice = await DeviceData.findOne(query);

  // --------- ⚠️ If document does not exist, validate required fields before create ----------
  if (!existingDevice) {
    const requiredFields = ["temperature", "humidity", "gasLevel"];

    const missingFields = requiredFields.filter(
      (field) => !(field in incomingData)
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields for new device document: ${missingFields.join(
          ", "
        )}`,
      });
    }

    // ✅ All required fields present → create new document
    const created = await DeviceData.create(incomingData);

    return res.status(201).json({
      success: true,
      message: "New device data document created successfully",
      data: created,
    });
  }

  // --------- ✅ Update only the fields present in request body ----------
  const allowedFields = [
    "temperature",
    "humidity",
    "gasLevel",
    "breakCount",
    "motorRPM",
    "encoderCount",
    "lightState",
    "fanState",
    "motorState",
    "rgbState",
    "rgbRed",
    "rgbGreen",
    "rgbBlue",
    "ldrRaw",
    "encoderA",
    "encoderB",
  ];

  for (let key in incomingData) {
    if (incomingData.hasOwnProperty(key) && allowedFields.includes(key)) {
      existingDevice[key] = incomingData[key];
    }
  }

  await existingDevice.save();

  return res.status(200).json({
    success: true,
    message: "Device data updated successfully",
    data: existingDevice,
  });
});
