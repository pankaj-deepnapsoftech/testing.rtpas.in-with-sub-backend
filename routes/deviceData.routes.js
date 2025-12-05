const express = require('express');
const { isAuthenticated } = require('../middlewares/isAuthenticated');
const { isSuper } = require('../middlewares/isSuper');
const { deviceData,getAllDeviceData,dashboardToDb,getDashboardControlState } = require('../controllers/deviceData.controller.js');

const router = express.Router();

// These 2 are for nodemcu server to DB and DB to Dashboard
router.get('/get-device-data',getAllDeviceData)
router.post('/device-data', deviceData);

// These 2 are for dashboard to database
router.post('/dashboardtodb',dashboardToDb);
router.get('/dbtoserver',getDashboardControlState)
module.exports = router;    


// console.log("jmsadfajsbfjk")

